import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlphaWire — Front-Run the News',
  description:
    'Monitor crypto sources in real time, classify events with rule-based NLP, and monetize alpha signals via MCP + x402 payments.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper">
          <nav className="nav">
            <div className="nav-inner">
              <a href="/" className="nav-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="AlphaWire" height="24" />
              </a>
              <div className="nav-links">
                <a href="/signals" className="nav-link">Signals</a>
                <a href="/sources" className="nav-link">Sources</a>
                <a href="/docs" className="nav-link">API Docs</a>
              </div>
            </div>
          </nav>
          <main className="main">{children}</main>
          <footer className="footer">
            <div className="footer-inner">
              <span>AlphaWire — Front-Run the News</span>
              <span>Powered by x402 · MCP · X Layer</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
