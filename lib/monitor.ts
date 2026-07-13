// ============================================================================
// AlphaWire — Page Monitoring Engine
// ============================================================================
// Fetches monitored URLs on a cron schedule, diffs the text content with
// cheerio, and emits PageChange events that the classifier converts to
// Signals. Seeds with high-signal crypto sources.
// ============================================================================

import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import * as cron from 'node-cron';
import { store } from './store';
import { classifyEvent, generateId } from './classify';
import type { MonitoredSource, PageChange } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'AlphaWireBot/1.0 (+https://alphawire.ai; monitoring crypto sources)';

const SEED_SOURCES: Omit<MonitoredSource, 'id' | 'createdAt'>[] = [
  {
    url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=20&output=atom',
    name: 'SEC EDGAR — 8-K Filings',
    intervalSec: 300,
    lastChecked: 0,
    contentHash: '',
    status: 'active',
  },
  {
    url: 'https://www.coinbase.com/api/v2/assets',
    name: 'Coinbase — Listed Assets',
    intervalSec: 600,
    lastChecked: 0,
    contentHash: '',
    status: 'active',
  },
  {
    url: 'https://www.binance.com/en/support/announcement/cryptocurrency-listing',
    name: 'Binance — Listing Announcements',
    intervalSec: 120,
    lastChecked: 0,
    contentHash: '',
    status: 'active',
  },
  {
    url: 'https://www.okx.com/support/hc/en-us/sections/360000514431',
    name: 'OKX — Announcements',
    intervalSec: 120,
    lastChecked: 0,
    contentHash: '',
    status: 'active',
  },
  {
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    name: 'CoinDesk — RSS Feed',
    intervalSec: 180,
    lastChecked: 0,
    contentHash: '',
    status: 'active',
  },
];

// ---------------------------------------------------------------------------
// fetchPageContent — fetch HTML, extract text, hash it
// ---------------------------------------------------------------------------

export interface FetchedContent {
  text: string;
  hash: string;
  lines: string[];
}

