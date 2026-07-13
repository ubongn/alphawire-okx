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

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [intervalSec, setIntervalSec] = useState('120');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

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
        setMessage(`✓ Added "${data.source.name}" to monitoring`);
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

  return (
    <div className="container">
      <h1 className="section-title">Monitored Sources</h1>
      <p className="section-subtitle">
        Pages that AlphaWire continuously watches for changes. Add new sources
        to expand your alpha coverage.
      </p>

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
            {submitting ? 'Adding...' : 'Add Source'}
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
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {sources.length} Source{sources.length !== 1 ? 's' : ''}
          </h3>
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
          <p>No sources yet. Add one above to start monitoring.</p>
        </div>
      )}
    </div>
  );
}
