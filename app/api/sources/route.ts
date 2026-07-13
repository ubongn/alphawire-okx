import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { addSource, checkSource, checkAllSources } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const sources = store.getAllSources().map((s) => ({
    id: s.id,
    url: s.url,
    name: s.name,
    intervalSec: s.intervalSec,
    status: s.status,
    lastChecked: s.lastChecked ? new Date(s.lastChecked).toISOString() : null,
    contentHash: s.contentHash ? s.contentHash.slice(0, 16) : null,
  }));

  const signalCount = store.getAllSignals(9999).length;

  return NextResponse.json({
    count: sources.length,
    signals: signalCount,
    sources,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = String(body.url ?? '').trim();
    const name = String(body.name ?? url);
    const intervalSec = Number(body.intervalSec ?? 120);

    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: url' },
        { status: 400 },
      );
    }

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { ok: false, error: 'URL must start with http:// or https://' },
        { status: 400 },
      );
    }

    // Add source and immediately fetch its content (synchronous)
    const source = addSource(url, name, intervalSec);

    // Wait for the initial fetch to complete
    await checkSource(source);

    const updated = store.getSource(source.id);

    return NextResponse.json({
      ok: true,
      source: {
        id: source.id,
        url: source.url,
        name: source.name,
        intervalSec: source.intervalSec,
        status: source.status,
        lastChecked: updated?.lastChecked
          ? new Date(updated.lastChecked).toISOString()
          : null,
        contentHash: updated?.contentHash
          ? updated.contentHash.slice(0, 16)
          : null,
        linesFetched: 'contentFetched' in source ? (source as any).contentFetched : undefined,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    );
  }
}

// --- Manual scan trigger -------------------------------------------------
export async function PUT() {
  const before = store.getAllSignals(9999).length;
  await checkAllSources();
  const after = store.getAllSignals(9999).length;

  return NextResponse.json({
    ok: true,
    scanned: store.getActiveSources().length,
    newSignals: after - before,
    totalSignals: after,
  });
}