export async function fetchPageContent(
  url: string,
): Promise<FetchedContent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml,text/xml,*/*',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }

    const html = await res.text();
    return extractContent(html);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// extractContent — cheerio-powered text extraction
// ---------------------------------------------------------------------------

export function extractContent(html: string): FetchedContent {
  const $ = cheerio.load(html);

  // Remove noise elements
  $('script, style, noscript, svg, iframe, nav, footer, header, aside').remove();

  // Extract headings and paragraphs — these carry the signal
  const elements: string[] = [];

  $('h1, h2, h3, h4, p, li, td, entry > title, entry > summary, item > title').each(
    (_idx, el) => {
      const text = $(el).text().trim();
      if (text.length > 0) {
        elements.push(text);
      }
    },
  );

  // Fallback: if structured extraction yielded nothing, grab body text
  let lines: string[];
  if (elements.length > 0) {
    lines = dedupeAndClean(elements);
  } else {
    const bodyText = $('body').text() || $('*').text() || html;
    lines = dedupeAndClean(
      bodyText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 5),
    );
  }

  const text = lines.join('\n');
  const hash = sha256(text);

  return { text, hash, lines };
}

function dedupeAndClean(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean.length < 5) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// detectChanges — line-level diff between old and new content
// ---------------------------------------------------------------------------

export function detectChanges(
  oldLines: string[],
  newLines: string[],
): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldLines.map((l) => l.toLowerCase()));
  const newSet = new Set(newLines.map((l) => l.toLowerCase()));

  const added = newLines.filter((l) => !oldSet.has(l.toLowerCase()));
  const removed = oldLines.filter((l) => !newSet.has(l.toLowerCase()));

  return { added, removed };
}

// ---------------------------------------------------------------------------
// checkSource — fetch a single source and process changes
// ---------------------------------------------------------------------------

export async function checkSource(source: MonitoredSource): Promise<void> {
  try {
    const fetched = await fetchPageContent(source.url);

    if (source.contentHash === '') {
      // First fetch — store the hash but don't emit a change
      store.updateSource(source.id, {
        lastChecked: Date.now(),
        contentHash: fetched.hash,
      });
      console.log(
        `[monitor] Initial fetch for "${source.name}" — ${fetched.lines.length} lines, hash ${fetched.hash.slice(0, 12)}`,
      );
      return;
    }

    if (fetched.hash === source.contentHash) {
      store.updateSource(source.id, { lastChecked: Date.now() });
      return;
    }

    // Content changed — compute diff
    // We need the previous content lines to diff against. Since we only
    // stored the hash, we diff against an empty baseline on the second fetch,
    // then rely on line-level comparison for subsequent checks.
    // For robustness we store last lines in a parallel map.
    const oldLines = lastContentLines.get(source.id) ?? [];
    const { added, removed } = detectChanges(oldLines, fetched.lines);
    lastContentLines.set(source.id, fetched.lines);

    if (added.length === 0 && removed.length === 0) {
      // Hash differs but no line-level diff (e.g. whitespace) — skip
      store.updateSource(source.id, {
        lastChecked: Date.now(),
        contentHash: fetched.hash,
      });
      return;
    }

    const change: PageChange = {
      id: generateId('chg'),
      sourceId: source.id,
      url: source.url,
      timestamp: Date.now(),
      addedContent: added,
      removedContent: removed,
      rawDiff: formatDiff(added, removed),
    };

    store.addChange(change);
    store.updateSource(source.id, {
      lastChecked: Date.now(),
      contentHash: fetched.hash,
    });

    // Classify and emit signal
    const signal = classifyEvent(change);
    store.addSignal(signal);

    console.log(
      `[monitor] Change detected on "${source.name}" — ${added.length} added, ${removed.length} removed → ${signal.eventType} (${signal.direction}, ${signal.confidence}% conf) tokens: ${signal.affectedTokens.join(', ')}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[monitor] Error checking "${source.name}": ${msg}`);
    store.updateSource(source.id, { lastChecked: Date.now() });
  }
}

// Parallel map for storing last-seen content lines (in-memory only)
const lastContentLines = new Map<string, string[]>();

function formatDiff(added: string[], removed: string[]): string {
  const parts: string[] = [];
  for (const a of added.slice(0, 20)) parts.push(`+ ${a}`);
  for (const r of removed.slice(0, 20)) parts.push(`- ${r}`);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// checkAllSources — sweep all active sources whose interval has elapsed
// ---------------------------------------------------------------------------

export async function checkAllSources(): Promise<void> {
  const active = store.getActiveSources();
  const now = Date.now();

  const due = active.filter(
    (s) => s.lastChecked === 0 || now - s.lastChecked >= s.intervalSec * 1000,
  );

  if (due.length === 0) return;

  console.log(`[monitor] Checking ${due.length}/${active.length} due sources`);

  // Fire all checks concurrently — each has its own timeout
  await Promise.allSettled(due.map((s) => checkSource(s)));
}

// ---------------------------------------------------------------------------
// addSource — add a new monitored source at runtime
// ---------------------------------------------------------------------------

export function addSource(
  url: string,
  name: string,
  intervalSec: number,
): MonitoredSource {
  const existing = store.getSourceByUrl(url);
  if (existing) return existing;

  const source: MonitoredSource = {
    id: generateId('src'),
    url,
    name,
    intervalSec: Math.max(30, intervalSec),
    lastChecked: 0,
    contentHash: '',
    status: 'active',
    createdAt: Date.now(),
  };

  store.addSource(source);

  // Trigger immediate first fetch
  checkSource(source).catch((err) =>
    console.error(`[monitor] Initial fetch failed for ${url}:`, err),
  );

  return source;
}

// ---------------------------------------------------------------------------
// seedSources — populate the store with the default high-signal sources
// ---------------------------------------------------------------------------

export function seedSources(): void {
  for (const seed of SEED_SOURCES) {
    if (store.getSourceByUrl(seed.url)) continue;
    store.addSource({
      ...seed,
      id: generateId('src'),
      createdAt: Date.now(),
    });
  }
  console.log(`[monitor] Seeded ${SEED_SOURCES.length} default sources`);
}

// ---------------------------------------------------------------------------
// startMonitoring — register the cron job and kick off the first sweep
// ---------------------------------------------------------------------------

let monitoringStarted = false;

export function startMonitoring(): void {
  if (monitoringStarted) {
    console.log('[monitor] Already running');
    return;
  }
  monitoringStarted = true;

  seedSources();

  // Check every 60 seconds
  cron.schedule('*/60 * * * * *', () => {
    checkAllSources().catch((err) =>
      console.error('[monitor] Sweep error:', err),
    );
  });

  // Kick off the first sweep after a short delay to let the server boot
  setTimeout(() => {
    checkAllSources().catch((err) =>
      console.error('[monitor] Initial sweep error:', err),
    );
  }, 5_000);

  console.log('[monitor] Monitoring engine started — cron every 60s');
}
