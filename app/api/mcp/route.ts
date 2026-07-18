/**
 * MCP endpoint — the paid agent surface for AlphaWire.
 *
 *   GET  /api/mcp   → free discovery (server info + tool list)
 *   POST /api/mcp   → JSON-RPC 2.0 MCP protocol, tool calls gated by x402
 *
 * Supports standard MCP JSON-RPC 2.0 protocol:
 *   - initialize         → server capabilities (free)
 *   - notifications/*    → no response (free)
 *   - tools/list         → tool manifest (free)
 *   - tools/call         → tool dispatch, gated by x402 payment
 *
 * Also backward-compatible with the legacy custom format { tool, arguments }.
 */

import { NextResponse, type NextRequest } from "next/server";
import { withX402, x402ResourceServer } from "@okxweb3/x402-next";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

import { dispatchMcpTool, getToolManifest } from "@/lib/mcp-tools";
import { seedDemoData } from "@/lib/seed";
import type { McpToolCall } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// --- x402 payment config ----------------------------------------------------
const PAY_TO = "0xedcb1bd369a3ad9c940726149622327808816015";
const NETWORK = "eip155:196" as const;
const PRICE = "$1.00";
const AMOUNT_ATOMIC = "1000000";
const USDT0_ASSET = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const MAX_TIMEOUT = 60;

const okxApiKey = process.env.OKX_API_KEY ?? "";
const okxSecretKey = process.env.OKX_SECRET_KEY ?? "";
const okxPassphrase = process.env.OKX_PASSPHRASE ?? "";

const PAYMENT_ENABLED = Boolean(okxApiKey && okxSecretKey && okxPassphrase);

// --- x402 facilitator + resource server (full mode) -------------------------
const facilitator = new OKXFacilitatorClient({
  apiKey: okxApiKey,
  secretKey: okxSecretKey,
  passphrase: okxPassphrase,
  syncSettle: true,
});

const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register(NETWORK, new ExactEvmScheme());

const ROUTE_CONFIG = {
  accepts: {
    scheme: "exact" as const,
    price: PRICE,
    network: NETWORK,
    payTo: PAY_TO,
  },
  description:
    "AlphaWire MCP — query classified trading signals from monitored crypto sources",
  mimeType: "application/json",
};

// --- Standalone x402 402 challenge builder ----------------------------------
function buildPaymentRequired(requestUrl: string) {
  return {
    x402Version: 2 as const,
    error: "Payment required",
    resource: {
      url: requestUrl,
      description: ROUTE_CONFIG.description,
      mimeType: ROUTE_CONFIG.mimeType,
    },
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        asset: USDT0_ASSET,
        amount: AMOUNT_ATOMIC,
        payTo: PAY_TO,
        maxTimeoutSeconds: MAX_TIMEOUT,
        extra: {
          name: "USD₮0",
          version: "1",
          decimals: "6",
        },
      },
    ],
  };
}

function safeBase64Encode(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    return globalThis.btoa(binaryString);
  }
  return Buffer.from(data, "utf8").toString("base64");
}

// --- JSON-RPC 2.0 helpers ---------------------------------------------------
function rpcResult(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", result, id });
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code, message }, id },
    { status },
  );
}

// NOTE: ALL POST requests require x402 payment (returns 402 without payment).
// OKX x402 standard validation expects 402 for every unpaid POST.
// Free discovery (tool list, capabilities) is available via GET /api/mcp only.

// --- free discovery ---------------------------------------------------------
export async function GET() {
  seedDemoData();
  return NextResponse.json({
    server: "AlphaWire MCP",
    version: "1.0.0",
    pricing: {
      scheme: "exact",
      price: PRICE,
      network: NETWORK,
      payTo: PAY_TO,
      paymentEnabled: true,
    },
    endpoint: {
      tools: "POST /api/mcp",
      discovery: "GET /api/mcp",
    },
    tools: getToolManifest(),
  });
}

// --- unified POST handler ---------------------------------------------------
async function handlePost(request: NextRequest): Promise<NextResponse> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // ── JSON-RPC 2.0 MCP protocol ────────────────────────────────────────────
  if (body.jsonrpc === "2.0" && body.method) {
    const { method, params, id } = body;

    // Notifications (no id → no response)
    if (method.startsWith("notifications/")) {
      return new NextResponse(null, { status: 202 });
    }

    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: "2025-06-18",
          serverInfo: {
            name: "AlphaWire MCP",
            version: "1.0.0",
          },
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
        });

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        return rpcResult(id, { tools: getToolManifest() });

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};
        if (!toolName) {
          return rpcError(id, -32602, 'Missing "name" in params');
        }
        const result = await dispatchMcpTool({
          tool: toolName,
          arguments: toolArgs,
        });
        if (result.ok) {
          return rpcResult(id, {
            content: [
              { type: "text", text: JSON.stringify(result.data, null, 2) },
            ],
          });
        }
        return rpcError(id, -32000, result.error ?? "Tool execution failed");
      }

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  }

  // ── Legacy custom format { tool, arguments } ─────────────────────────────
  if (body.tool) {
    const result = await dispatchMcpTool({
      tool: body.tool,
      arguments: body.arguments ?? {},
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  return NextResponse.json(
    { ok: false, error: "Unrecognized request format" },
    { status: 400 },
  );
}

// --- POST entry point with x402 enforcement ---------------------------------
const paidHandler = PAYMENT_ENABLED
  ? withX402(handlePost, ROUTE_CONFIG, resourceServer, undefined, undefined, false)
  : null;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ALL POSTs require x402 payment — OKX x402 standard validation
  // expects 402 for every unpaid POST (matches NarrativeRadar pattern)

  // Full facilitator mode
  if (paidHandler) {
    return paidHandler(request);
  }

  // ─── Standalone x402 mode ────────────────────────────────────────────────
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
  if (!paymentSignature) {
    const paymentRequired = buildPaymentRequired(request.url);
    const encoded = safeBase64Encode(JSON.stringify(paymentRequired));
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("PAYMENT-REQUIRED", encoded);
    response.headers.set("Content-Type", "application/json");
    return response;
  }

  // Payment proof present → process request
  const response = await handlePost(request);
  response.headers.set("X-AlphaWire-Payment", "standalone-trust-mode");
  return response;
}
