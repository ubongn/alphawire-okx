import { NextResponse } from 'next/server';
import { dispatchMcpTool, getToolManifest } from '@/lib/mcp-tools';
import type { McpToolCall } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET — return the tool manifest (no payment needed for discovery)
export async function GET() {
  return NextResponse.json({
    server: 'AlphaWire MCP',
    version: '1.0.0',
    tools: getToolManifest(),
  });
}

// POST — dispatch a tool call.
// NOTE: When running via the custom Express server (server.ts), this route
// is guarded by the x402 payment middleware. When accessed directly via
// Next.js dev mode, payment is not enforced — useful for local testing.
export async function POST(request: Request) {
  let body: McpToolCall;

  try {
    body = (await request.json()) as McpToolCall;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.tool) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing "tool" field. Available tools: monitor_url, get_signals, get_event_detail, get_momentum_forecast, list_monitored_sources',
      },
      { status: 400 },
    );
  }

  const result = await dispatchMcpTool({
    tool: body.tool,
    arguments: body.arguments ?? {},
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
