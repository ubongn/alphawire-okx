// ============================================================================
// AlphaWire — Rule-Based Event Classifier
// ============================================================================
// Turns raw PageChange diffs into structured Signal objects via keyword
// matching and a lightweight named-entity extractor. Designed to be
// upgradable to an LLM backend when LLM_API_KEY is provided.
// ============================================================================

import type {
  PageChange,
  Signal,
  EventType,
  Direction,
  MomentumWindow,
} from './types';

// ---------------------------------------------------------------------------
// Keyword maps — ordered by priority (first match wins within a category)
// ---------------------------------------------------------------------------

interface RuleEntry {
  type: EventType;
  direction: Direction;
  keywords: string[];
}

const RULES: RuleEntry[] = [
  {
    type: 'listing',
    direction: 'bullish',
    keywords: [
      'listing', 'added', 'new trading pair', 'now available for trading',
      'open for trading', 'will list', 'new listing', 'gets listed',
      'launches trading', 'spot trading', 'new market',
    ],
  },
  {
    type: 'delisting',
    direction: 'bearish',
    keywords: [
      'delisted', 'delisting', 'removed from', 'terminated', 'will remove',
      'trading halted', 'ceased', 'withdrawal suspended', 'ending support',
      'no longer available',
    ],
  },
  {
    type: 'hack',
    direction: 'bearish',
    keywords: [
      'exploit', 'hack', 'drained', 'rug pull', 'flash loan attack',
      'vulnerability exploited', 'funds stolen', 'security incident',
      'bridge hack', 'drain', 'breach', 'compromised',
    ],
  },
  {
    type: 'regulatory',
    direction: 'bearish',
    keywords: [
      'sec charged', 'sec sues', 'lawsuit', 'enforcement action',
      'charged by', 'sanctioned', 'penalty', 'fraud', ' cease and desist',
      'investigation', 'subpoena', 'registered security',
    ],
  },
  {
    type: 'partnership',
    direction: 'bullish',
    keywords: [
      'partnership', 'integration', 'collaboration', 'partners with',
      'teams up', 'joins forces', 'strategic alliance', 'announces deal',
      'acquires', 'merger',
    ],
  },
  {
    type: 'policy',
    direction: 'neutral',
    keywords: [
      'policy change', 'rate decision', 'interest rate', 'fed announces',
      'regulatory framework', 'guidance', 'proposed rule', 'comment period',
    ],
  },
  {
    type: 'earnings',
    direction: 'neutral',
    keywords: [
      'earnings', 'quarterly report', 'revenue', 'profit', 'q1', 'q2',
      'q3', 'q4', '10-k', '10-q', '8-k', 'filing', 'shareholder',
    ],
  },
  {
    type: 'governance',
    direction: 'neutral',
    keywords: [
      'governance', 'proposal', 'vote', 'snapshot', 'dao', 'treasury',
      'onchain vote', 'gip', 'rip',
    ],
  },
];

// ---------------------------------------------------------------------------
// Known token lexicon for the NER
// ---------------------------------------------------------------------------

interface TokenEntry {
  name: string;
  symbol: string;
}

