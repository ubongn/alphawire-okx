'use client';

import { useState, useEffect } from 'react';

interface Source {
  id: string;
  url: string;
  name: string;
  intervalSec: number;
  status: string;
  lastChecked: string | null;
  contentHash: string | null;
}

const QUICK_ADD = [
  { label: 'Binance Listings', url: 'https://www.binance.com/en/support/announcement/cryptocurrency-listing' },
  { label: 'Coinbase Blog', url: 'https://www.coinbase.com/blog' },
  { label: 'CoinDesk News', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { label: 'SEC EDGAR 8-K', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=20&output=atom' },
  { label: 'OKX Announcements', url: 'https://www.okx.com/support/hc/en-us/sections/360000514431' },
];

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [intervalSec, setIntervalSec] = useState('120');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [scanResult, setScanResult] = useState('');

  const fetchSources = () => {
    fetch('/api/sources')
      .then((r) => r.json())
      .then((data) => {
        setSources(data.sources ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || url.trim(),
          intervalSec: parseInt(intervalSec) || 120,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`✓ Added "${data.source.name}" — fetched ${data.source.contentHash ? '✓' : 'pending'}`);
        setUrl('');
        setName('');
        setIntervalSec('120');
        fetchSources();
      } else {
        setMessage(`✗ ${data.error || 'Failed to add source'}`);
      }
    } catch {
      setMessage('✗ Network error — is the server running?');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult('');
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setScanResult(`✓ Scanned ${data.sourcesScanned} sources — ${data.newSignals} new signal${data.newSignals !== 1 ? 's' : ''} detected`);
        fetchSources();
      } else {
        setScanResult('✗ Scan failed');
      }
    } catch {
      setScanResult('✗ Network error');
    } finally {
      setScanning(false);
    }
  };

  const quickAdd = (qUrl: string, qName: string) => {
    setUrl(qUrl);
    setName(qName);
  };

  return (
    <div className="container">
      <h1 className="section-title">Monitored Sources</h1>
      <p className="section-subtitle">
        Pages that AlphaWire continuously watches for changes. Add new sources
        to expand your alpha coverage.
      </p>

      {/* Quick add buttons */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center', fontWeight: 600 }}>
          Quick add:
        </span>
        {QUICK_ADD.map((q) => (
          <button
            key={q.url}
            onClick={() => quickAdd(q.url, q.label)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            + {q.label}
          </button>
        ))}
      </div>

      {/* Add source form */}
      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Add New Source
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">URL</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://example.com/announcements"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Name (optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="My Exchange Announcements"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Interval (seconds)</label>
              <input
                className="form-input"
                type="number"
                min="30"
                placeholder="120"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Adding & Fetching...' : 'Add Source'}
          </button>
          {message && (
            <span style={{ marginLeft: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
              {message}
            </span>
          )}
        </form>
      </div>

      {/* Source list */}
      {loading ? (
        <div className="empty-state">
          <p>Loading sources...</p>
        </div>
      ) : sources.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              {sources.length} Source{sources.length !== 1 ? 's' : ''}
            </h3>
            <button
              onClick={handleScan}
              className="btn btn-secondary"
              disabled={scanning}
              style={{ fontSize: 13, padding: '6px 16px' }}
            >
              {scanning ? 'Scanning...' : '⚡ Scan All Now'}
            </button>
          </div>
          {scanResult && (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {scanResult}
            </p>
          )}
          {sources.map((src) => (
            <div key={src.id} className="source-card">
              <div className="source-header">
                <span className="source-name">{src.name}</span>
                <span style={{ fontSize: 12 }}>
                  <span className={`status-dot ${src.status}`} />
                  {src.status}
                </span>
              </div>
              <div className="source-url">{src.url}</div>
              <div className="source-meta">
                <span>Every {src.intervalSec}s</span>
                <span>
                  Last checked:{' '}
                  {src.lastChecked
                    ? new Date(src.lastChecked).toLocaleString()
                    : 'Pending'}
                </span>
                <span>
                  Hash: {src.contentHash ? `…${src.contentHash.slice(-8)}` : '—'}
                </span>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="card empty-state">
          <p>No sources yet. Add one above or click a quick-add button to start monitoring.</p>
        </div>
      )}
    </div>
  );
}
