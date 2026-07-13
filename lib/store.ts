// ============================================================================
// AlphaWire — In-Memory Data Store
// ============================================================================
// A lightweight singleton store backed by plain Maps. In production you'd
// swap this for Postgres/Redis, but for a hackathon the in-memory approach
// keeps everything self-contained and instantly queryable.
// ============================================================================

import type { MonitoredSource, PageChange, Signal } from './types';

class DataStore {
  private sources = new Map<string, MonitoredSource>();
  private changes: PageChange[] = [];
  private signals: Signal[] = [];

  // --- Sources ------------------------------------------------------------

  getSource(id: string): MonitoredSource | undefined {
    return this.sources.get(id);
  }

  getSourceByUrl(url: string): MonitoredSource | undefined {
    const normalized = url.trim().toLowerCase();
    for (const src of this.sources.values()) {
      if (src.url.trim().toLowerCase() === normalized) return src;
    }
    return undefined;
  }

  getAllSources(): MonitoredSource[] {
    return Array.from(this.sources.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  getActiveSources(): MonitoredSource[] {
    return this.getAllSources().filter((s) => s.status === 'active');
  }

  addSource(src: MonitoredSource): void {
    this.sources.set(src.id, src);
  }

  updateSource(id: string, patch: Partial<MonitoredSource>): void {
    const existing = this.sources.get(id);
    if (!existing) return;
    this.sources.set(id, { ...existing, ...patch });
  }

  deleteSource(id: string): void {
    this.sources.delete(id);
  }

  // --- Changes ------------------------------------------------------------

  addChange(change: PageChange): void {
    this.changes.push(change);
    // Keep at most 500 recent changes
    if (this.changes.length > 500) {
      this.changes = this.changes.slice(-500);
    }
  }

  getChange(id: string): PageChange | undefined {
    return this.changes.find((c) => c.id === id);
  }

  getChangesBySource(sourceId: string): PageChange[] {
    return this.changes
      .filter((c) => c.sourceId === sourceId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAllChanges(): PageChange[] {
    return [...this.changes].sort((a, b) => b.timestamp - a.timestamp);
  }

  // --- Signals ------------------------------------------------------------

  addSignal(signal: Signal): void {
    this.signals.push(signal);
    if (this.signals.length > 500) {
      this.signals = this.signals.slice(-500);
    }
  }

  getSignal(id: string): Signal | undefined {
    return this.signals.find((s) => s.id === id);
  }

  getSignalsByToken(token: string): Signal[] {
    const upper = token.toUpperCase();
    return this.signals
      .filter((s) => s.affectedTokens.some((t) => t.toUpperCase() === upper))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getSignalsByType(eventType: string): Signal[] {
    return this.signals
      .filter((s) => s.eventType === eventType)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAllSignals(limit = 50): Signal[] {
    return [...this.signals]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // --- Stats --------------------------------------------------------------

  getStats() {
    return {
      sources: this.sources.size,
      activeSources: this.getActiveSources().length,
      changes: this.changes.length,
      signals: this.signals.length,
      recentSignals: this.signals.slice(-5).reverse(),
    };
  }
}

// Global singleton — survives HMR in dev, shared across all route handlers.
const globalForStore = globalThis as unknown as { __alphaStore?: DataStore };

export const store: DataStore =
  globalForStore.__alphaStore ?? new DataStore();

// Always attach to global so it persists within a serverless function's lifetime
globalForStore.__alphaStore = store;
