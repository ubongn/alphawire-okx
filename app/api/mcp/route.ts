/**
 * MCP endpoint — the paid agent surface for AlphaWire.
 *
 *   GET  /api/mcp   → free discovery (server info + tool list)
 *   POST /api/mcp   → MCP tool dispatch, gated by x402 payment
 *
 * Each POST costs 1 USDT settled to the revenue wallet on OKX X Layer
 * via the OKX Agent Payments Protocol.
 *
 * Until OKX facilitator credentials are present the route runs in "open"
 * mode so it works in dev / CI; production sets OKX_API_KEY / OKX_SECRET_KEY
 * / OKX_PASSPHRASE to enable payment enforcement.
 */

import { NextResponse, type NextRequest } from "next/server";
import { withX402, x402ResourceServer } from "@okxweb3/x402-next";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

import { dispatchMcpTool, getToolManifest } from "@/lib/mcp-tools";
import type { McpToolCall } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// --- x402 payment config ----------------------------------------------------
const PAY_TO = "0xedcb1bd369a3ad9c940726149622327808816015";
const NETWORK = "eip155:196" as const;
const PRICE = "$1.00";

const okxApiKey = process.env.OKX_API_KEY ?? "";
const okxSecretKey = process.env.OKX_SECRET_KEY ?? "";
const okxPassphrase = process.env.OKX_PASSPHRASE ?? "";

/** Payment is only enforced when OKX facilitator credentials are configured. */
export const PAYMENT_ENABLED = Boolean(
  okxApiKey && okxSecretKey && okxPassphrase,
);

// --- x402 facilitator + resource server -------------------------------------
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

// --- free discovery ---------------------------------------------------------
export async function GET() {
  return NextResponse.json({
    server: "AlphaWire MCP",
    version: "1.0.0",
    pricing: {
      scheme: "exact",
      price: PRICE,
      network: NETWORK,
      payTo: PAY_TO,
      paymentEnabled: PAYMENT_ENABLED,
    },
    endpoint: {
      tools: "POST /api/mcp",
      discovery: "GET /api/mcp",
    },
    tools: getToolManifest(),
  });
}

// --- paid MCP tool dispatch -------------------------------------------------
async function mcpHandler(request: NextRequest): Promise<NextResponse> {
  let body: McpToolCall;
  try {
    body = (await request.json()) as McpToolCall;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.tool) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Missing "tool" field. Available tools: monitor_url, get_signals, get_event_detail, get_momentum_forecast, list_monitored_sources',
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

// Wrap with x402 only when credentials are present; syncFacilitatorOnStart
// disabled so construction never makes a network call.
const paidHandler = PAYMENT_ENABLED
  ? withX402(mcpHandler, ROUTE_CONFIG, resourceServer, undefined, undefined, false)
  : null;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (paidHandler) {
    return paidHandler(request);
  }
  // Open mode (no facilitator creds configured) — still serve, but flag it.
  const response = await mcpHandler(request);
  response.headers.set("X-AlphaWire-Payment", "disabled-open-mode");
  return response;
}