const KNOWN_TOKENS: TokenEntry[] = [
  { name: 'bitcoin', symbol: 'BTC' },
  { name: 'ethereum', symbol: 'ETH' },
  { name: 'solana', symbol: 'SOL' },
  { name: 'ripple', symbol: 'XRP' },
  { name: 'cardano', symbol: 'ADA' },
  { name: 'avalanche', symbol: 'AVAX' },
  { name: 'polkadot', symbol: 'DOT' },
  { name: 'polygon', symbol: 'MATIC' },
  { name: 'chainlink', symbol: 'LINK' },
  { name: 'uniswap', symbol: 'UNI' },
  { name: 'litecoin', symbol: 'LTC' },
  { name: 'bitcoin cash', symbol: 'BCH' },
  { name: 'dogecoin', symbol: 'DOGE' },
  { name: 'shiba inu', symbol: 'SHIB' },
  { name: 'pepe', symbol: 'PEPE' },
  { name: 'cosmos', symbol: 'ATOM' },
  { name: 'near', symbol: 'NEAR' },
  { name: 'aptos', symbol: 'APT' },
  { name: 'sui', symbol: 'SUI' },
  { name: 'filecoin', symbol: 'FIL' },
  { name: 'arbitrum', symbol: 'ARB' },
  { name: 'optimism', symbol: 'OP' },
  { name: 'injective', symbol: 'INJ' },
  { name: 'stacks', symbol: 'STX' },
  { name: 'render', symbol: 'RNDR' },
  { name: 'the graph', symbol: 'GRT' },
  { name: 'aave', symbol: 'AAVE' },
  { name: 'compound', symbol: 'COMP' },
  { name: 'maker', symbol: 'MKR' },
  { name: 'dai', symbol: 'DAI' },
  { name: 'tether', symbol: 'USDT' },
  { name: 'usd coin', symbol: 'USDC' },
  { name: 'binance coin', symbol: 'BNB' },
  { name: 'tron', symbol: 'TRX' },
  { name: 'hedera', symbol: 'HBAR' },
  { name: 'vechain', symbol: 'VET' },
  { name: 'algorand', symbol: 'ALGO' },
  { name: 'fantom', symbol: 'FTM' },
  { name: 'monero', symbol: 'XMR' },
  { name: 'tezos', symbol: 'XTZ' },
  { name: 'internet computer', symbol: 'ICP' },
  { name: 'stellar', symbol: 'XLM' },
  { name: 'ethereum classic', symbol: 'ETC' },
  { name: 'mantle', symbol: 'MNT' },
  { name: 'sepolia', symbol: 'SEI' },
  { name: 'bonk', symbol: 'BONK' },
  { name: 'worldcoin', symbol: 'WLD' },
  { name: 'jupiter', symbol: 'JUP' },
  { name: 'pyth network', symbol: 'PYTH' },
  { name: 'ondo', symbol: 'ONDO' },
];

// ---------------------------------------------------------------------------
// extractTokens — simple named-entity recognition
// ---------------------------------------------------------------------------

export function extractTokens(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  // Pattern 1: $TICKER — e.g. $BTC, $ETH
  const tickerMatches = text.match(/\$([A-Za-z]{2,10})\b/g);
  if (tickerMatches) {
    for (const m of tickerMatches) {
      found.add(m.slice(1).toUpperCase());
    }
  }

  // Pattern 2: Match against known token names
  for (const token of KNOWN_TOKENS) {
    // Match whole words only
    const regex = new RegExp(`\\b${escapeRegex(token.name)}\\b`, 'i');
    if (regex.test(lower)) {
      found.add(token.symbol);
    }
  }

  // Pattern 3: Match known symbols as standalone uppercase words
  const words = text.match(/\b[A-Z]{2,6}\b/g);
  if (words) {
    const symbolSet = new Set(KNOWN_TOKENS.map((t) => t.symbol));
    for (const w of words) {
      if (symbolSet.has(w)) {
        found.add(w);
      }
    }
  }

  return Array.from(found).sort();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// classifyEventType — keyword match against the rule table
// ---------------------------------------------------------------------------

export function classifyEventType(
  text: string,
): { type: EventType; direction: Direction; matchedKeyword: string | null } {
  const lower = text.toLowerCase();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return { type: rule.type, direction: rule.direction, matchedKeyword: kw };
      }
    }
  }

  return { type: 'unknown', direction: 'neutral', matchedKeyword: null };
}

// ---------------------------------------------------------------------------
// estimateMomentumWindow — how long the signal stays actionable
// ---------------------------------------------------------------------------

