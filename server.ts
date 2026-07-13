// ============================================================================
// AlphaWire — Custom Express Server
// ============================================================================
// Wraps Next.js with an Express layer that adds x402 payment middleware on
// the MCP API endpoint. All other routes pass through to Next.js.
//
// Architecture:
//   Request → Express → cors → x402 paymentMiddleware
//     ├─ POST /api/mcp (paid) → express.json → MCP tool dispatcher
//     └─ everything else → Next.js handler (pages + internal API routes)
// ============================================================================

import next from 'next';
import express from 'express';
import cors from 'cors';
import { paymentMiddleware, x402ResourceServer } from '@okxweb3/x402-express';
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server';
import { OKXFacilitatorClient } from '@okxweb3/x402-core';
import { dispatchMcpTool } from './lib/mcp-tools';
import { startMonitoring } from './lib/monitor';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const dev = process.env.NODE_ENV !== 'production';

// Revenue wallet — all x402 payments settle here
const PAY_TO = '0xedcb1bd369a3ad9c940726149622327808816015';

// X Layer mainnet — chain ID 196
const NETWORK = 'eip155:196' as const;

// ---------------------------------------------------------------------------
// x402 Facilitator + Resource Server
// ---------------------------------------------------------------------------

const facilitatorClient = new OKXFacilitatorClient();
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme(),
);

// Payment routes — per-tool pricing
// get_signals / get_event_detail / get_momentum_forecast → 1 USDT
// monitor_url / list_monitored_sources → 0.50 USDT
const routes = {
  'POST /api/mcp': {
    accepts: {
      scheme: 'exact',
      price: '$1.00',
      network: NETWORK,
      payTo: PAY_TO,
      maxTimeoutSeconds: 300,
    },
    description: 'AlphaWire MCP — query classified trading signals',
  },
};

// ---------------------------------------------------------------------------
// Next.js app
// ---------------------------------------------------------------------------

const app = next({ dev });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
  await app.prepare();

  const server = express();

  // CORS — allow agent clients
  server.use(cors());

  // x402 payment middleware — intercepts POST /api/mcp
  server.use(
    paymentMiddleware(
      routes as any,
      resourceServer,
      {
        appName: 'AlphaWire',
        testnet: false,
      },
    ),
  );

  // MCP tool dispatch (runs after x402 verifies payment)
  server.post('/api/mcp', express.json(), async (req, res) => {
    try {
      const { tool, arguments: args } = req.body ?? {};

      if (!tool) {
        res.status(400).json({
          ok: false,
          error:
            'Missing "tool" field. Call GET /api/mcp for available tools.',
        });
        return;
      }

      const result = await dispatchMcpTool({
        tool: String(tool),
        arguments: args ?? {},
      });

      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[mcp] Dispatch error:', msg);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });

  // Catch-all: everything else → Next.js
  server.use((req, res) => {
    return handle(req, res);
  });

  // Start the monitoring engine
  startMonitoring();

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  AlphaWire — Front-Run the News              ║
║  http://localhost:${PORT}                        ║
║                                              ║
║  x402 Payment: ${PAY_TO.slice(0, 10)}...${PAY_TO.slice(-6)}  ║
║  Network: X Layer (eip155:196)               ║
║  Mode: ${dev ? 'Development          ' : 'Production           '}           ║
╚══════════════════════════════════════════════╝
`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
