# AlphaWire ⚡

> **Front-run the news.** Monitor critical crypto sources for changes, classify events into trading signals, and sell them to AI agents via MCP + x402 micropayments.

AlphaWire is an **Agent Service Provider (ASP)** for the [OKX.AI](https://okx.ai) marketplace. It continuously watches SEC filings, exchange announcements, and crypto media for page changes. When a change is detected, it classifies the event, extracts affected tokens, generates a directional trading signal with momentum exit timing, and exposes it to AI agents through a pay-per-call MCP endpoint.

---

## Why AlphaWire?

Markets move on information. The edge belongs to whoever detects change and acts on it first. AlphaWire automates the detection-to-signal pipeline:

| What humans do | What AlphaWire does |
|---|---|
| Refresh pages manually, miss changes | Monitors 50+ sources continuously via cron |
| Read the news, guess the impact | Classifies event type + direction automatically |
| React emotionally | Outputs structured signal + confidence score |
| Don't know when to exit | Calculates momentum window with exit timing |

---

## How It Works

### Three-Stage Pipeline

```
1. MONITOR          2. CLASSIFY              3. MONETIZE
┌──────────┐       ┌──────────────┐         ┌─────────────┐
│ 50+ web   │──────│ Rule-based   │─────────│ MCP API     │
│ sources   │ diff │ NLP engine   │ signal  │ x402 payment│
│ cron poll │──────│ keyword +NER │─────────│ 1 USDT/query│
└──────────┘       └──────────────┘         └─────────────┘
```

**Stage 1 — Monitor:** `node-cron` fetches each source on its interval. `cheerio` extracts text content, SHA-256 hashing detects changes, and line-level diffs capture what was added or removed.

**Stage 2 — Classify:** Rule-based NLP matches keywords to determine event type and market direction:

| Event Type | Direction | Example Keywords |
|---|---|---|
| **Listing** | 🟢 Bullish | "listing", "added", "new trading pair" |
| **Delisting** | 🔴 Bearish | "delisted", "removed", "terminated" |
| **Hack** | 🔴 Bearish | "exploit", "drained", "rug pull" |
| **Regulatory** | 🔴 Bearish | "sec charged", "lawsuit", "enforcement" |
| **Partnership** | 🟢 Bullish | "partnership", "integration", "collaboration" |
| **Policy** | ⚪ Neutral | "rate decision", "guidance", "proposed rule" |
| **Earnings** | ⚪ Neutral | "10-k", "quarterly report", "revenue" |
| **Governance** | ⚪ Neutral | "proposal", "snapshot", "dao vote" |

Then it extracts affected tokens via regex + known-tokens named entity recognition, assigns a confidence score (0-100), and estimates a **momentum window** — how long until the market prices this in and when to exit.

**Stage 3 — Monetize:** AI agents query MCP tools via `POST /api/mcp`. The x402 payment middleware returns HTTP 402 if unpaid. After settling payment on X Layer, the agent receives structured signal data.

---

## Monitored Sources

Seeded out of the box:

| Source | URL | Interval |
|--------|-----|----------|
| SEC EDGAR — 8-K Filings | `sec.gov/cgi-bin/browse-edgar` | 5 min |
| Coinbase — Listed Assets | `coinbase.com/price` | 10 min |
| Binance — Announcements | `binance.com/en/support/announcement` | 2 min |
| OKX — Announcements | `okx.com/support/hc/...` | 2 min |
| CoinDesk — RSS Feed | `coindesk.com/arc/outboundfeeds/rss` | 3 min |

Add more sources via the `/sources` dashboard or the `monitor_url` MCP tool.

---

## MCP Tools

AlphaWire exposes 5 MCP tools, callable via `POST /api/mcp`:

### `monitor_url`
Add a new page to the monitoring engine.

```json
{
  "tool": "monitor_url",
  "arguments": { "url": "https://example.com/announcements", "interval": 60 }
}
```

### `get_signals`
Query the latest trading signals with optional filters.

```json
{
  "tool": "get_signals",
  "arguments": { "limit": 10, "token": "BTC" }
}
```

### `get_event_detail`
Deep-dive into a specific signal — full diff, classification breakdown, momentum window.

```json
{
  "tool": "get_event_detail",
  "arguments": { "event_id": "sig_abc123" }
}
```

### `get_momentum_forecast`
Get the momentum window for an event type — entry timing, exit window, peak estimate.

```json
{
  "tool": "get_momentum_forecast",
  "arguments": { "event_type": "listing" }
}
```

### `list_monitored_sources`
List all pages currently being monitored.

```json
{
  "tool": "list_monitored_sources",
  "arguments": {}
}
```

---

## x402 Payment

| Property | Value |
|---|---|
| Payment scheme | `exact` (single-shot per call) |
| Price | $1.00 USDT0 per signal query, $0.50 for monitor setup |
| Network | `eip155:196` (X Layer) |
| Settlement token | USDT0 (`0x779ded0c9e1022225f8e0630b35a9b54be713736`) |
| Revenue wallet | `0xedcb1bd369a3ad9c940726149622327808816015` |

**Open mode:** When `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` are not set, the server runs in open mode (no payment enforcement) — useful for local development and testing. Set these env vars in production to enable x402 payment gating.

### Self-check

```bash
# Free discovery (no payment needed)
curl -i https://alphawire-okx.vercel.app/api/mcp

# Paid query — returns HTTP 402 without payment
curl -i -X POST https://alphawire-okx.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_signals", "arguments": {"limit": 5}}'
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     AlphaWire                          │
│                                                        │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │  Monitor     │───▶│  Classifier  │───▶│  Signal  │ │
│  │  Engine      │    │  (rule NLP)  │    │  Store   │ │
│  │              │    │              │    │          │ │
│  │  cheerio +   │    │  8 event     │    │  in-mem  │ │
│  │  cron + SHA  │    │  types + NER │    │  store   │ │
│  └─────────────┘    └──────────────┘    └────┬─────┘ │
│                                              │        │
│  ┌──────────────────────────────────────────▼─────┐  │
│  │              MCP Tool Layer                     │  │
│  │  monitor_url · get_signals · get_event_detail   │  │
│  │  get_momentum_forecast · list_monitored_sources │  │
│  └───────────────────────┬────────────────────────┘  │
│                           │                           │
│  ┌───────────────────────▼────────────────────────┐  │
│  │           x402 Payment Gateway                  │  │
│  │  1 USDT/query · X Layer · exact scheme          │  │
│  └───────────────────────┬────────────────────────┘  │
│                           │                           │
│                     POST /api/mcp                     │
└───────────────────────────┼───────────────────────────┘
                            │
                     AI Agent Client
                     (pays & queries)
```

### Tech Stack

- **Next.js 16** (App Router) — dashboard + API routes
- **TypeScript** — end-to-end type safety
- **OKX x402 SDK** (`@okxweb3/x402-next`, `x402-evm`, `x402-core`) — pay-per-call billing
- **cheerio** — HTML parsing and content extraction
- **node-cron** — scheduled source polling
- **@modelcontextprotocol/sdk** — MCP protocol implementation
- **Vercel** — deployment platform

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/ubongn/alphawire-okx.git
cd alphawire-okx
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Environment Variables

```env
# Optional: Enable x402 payment enforcement (leave empty for open/dev mode)
OKX_API_KEY=your_okx_api_key
OKX_SECRET_KEY=your_okx_secret_key
OKX_PASSPHRASE=your_okx_passphrase

# Optional: LLM-enhanced classification (falls back to rule-based)
LLM_API_KEY=your_llm_api_key
```

---

## Deployment

AlphaWire is deployed on **Vercel**:

- Dashboard: [https://alphawire-okx.vercel.app](https://alphawire-okx.vercel.app)
- MCP endpoint: `https://alphawire-okx.vercel.app/api/mcp`

---

## Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — what AlphaWire does, live signal feed |
| `/signals` | Real-time signal stream with filters by type and token |
| `/sources` | Monitored sources management — view, add, pause |
| `/docs` | Full API documentation with MCP tool specs |

---

## Project Structure

```
alphawire-okx/
├── app/
│   ├── api/mcp/route.ts    # x402-gated MCP endpoint
│   ├── api/signals/route.ts# Signals API (dashboard data)
│   ├── api/sources/route.ts# Sources API (dashboard data)
│   ├── page.tsx            # Landing page
│   ├── signals/page.tsx    # Signal feed
│   ├── sources/page.tsx    # Source management
│   ├── docs/page.tsx       # API documentation
│   ├── globals.css         # Light theme styles
│   └── layout.tsx          # Root layout
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── store.ts            # In-memory data store (singleton)
│   ├── monitor.ts          # Page monitoring engine (cron + cheerio + diff)
│   ├── classify.ts         # Rule-based event classifier + token NER
│   └── mcp-tools.ts        # MCP tool definitions and dispatcher
├── package.json
└── README.md
```

---

## License

MIT © 2026 [ubongn](https://github.com/ubongn)
