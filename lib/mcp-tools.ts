// ============================================================================
// AlphaWire — MCP Tool Definitions & Dispatcher
// ============================================================================
// Defines the Model Context Protocol tool surface that AI agents can call
// to interact with AlphaWire. Each tool has a JSON Schema and a handler.
// ============================================================================

import { store } from './store';
import { addSource } from './monitor';
import { estimateMomentumWindow } from './classify';
import type { McpToolCall, McpToolDef, McpToolResponse } from './types';

// ---------------------------------------------------------------------------
// Tool definitions — JSON Schema descriptors
// ---------------------------------------------------------------------------

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'monitor_url',
    description:
      'Add a new URL to the monitoring engine. The page will be checked at the given interval (in seconds, minimum 30). Returns the created MonitoredSource.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to monitor (https://…).',
        },
        name: {
          type: 'string',
          description: 'Human-readable label for this source.',
        },
        intervalSec: {
          type: 'number',
          description: 'Check interval in seconds (minimum 30). Default 120.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_signals',
    description:
      'Retrieve the latest classified signals. Optionally filter by token symbol or event type. Default limit is 20.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of signals to return (default 20, max 100).',
        },
        token: {
          type: 'string',
          description: 'Filter by token symbol (e.g. "BTC", "ETH").',
        },
        eventType: {
          type: 'string',
          description:
            'Filter by event type: listing, delisting, regulatory, partnership, hack, policy, earnings, governance, unknown.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_event_detail',
    description:
      'Get full detail for a specific signal by ID, including the underlying PageChange diff and momentum window.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'The signal ID (e.g. "sig_xyz123").',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'get_momentum_forecast',
    description:
      'Get the momentum window forecast for a given event type. Returns the estimated exit window, peak time, and whether the window is still active.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token symbol to check (e.g. "BTC").',
        },
        event_type: {
          type: 'string',
          description:
            'Event type: listing, delisting, hack, regulatory, partnership, etc.',
        },
      },
      required: ['event_type'],
    },
  },
  {
    name: 'list_monitored_sources',
    description:
      'List all monitored sources with their current status, last-checked time, and content hash.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status: "active" or "paused". Omit for all.',
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Dispatch — route a tool call to its handler
// ---------------------------------------------------------------------------

export async function dispatchMcpTool(
  call: McpToolCall,
): Promise<McpToolResponse> {
  const { tool, arguments: args } = call;

  try {
    switch (tool) {
      case 'monitor_url':
        return handleMonitorUrl(args);
      case 'get_signals':
        return handleGetSignals(args);
      case 'get_event_detail':
        return handleGetEventDetail(args);
      case 'get_momentum_forecast':
        return handleGetMomentumForecast(args);
      case 'list_monitored_sources':
        return handleListSources(args);
      default:
        return {
          ok: false,
          error: `Unknown tool: "${tool}". Available tools: ${MCP_TOOLS.map((t) => t.name).join(', ')}`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Tool "${tool}" failed: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleMonitorUrl(args: Record<string, unknown>): McpToolResponse {
  const url = String(args.url ?? '').trim();
  if (!url) {
    return { ok: false, error: 'Missing required parameter: url' };
  }

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'URL must start with http:// or https://' };
  }

  const name = String(args.name ?? url);
  const intervalSec = Number(args.intervalSec ?? 120);

  const source = addSource(url, name, intervalSec);

  return {
    ok: true,
    data: {
      id: source.id,
      url: source.url,
      name: source.name,
      intervalSec: source.intervalSec,
      status: source.status,
      message: `Now monitoring "${name}" every ${source.intervalSec}s`,
    },
  };
}

function handleGetSignals(args: Record<string, unknown>): McpToolResponse {
  const limit = Math.min(Number(args.limit ?? 20), 100);
  const token = args.token ? String(args.token).trim() : undefined;
  const eventType = args.eventType ? String(args.eventType).trim() : undefined;

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

  return {
    ok: true,
    data: {
      count: signals.length,
      signals: signals.map(formatSignal),
    },
  };
}

function handleGetEventDetail(
  args: Record<string, unknown>,
): McpToolResponse {
  const eventId = String(args.event_id ?? '').trim();
  if (!eventId) {
    return { ok: false, error: 'Missing required parameter: event_id' };
  }

  const signal = store.getSignal(eventId);
  if (!signal) {
    return { ok: false, error: `Signal not found: ${eventId}` };
  }

  const change = store.getChange(signal.changeId);

  return {
    ok: true,
    data: {
      signal: formatSignal(signal),
      pageChange: change
        ? {
            id: change.id,
            url: change.url,
            timestamp: new Date(change.timestamp).toISOString(),
            addedContent: change.addedContent.slice(0, 30),
            removedContent: change.removedContent.slice(0, 10),
            rawDiff: change.rawDiff,
          }
        : null,
    },
  };
}

function handleGetMomentumForecast(
  args: Record<string, unknown>,
): McpToolResponse {
  const eventType = String(args.event_type ?? '').trim();
  const token = args.token ? String(args.token).trim() : undefined;

  if (!eventType) {
    return { ok: false, error: 'Missing required parameter: event_type' };
  }

  const validTypes = [
    'listing', 'delisting', 'regulatory', 'partnership', 'hack',
    'policy', 'earnings', 'governance', 'unknown',
  ];
  if (!validTypes.includes(eventType)) {
    return {
      ok: false,
      error: `Invalid event_type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  const momentum = estimateMomentumWindow(eventType as any);
  const now = Date.now();
  const exitDeadline = momentum.entryTime + momentum.exitWindowMin * 60 * 1000;
  const isActive = now < exitDeadline;

  return {
    ok: true,
    data: {
      eventType,
      token: token ?? 'market-wide',
      momentumWindow: {
        entryTime: new Date(momentum.entryTime).toISOString(),
        peakTimeEstimate: new Date(momentum.peakTimeEstimate).toISOString(),
        exitWindowMin: momentum.exitWindowMin,
        exitWindowHuman: humanDuration(momentum.exitWindowMin),
        exitDeadline: new Date(exitDeadline).toISOString(),
        isActive,
      },
    },
  };
}

function handleListSources(args: Record<string, unknown>): McpToolResponse {
  const statusFilter = args.status ? String(args.status) : undefined;
  let sources = store.getAllSources();

  if (statusFilter === 'active' || statusFilter === 'paused') {
    sources = sources.filter((s) => s.status === statusFilter);
  }

  return {
    ok: true,
    data: {
      count: sources.length,
      sources: sources.map((s) => ({
        id: s.id,
        url: s.url,
        name: s.name,
        intervalSec: s.intervalSec,
        status: s.status,
        lastChecked: s.lastChecked
          ? new Date(s.lastChecked).toISOString()
          : null,
        contentHash: s.contentHash
          ? s.contentHash.slice(0, 16)
          : null,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatSignal(s: import('./types').Signal) {
  return {
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
      peakTimeEstimate: new Date(
        s.momentumWindow.peakTimeEstimate,
      ).toISOString(),
    },
  };
}

function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Tool listing for MCP initialize
// ---------------------------------------------------------------------------

export function getToolManifest() {
  return MCP_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 server (MCP protocol)
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = {
  name: 'alphawire',
  version: '1.0.0',
};
const CAPABILITIES = { tools: { listChanged: false } };

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function err(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** Dispatch a single JSON-RPC request. tools/call is async (tool execution). */
export async function handleJsonRpc(
  req: JsonRpcRequest,
): Promise<JsonRpcResponse> {
  const id = req.id ?? null;

  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
      });

    case 'initialized':
    case 'notifications/initialized':
      return ok(id, {});

    case 'tools/list':
      return ok(id, { tools: MCP_TOOLS });

    case 'tools/call': {
      const params = (req.params ?? {}) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
      const name = params.name;
      const args = params.arguments ?? {};

      if (!name) {
        return err(id, -32602, 'Missing required parameter: name');
      }

      const result = await dispatchMcpTool({ tool: name, arguments: args });

      return ok(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.ok,
      });
    }

    case 'ping':
      return ok(id, {});

    default:
      return err(id, -32601, `Method not found: ${req.method}`);
  }
}
