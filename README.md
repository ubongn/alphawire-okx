# AlphaWire — Front-Run the News

> Real-time crypto alpha intelligence: monitor → classify → monetize via MCP + x402 micropayments.

AlphaWire continuously watches SEC filings, exchange announcements, and crypto media for page changes, classifies them into actionable trading signals using rule-based NLP, and exposes those signals to AI agents through a Model Context Protocol (MCP) endpoint gated by x402 payments on X Layer.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Monitored   │────▶│  Page Change │────▶│  Classifier │────▶│   Signals    │
│   Sources    │     │   Detector   │     │ (Rule NLP)  │     │   (Store)    │
│  (cron)      │     │  (cheerio)   │     │             │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
                                                                    │
                                                     ┌──────────────▼──────────────┐
                                                     │   MCP API (POST /api/mcp)   │
                                                     │   x402 Payment Middleware   │
                                                     │   1 USDT / 0.50 USDT        │
                                                     └─────────────────────────────┘
```

### Pipeline

1. **Monitor** — `node-cron` fetches each source every 60 seconds. `cheerio` extracts text content, SHA-256 hashes detect changes, and line-level diffs capture what was added/removed.

2. **Classify** — Rule-based NLP matches keywords to event types (listing, delisting, hack, regulatory, partnership, policy, earnings, governance), assigns direction (bullish/bearish/neutral), extracts affected tokens via regex + known-tokens NER, estimates confidence, and computes a momentum window.

3. **Monetize** — AI agents call MCP tools via `POST /api/mcp`. The x402 payment middleware returns HTTP 402 if unpaid. After settling 1 USDT (queries) or 0.50 USDT (monitor setup) on X Layer, the agent receives structured signal data.

## Quick Start

```bash
# Install dependencies
npm install

# Run in development (custom Express server + Next.js)
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

The server starts on `http://localhost:3000`.

## Seeded Sources

| Source | URL | Interval |
|--------|-----|----------|
| SEC EDGAR — 8-K Filings | `sec.gov/cgi-bin/browse-edgar` | 5 min |
| Coinbase — Listed Assets | `coinbase.com/api/v2/assets` | 10 min |
| Binance — Listing Announcements | `binance.com/en/support/announcement` | 2 min |
| OKX — Announcements | `okx.com/support/hc/...` | 2 min |
| CoinDesk — RSS Feed | `coindesk.com/arc/outboundfeeds/rss` | 3 min |

Add more sources via the `/sources` page or the `monitor_url` MCP tool.

## MCP Tools

| Tool | Price | Description |
|------|-------|-------------|
| `monitor_url` | 0.50 USDT | Add a URL to the monitoring engine |
| `get_signals` | 1.00 USDT | Query latest signals (filter by token/type) |
| `get_event_detail` | 1.00 USDT | Deep-dive into a specific signal |
| `get_momentum_forecast` | 1.00 USDT | Momentum window for an event type |
| `list_monitored_sources` | 0.50 USDT | List all monitored sources |

### Example Request

```bash
# Get the tool manifest (free)
curl http://localhost:3000/api/mcp

# Query signals (requires x402 payment)
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_signals","arguments":{"limit":5,"token":"BTC"}}'
```

## Payment Configuration

| Setting | Value |
|---------|-------|
| Protocol | x402 (exact scheme) |
| Network | X Layer (`eip155:196`) |
| Token | USDT0 |
| Revenue Wallet | `0xedcb1bd369a3ad9c940726149622327808816015` |
| Facilitator | OKX x402 Facilitator |

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Server**: Express 5 + custom Next.js server
- **Monitoring**: cheerio (HTML parsing), node-cron (scheduling)
- **Classification**: Custom rule-based NLP with keyword matching + token NER
- **Payments**: `@okxweb3/x402-express` + `@okxweb3/x402-evm` + `@okxweb3/x402-core`
- **Agent Protocol**: `@modelcontextprotocol/sdk`

## Project Structure

```
alphawire-okx/
├── server.ts              # Custom Express server (x402 middleware + Next.js)
├── lib/
│   ├── types.ts           # Core TypeScript interfaces
│   ├── store.ts           # In-memory data store (singleton)
│   ├── monitor.ts         # Page monitoring engine (cron + cheerio + diff)
│   ├── classify.ts        # Rule-based event classifier + token NER
│   └── mcp-tools.ts       # MCP tool definitions and dispatcher
├── app/
│   ├── layout.tsx         # Root layout (light theme)
│   ├── page.tsx           # Landing page
│   ├── signals/page.tsx   # Signal feed with filters
│   ├── sources/page.tsx   # Source management UI
│   ├── docs/page.tsx      # API documentation
│   └── api/
│       ├── mcp/route.ts   # MCP endpoint (Next.js fallback)
│       ├── signals/route.ts
│       └── sources/route.ts
└── next.config.mjs
```

## License

MIT
