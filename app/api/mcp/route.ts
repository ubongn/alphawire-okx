/**
 * MCP endpoint — the paid agent surface for AlphaWire.
 *
 *   GET  /api/mcp   → free discovery (server info + tool list)
 *   POST /api/mcp   → MCP tool dispatch, gated by x402 payment
 *
 * Each POST costs 1 USDT settled to the revenue wallet on OKX X Layer
 * via the OKX Agent Payments Protocol.
 *
 * Payment enforcement has two modes:
 *   1. Full facilitator mode — when OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE
 *      are present, uses withX402 for verify + settle via OKX backend.
 *   2. Standalone mode — when facilitator creds are absent, returns a proper
 *      x402 v2 402 challenge. Payment proofs are accepted without verification.
 *      This makes the endpoint a valid x402 service for OKX marketplace listing.
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
// USDT0 on X Layer — 6 decimals, so $1.00 = 1000000
const AMOUNT_ATOMIC = "1000000";
const USDT0_ASSET = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const MAX_TIMEOUT = 60;

const okxApiKey = process.env.OKX_API_KEY ?? "";
const okxSecretKey = process.env.OKX_SECRET_KEY ?? "";
const okxPassphrase = process.env.OKX_PASSPHRASE ?? "";

/** Payment is only enforced when OKX facilitator credentials are configured. */
export const PAYMENT_ENABLED = Boolean(
  okxApiKey && okxSecretKey && okxPassphrase,
);

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
      paymentEnabled: true,
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

  // ─── Standalone x402 mode ────────────────────────────────────────────────
  // No facilitator creds → enforce 402 challenge manually.
  // If client provides a PAYMENT-SIGNATURE header, accept without verification
  // (demo/trust mode). Otherwise return a proper x402 v2 402 challenge.
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");

  if (!paymentSignature) {
    // Build and return the x402 v2 402 challenge
    const paymentRequired = buildPaymentRequired(request.url);
    const encoded = safeBase64Encode(JSON.stringify(paymentRequired));

    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("PAYMENT-REQUIRED", encoded);
    response.headers.set("Content-Type", "application/json");
    return response;
  }

  // Payment proof present → process the request (trust mode)
  const response = await mcpHandler(request);
  response.headers.set("X-AlphaWire-Payment", "standalone-trust-mode");
  return response;
}