export function estimateMomentumWindow(eventType: EventType): MomentumWindow {
  const now = Date.now();
  const presets: Record<EventType, { exitMin: number; peakMin: number }> = {
    listing: { exitMin: 60 * 48, peakMin: 60 * 6 }, // 48h exit, 6h peak
    delisting: { exitMin: 60 * 4, peakMin: 60 * 1 }, // 4h exit, 1h peak
    hack: { exitMin: 60 * 2, peakMin: 15 }, // 2h exit, 15m peak
    regulatory: { exitMin: 60 * 24 * 7, peakMin: 60 * 24 }, // 7d exit, 24h peak
    partnership: { exitMin: 60 * 24, peakMin: 60 * 3 }, // 24h exit, 3h peak
    policy: { exitMin: 60 * 24 * 3, peakMin: 60 * 8 }, // 3d exit, 8h peak
    earnings: { exitMin: 60 * 24, peakMin: 60 * 2 }, // 24h exit, 2h peak
    governance: { exitMin: 60 * 24 * 2, peakMin: 60 * 6 }, // 2d exit, 6h peak
    unknown: { exitMin: 60 * 4, peakMin: 60 * 1 }, // 4h exit, 1h peak
  };

  const preset = presets[eventType] ?? presets.unknown;

  return {
    entryTime: now,
    exitWindowMin: preset.exitMin,
    peakTimeEstimate: now + preset.peakMin * 60 * 1000,
  };
}

// ---------------------------------------------------------------------------
// calculateConfidence — heuristic based on matched keyword + content volume
// ---------------------------------------------------------------------------

function calculateConfidence(
  matchedKeyword: string | null,
  addedLines: string[],
): number {
  let confidence = 30; // baseline for any detected change

  if (matchedKeyword) {
    confidence += 35;
  }

  // More added lines → more context → higher confidence (up to +20)
  const contentBonus = Math.min(addedLines.length * 5, 20);
  confidence += contentBonus;

  // Multiple keywords in the same text boost confidence
  const combined = addedLines.join(' ').toLowerCase();
  const uniqueTypes = new Set<EventType>();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) {
        uniqueTypes.add(rule.type);
        break;
      }
    }
  }
  if (uniqueTypes.size > 1) confidence += 10;

  return Math.min(confidence, 98);
}

// ---------------------------------------------------------------------------
// buildDescription — human-readable summary
// ---------------------------------------------------------------------------

function buildDescription(
  eventType: EventType,
  direction: Direction,
  tokens: string[],
  matchedKeyword: string | null,
  sampleText: string,
): string {
  const tokenStr = tokens.length > 0 ? tokens.join(', ') : 'market-wide';
  const dirStr =
    direction === 'bullish'
      ? 'potentially bullish'
      : direction === 'bearish'
        ? 'potentially bearish'
        : 'neutral';

  const trigger = matchedKeyword
    ? `detected "${matchedKeyword}"`
    : 'unspecified change';

  const sample =
    sampleText.length > 160 ? sampleText.slice(0, 157) + '...' : sampleText;

  return `${eventType.toUpperCase()} event — ${dirStr} for ${tokenStr}. Keyword ${trigger}. Excerpt: "${sample}"`;
}

// ---------------------------------------------------------------------------
// classifyEvent — the main entry point
// ---------------------------------------------------------------------------

export function classifyEvent(change: PageChange): Signal {
  // Combine all new content into one blob for analysis
  const combinedText = change.addedContent.join(' ');
  const analysis = classifyEventType(combinedText);
  const tokens = extractTokens(combinedText);
  const confidence = calculateConfidence(
    analysis.matchedKeyword,
    change.addedContent,
  );
  const momentum = estimateMomentumWindow(analysis.type);
  const sampleText = change.addedContent[0] ?? change.rawDiff.slice(0, 160);

  const description = buildDescription(
    analysis.type,
    analysis.direction,
    tokens,
    analysis.matchedKeyword,
    sampleText,
  );

  return {
    id: generateId('sig'),
    changeId: change.id,
    eventType: analysis.type,
    direction: analysis.direction,
    confidence,
    affectedTokens: tokens,
    description,
    momentumWindow: momentum,
    timestamp: change.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
