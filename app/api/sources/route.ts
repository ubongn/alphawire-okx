import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { addSource } from '@/lib/monitor';

export const dynamic = 'force-dynamic';

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

  return NextResponse.json({ count: sources.length, sources });
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

    const source = addSource(url, name, intervalSec);

    return NextResponse.json({
      ok: true,
      source: {
        id: source.id,
        url: source.url,
        name: source.name,
        intervalSec: source.intervalSec,
        status: source.status,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
