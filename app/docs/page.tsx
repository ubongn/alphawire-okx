export default function DocsPage() {
  return (
    <div className="container">
      <h1 className="section-title">API Documentation</h1>
      <p className="section-subtitle">
        AlphaWire exposes an MCP (Model Context Protocol) endpoint that AI
        agents can call to query trading signals. All requests require payment
        via the x402 protocol on X Layer.
      </p>

      {/* Overview */}
      <div className="docs-section">
        <h3>Endpoint</h3>
        <p>
          All MCP tool calls are sent as POST requests to{' '}
          <code className="code-inline">/api/mcp</code> with a JSON body
          containing the tool name and arguments.
        </p>
        <div className="code-block">{`POST /api/mcp
Content-Type: application/json

{
  "tool": "get_signals",
  "arguments": {
    "limit": 10,
    "token": "BTC"
  }
}`}</div>

        <h3 style={{ marginTop: 24 }}>Payment</h3>
        <p>
          The endpoint is gated by the x402 Payment Protocol. Unpaid requests
          receive HTTP 402 with payment instructions. After paying, the client
          replays the request with the payment header to receive the data.
        </p>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Signal Query</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
              1.00 USDT
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              get_signals, get_event_detail, get_momentum_forecast
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Monitor Setup</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
              0.50 USDT
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              monitor_url, list_monitored_sources
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <table className="param-table">
            <tbody>
              <tr>
                <td>Network</td>
                <td>X Layer (eip155:196)</td>
              </tr>
              <tr>
                <td>Token</td>
                <td>USDT0</td>
              </tr>
              <tr>
                <td>Revenue Wallet</td>
                <td>0xedcb1bd369a3ad9c940726149622327808816015</td>
              </tr>
              <tr>
                <td>Scheme</td>
                <td>exact (instant settlement)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tools */}
      <div className="docs-section">
        <h3>MCP Tools</h3>
        <p>Five tools available to AI agents:</p>

        {/* monitor_url */}
        <div className="tool-card">
          <div className="tool-name">monitor_url</div>
          <div className="tool-desc">
            Add a new URL to the monitoring engine. The page will be checked at
            the given interval.
          </div>
          <table className="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>url</td>
                <td>string</td>
                <td>Yes</td>
                <td>Full URL to monitor</td>
              </tr>
              <tr>
                <td>name</td>
                <td>string</td>
                <td>No</td>
                <td>Human-readable label</td>
              </tr>
              <tr>
                <td>intervalSec</td>
                <td>number</td>
                <td>No</td>
                <td>Check interval in seconds (min 30, default 120)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* get_signals */}
        <div className="tool-card">
          <div className="tool-name">get_signals</div>
          <div className="tool-desc">
            Retrieve the latest classified signals with optional filtering.
          </div>
          <table className="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>limit</td>
                <td>number</td>
                <td>No</td>
                <td>Max results (default 20, max 100)</td>
              </tr>
              <tr>
                <td>token</td>
                <td>string</td>
                <td>No</td>
                <td>Filter by token symbol (e.g. &quot;BTC&quot;)</td>
              </tr>
              <tr>
                <td>eventType</td>
                <td>string</td>
                <td>No</td>
                <td>Filter: listing, delisting, hack, regulatory, etc.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* get_event_detail */}
        <div className="tool-card">
          <div className="tool-name">get_event_detail</div>
          <div className="tool-desc">
            Deep-dive into a specific signal by ID. Returns the full PageChange
            diff and momentum window.
          </div>
          <table className="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>event_id</td>
                <td>string</td>
                <td>Yes</td>
                <td>Signal ID (e.g. &quot;sig_xyz123&quot;)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* get_momentum_forecast */}
        <div className="tool-card">
          <div className="tool-name">get_momentum_forecast</div>
          <div className="tool-desc">
            Get the momentum window forecast for an event type. Returns
            estimated exit window, peak time, and active status.
          </div>
          <table className="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>event_type</td>
                <td>string</td>
                <td>Yes</td>
                <td>Event type to forecast</td>
              </tr>
              <tr>
                <td>token</td>
                <td>string</td>
                <td>No</td>
                <td>Token symbol</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* list_monitored_sources */}
        <div className="tool-card">
          <div className="tool-name">list_monitored_sources</div>
          <div className="tool-desc">
            List all monitored sources with status, last-checked time, and
            content hash.
          </div>
          <table className="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>status</td>
                <td>string</td>
                <td>No</td>
                <td>Filter by &quot;active&quot; or &quot;paused&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Example flow */}
      <div className="docs-section">
        <h3>Example: Get Latest Signals</h3>
        <div className="code-block">{`# 1. Agent sends request (gets 402)
curl -X POST https://your-host/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"get_signals","arguments":{"limit":5}}'

# Response: 402 Payment Required
# Headers include payment requirements for 1 USDT on X Layer

# 2. Agent pays via x402 protocol
# (OKX Agent Payments Protocol handles signing + settlement)

# 3. Agent replays with payment header → gets signals
{
  "ok": true,
  "data": {
    "count": 5,
    "signals": [
      {
        "eventType": "listing",
        "direction": "bullish",
        "confidence": 85,
        "affectedTokens": ["BTC","SOL"],
        "momentumWindow": {
          "exitWindowHuman": "48.0h",
          "peakTimeEstimate": "2024-..."
        }
      }
    ]
  }
}`}</div>
      </div>

      {/* Momentum reference */}
      <div className="docs-section">
        <h3>Momentum Window Reference</h3>
        <table className="param-table">
          <thead>
            <tr>
              <th>Event Type</th>
              <th>Direction</th>
              <th>Exit Window</th>
              <th>Peak Estimate</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>listing</td><td>bullish</td><td>48 hours</td><td>6 hours</td></tr>
            <tr><td>delisting</td><td>bearish</td><td>4 hours</td><td>1 hour</td></tr>
            <tr><td>hack</td><td>bearish</td><td>2 hours</td><td>15 minutes</td></tr>
            <tr><td>regulatory</td><td>bearish</td><td>7 days</td><td>24 hours</td></tr>
            <tr><td>partnership</td><td>bullish</td><td>24 hours</td><td>3 hours</td></tr>
            <tr><td>policy</td><td>neutral</td><td>3 days</td><td>8 hours</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
