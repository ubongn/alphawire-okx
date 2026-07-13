import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { checkAllSources, seedSources } from '@/lib/monitor';
import { seedDemoData } from '@/lib/seed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/scan — manually trigger a scan of all monitored sources.
export async function POST() {
  seedDemoData();
  seedSources();

  const before = store.getAllSignals(9999).length;
  await checkAllSources();
  const after = store.getAllSignals(9999).length;

  return NextResponse.json({
    ok: true,
    sourcesScanned: store.getActiveSources().length,
    signalsBefore: before,
    signalsAfter: after,
    newSignals: after - before,
    sources: store.getAllSources().map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      status: s.status,
      lastChecked: s.lastChecked ? new Date(s.lastChecked).toISOString() : null,
      hasContentHash: Boolean(s.contentHash),
    })),
  });
}
