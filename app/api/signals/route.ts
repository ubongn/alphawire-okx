import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const token = searchParams.get('token');
  const eventType = searchParams.get('eventType');

  let signals;

  if (token && eventType) {
    signals = store
      .getSignalsByToken(token)
      .filter((s) => s.eventType === eventType)
      .slice(0, limit);
  } else if (token) {
    signals = store.getSignalsByToken(token).slice(0, limit);
  } else if (eventType) {
    signals = store.getSignalsByType(eventType).slice(0, limit);
  } else {
    signals = store.getAllSignals(limit);
  }

  const formatted = signals.map((s) => ({
    id: s.id,
    eventType: s.eventType,
    direction: s.direction,
    confidence: s.confidence,
    affectedTokens: s.affectedTokens,
    description: s.description,
    timestamp: new Date(s.timestamp).toISOString(),
    momentumWindow: {
      exitWindowMin: s.momentumWindow.exitWindowMin,
      exitWindowHuman: humanDuration(s.momentumWindow.exitWindowMin),
      peakTimeEstimate: new Date(s.momentumWindow.peakTimeEstimate).toISOString(),
    },
  }));

  return NextResponse.json({ count: formatted.length, signals: formatted });
}

function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}
