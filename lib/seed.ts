// ============================================================================
// AlphaWire — Seed Data
// ============================================================================
// Realistic signals so the dashboard is never empty on cold start.
// These represent the kind of events the monitoring engine detects in production.
// ============================================================================

import { store } from './store';
import type { Signal, MonitoredSource } from './types';

const NOW = Date.now();
const MIN = 60_000;
const HOUR = 3_600_000;

export function seedDemoData(): void {
  if (store.getAllSignals().length > 0) return;

  // --- Seed sources ---
  const sources: Omit<MonitoredSource, 'id' | 'createdAt'>[] = [
    { url: 'https://www.binance.com/en/support/announcement/cryptocurrency-listing', name: 'Binance — Listing Announcements', intervalSec: 120, lastChecked: NOW - 45_000, contentHash: 'a1b2c3d4e5f6a7b8', status: 'active' },
    { url: 'https://www.coinbase.com/blog', name: 'Coinbase — Blog', intervalSec: 300, lastChecked: NOW - 120_000, contentHash: 'f7e6d5c4b3a29180', status: 'active' },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk — RSS Feed', intervalSec: 180, lastChecked: NOW - 30_000, contentHash: '765482886be77ce4', status: 'active' },
    { url: 'https://www.sec.gov/cgi-bin/browse-edgar', name: 'SEC EDGAR — 8-K Filings', intervalSec: 600, lastChecked: NOW - 200_000, contentHash: '4ca55aac0a73b8dd', status: 'active' },
    { url: 'https://www.okx.com/support/hc/en-us/sections/360000514431', name: 'OKX — Announcements', intervalSec: 120, lastChecked: NOW - 60_000, contentHash: '9z8y7x6w5v4u3t2s', status: 'active' },
  ];

  for (const s of sources) {
    store.addSource({ ...s, id: `seed_src_${s.name.replace(/[^a-zA-Z]/g, '').slice(0, 10)}`, createdAt: NOW - HOUR });
  }

  // --- Seed signals ---
  const signals: Signal[] = [
    {
      id: 'sig_001',
      changeId: 'chg_001',
      eventType: 'listing',
      direction: 'bullish',
      confidence: 0.92,
      affectedTokens: ['ZRO', 'ETH'],
      description: 'Binance announces listing of LayerZero (ZRO) with USDT and USDC trading pairs. Trading opens immediately.',
      timestamp: NOW - 12 * MIN,
      momentumWindow: { entryTime: NOW - 12 * MIN, exitWindowMin: 180, peakTimeEstimate: NOW - 12 * MIN + 45 * MIN },
    },
    {
      id: 'sig_002',
      changeId: 'chg_002',
      eventType: 'regulatory',
      direction: 'bullish',
      confidence: 0.78,
      affectedTokens: ['BTC', 'ETH'],
      description: 'SEC approves spot Ethereum ETF applications from BlackRock and Fidelity. S-1 registration statements declared effective.',
      timestamp: NOW - 34 * MIN,
      momentumWindow: { entryTime: NOW - 34 * MIN, exitWindowMin: 480, peakTimeEstimate: NOW - 34 * MIN + 120 * MIN },
    },
    {
      id: 'sig_003',
      changeId: 'chg_003',
      eventType: 'delisting',
      direction: 'bearish',
      confidence: 0.88,
      affectedTokens: ['VIDT', 'JASMY'],
      description: 'OKX announces delisting of VIDT Datalink (VIDT) and JasmyCoin (JASMY) due to failure to meet listing criteria review.',
      timestamp: NOW - 58 * MIN,
      momentumWindow: { entryTime: NOW - 58 * MIN, exitWindowMin: 120, peakTimeEstimate: NOW - 58 * MIN + 30 * MIN },
    },
    {
      id: 'sig_004',
      changeId: 'chg_004',
      eventType: 'partnership',
      direction: 'bullish',
      confidence: 0.71,
      affectedTokens: ['LINK', 'CCIP'],
      description: 'Swift files 8-K disclosing partnership with Chainlink for cross-chain interbank settlement pilot covering 12 institutions.',
      timestamp: NOW - 95 * MIN,
      momentumWindow: { entryTime: NOW - 95 * MIN, exitWindowMin: 360, peakTimeEstimate: NOW - 95 * MIN + 90 * MIN },
    },
    {
      id: 'sig_005',
      changeId: 'chg_005',
      eventType: 'hack',
      direction: 'bearish',
      confidence: 0.95,
      affectedTokens: ['DEGEN', 'BASE'],
      description: 'Degen Bridge exploited for $2.3M. Attacker drained the bridge contract on Base. Withdrawals paused.',
      timestamp: NOW - 143 * MIN,
      momentumWindow: { entryTime: NOW - 143 * MIN, exitWindowMin: 60, peakTimeEstimate: NOW - 143 * MIN + 15 * MIN },
    },
    {
      id: 'sig_006',
      changeId: 'chg_006',
      eventType: 'listing',
      direction: 'bullish',
      confidence: 0.85,
      affectedTokens: ['ONDO', 'RWA'],
      description: 'Coinbase adds Ondo Finance (ONDO) to listing roadmap. RWA narrative tokens showing increased momentum.',
      timestamp: NOW - 187 * MIN,
      momentumWindow: { entryTime: NOW - 187 * MIN, exitWindowMin: 240, peakTimeEstimate: NOW - 187 * MIN + 60 * MIN },
    },
    {
      id: 'sig_007',
      changeId: 'chg_007',
      eventType: 'governance',
      direction: 'bullish',
      confidence: 0.66,
      affectedTokens: ['UNI', 'ARB'],
      description: 'Uniswap governance proposal UGP-42 passes with 89% approval. Allocates $20M to Arbitrum liquidity incentives.',
      timestamp: NOW - 256 * MIN,
      momentumWindow: { entryTime: NOW - 256 * MIN, exitWindowMin: 300, peakTimeEstimate: NOW - 256 * MIN + 75 * MIN },
    },
    {
      id: 'sig_008',
      changeId: 'chg_008',
      eventType: 'earnings',
      direction: 'bullish',
      confidence: 0.73,
      affectedTokens: ['MSTR', 'BTC'],
      description: 'MicroStrategy 8-K: Q2 earnings show additional 12,333 BTC acquired. Total holdings now exceed 226,500 BTC.',
      timestamp: NOW - 312 * MIN,
      momentumWindow: { entryTime: NOW - 312 * MIN, exitWindowMin: 480, peakTimeEstimate: NOW - 312 * MIN + 120 * MIN },
    },
  ];

  for (const sig of signals) {
    store.addSignal(sig);
  }

  console.log(`[seed] Seeded ${sources.length} sources and ${signals.length} signals`);
}
