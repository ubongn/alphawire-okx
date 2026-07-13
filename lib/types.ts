// ============================================================================
// AlphaWire — Core Type Definitions
// ============================================================================

export interface MonitoredSource {
  id: string;
  url: string;
  name: string;
  intervalSec: number;
  lastChecked: number;
  contentHash: string;
  status: 'active' | 'paused';
  createdAt: number;
}

export interface PageChange {
  id: string;
  sourceId: string;
  url: string;
  timestamp: number;
  addedContent: string[];
  removedContent: string[];
  rawDiff: string;
}

export type EventType =
  | 'listing'
  | 'delisting'
  | 'regulatory'
  | 'partnership'
  | 'hack'
  | 'policy'
  | 'earnings'
  | 'governance'
  | 'unknown';

export type Direction = 'bullish' | 'bearish' | 'neutral';

export interface MomentumWindow {
  entryTime: number;
  exitWindowMin: number;
  peakTimeEstimate: number;
}

export interface Signal {
  id: string;
  changeId: string;
  eventType: EventType;
  direction: Direction;
  confidence: number;
  affectedTokens: string[];
  description: string;
  momentumWindow: MomentumWindow;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// MCP request/response types
// ---------------------------------------------------------------------------

export interface McpToolCall {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}
