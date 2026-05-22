'use client';

interface Props {
  pollCount: number;
  isPolling: boolean;
}

export default function TopNavbar({ pollCount, isPolling }: Props) {
  return (
    <header className="top-navbar">
      <button className="nav-hamburger" aria-label="เมนู">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <a className="nav-logo" href="#">
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="20" fill="#32a9ff" />
          <text x="20" y="26" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="sans-serif">S</text>
        </svg>
        <span className="nav-logo-text">Sellsuki</span>
      </a>

      <div className="nav-spacer" />

      <div
        className="poll-indicator"
        title={`Background polling ทุก 8 วินาที (รอบที่ ${pollCount})`}
      >
        <div className={`poll-dot${isPolling ? '' : ' paused'}`} />
        <span>Auto-refresh ({pollCount})</span>
      </div>

      <div className="nav-avatar" title="WW">WW</div>
    </header>
  );
}
