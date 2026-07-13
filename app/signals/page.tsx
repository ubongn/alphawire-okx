'use client';

import { useState, useMemo, useEffect } from 'react';

interface Signal {
  id: string;
  eventType: string;
  direction: string;
  confidence: number;
  affectedTokens: string[];
  description: string;
  timestamp: string;
  momentumWindow: {
    exitWindowMin: number;
    exitWindowHuman: string;
    peakTimeEstimate: string;
  };
}

const EVENT_TYPES = [
  'all',
  'listing',
  'delisting',
  'regulatory',
  'partnership',
  'hack',
  'policy',
  'earnings',
  'governance',
];

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/signals?limit=100')
      .then((r) => r.json())
      .then((data) => {
        setSignals(data.signals ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetch('/api/signals?limit=100')
        .then((r) => r.json())
        .then((data) => setSignals(data.signals ?? []))
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return signals;
    return signals.filter((s) => s.eventType === activeFilter);
  }, [signals, activeFilter]);

  return (
    <div className="container">
      <h1 className="section-title">Signal Feed</h1>
      <p className="section-subtitle">
        Real-time classified events from all monitored sources. Filter by event
        type to find actionable alpha.
      </p>

      {/* Filters */}
      <div className="filter-bar">
        {EVENT_TYPES.map((type) => (
          <button
            key={type}
            className={`filter-pill ${activeFilter === type ? 'active' : ''}`}
            onClick={() => setActiveFilter(type)}
          >
            {type === 'all' ? 'All Events' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Signal list */}
      {loading ? (
        <div className="empty-state">
          <p>Loading signals...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="signal-list">
          {filtered.map((sig) => (
            <div key={sig.id} className="signal-card">
              <span className={`signal-type-badge signal-type-${sig.eventType}`}>
                {sig.eventType}
              </span>
              <div className="signal-body">
                <div className="signal-desc">{sig.description}</div>
                <div className="signal-meta">
                  <span className={`signal-direction ${sig.direction}`}>
                    {sig.direction === 'bullish' ? '▲' : sig.direction === 'bearish' ? '▼' : '◆'}{' '}
                    {sig.direction}
                  </span>
                  <span className="signal-confidence">
                    {sig.confidence}% conf
                    <span className="confidence-bar">
                      <span
                        className="confidence-fill"
                        style={{ width: `${sig.confidence}%` }}
                      />
                    </span>
                  </span>
                  {sig.affectedTokens.length > 0 && (
                    <span>
                      {sig.affectedTokens.map((t) => (
                        <span key={t} className="signal-token">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                  <span>⏱ exit: {sig.momentumWindow.exitWindowHuman}</span>
                  <span>{new Date(sig.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card empty-state">
          <div className="empty-state-icon">📭</div>
          <p>
            {activeFilter === 'all'
              ? 'No signals detected yet. The monitoring engine is checking sources. Refresh in a moment.'
              : `No ${activeFilter} signals found. Try a different filter.`}
          </p>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        Showing {filtered.length} signal{filtered.length !== 1 ? 's' : ''}.
        Auto-refreshes every 30s.
      </div>
    </div>
  );
}
