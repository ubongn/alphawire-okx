import { store } from '@/lib/store';
import { seedDemoData } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  seedDemoData();
  const stats = store.getStats();
  const recentSignals = stats.recentSignals;

  return (
    <div className="container">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Live Alpha Intelligence
        </div>
        <h1>Front-Run the News.</h1>
        <p className="hero-subtitle">
          AlphaWire monitors SEC filings, exchange announcements, and crypto
          media in real time — classifies events into actionable trading
          signals with momentum windows, and exposes them to AI agents via MCP
          with x402 micropayments.
        </p>
        <div className="hero-cta">
          <a href="/signals" className="btn btn-primary">View Live Signals →</a>
          <a href="/docs" className="btn btn-secondary">API Documentation</a>
        </div>
      </section>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <div className="stat-value">{stats.sources}</div>
          <div className="stat-label">Monitored Sources</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.activeSources}</div>
          <div className="stat-label">Active Monitors</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.signals}</div>
          <div className="stat-label">Signals Generated</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">5</div>
          <div className="stat-label">MCP Tools</div>
        </div>
      </div>

      {/* How it works */}
      <section className="section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
          Three-stage pipeline from raw page changes to monetizable trading alpha.
        </p>
        <div className="grid-3">
          <div className="card card-hover">
            <div style={{ fontSize: 28, marginBottom: 12 }}>📡</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Monitor
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Continuously fetch and hash-monitored pages — SEC EDGAR, Coinbase,
              Binance, OKX, CoinDesk — detecting content changes in seconds.
            </p>
          </div>
          <div className="card card-hover">
            <div style={{ fontSize: 28, marginBottom: 12 }}>🧠</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Classify
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Rule-based NLP identifies event type (listing, hack, regulatory),
              direction (bullish / bearish), affected tokens, and confidence
              score.
            </p>
          </div>
          <div className="card card-hover">
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Monetize
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Signals are exposed to AI agents via MCP tools, gated behind x402
              micropayments on X Layer — 1 USDT per query, settled instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Live signal preview */}
      <section className="section">
        <h2 className="section-title">Latest Signals</h2>
        <p className="section-subtitle">
          The most recent events detected by the monitoring engine.
        </p>
        {recentSignals.length > 0 ? (
          <div className="signal-list">
            {recentSignals.map((sig) => (
              <div key={sig.id} className="signal-card">
                <span
                  className={`signal-type-badge signal-type-${sig.eventType}`}
                >
                  {sig.eventType}
                </span>
                <div className="signal-body">
                  <div className="signal-desc">{sig.description}</div>
                  <div className="signal-meta">
                    <span className={`signal-direction ${sig.direction}`}>
                      {sig.direction === 'bullish' ? '▲' : sig.direction === 'bearish' ? '▼' : '◆'}{' '}
                      {sig.direction}
                    </span>
                    <span>{sig.confidence}% confidence</span>
                    {sig.affectedTokens.length > 0 && (
                      <span>
                        {sig.affectedTokens.map((t) => (
                          <span key={t} className="signal-token">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                    <span>
                      {new Date(sig.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty-state">
            <div className="empty-state-icon">🔍</div>
            <p>
              No signals yet. The monitoring engine is booting up and checking
              sources for the first time. Check back shortly.
            </p>
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <a href="/signals" className="btn btn-secondary">
            View All Signals →
          </a>
        </div>
      </section>
    </div>
  );
}
