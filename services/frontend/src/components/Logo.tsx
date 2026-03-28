import React from 'react';

export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#lm-g)" />
      <text x="15" y="34" fontFamily="Georgia, serif" fontSize="26" fontStyle="italic" fontWeight="700" fill="white">i</text>
      <line x1="27" y1="20" x2="38" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <line x1="27" y1="29" x2="35" y2="29" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function LogoFull({ size = 28, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span style={{ fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 500, letterSpacing: '-0.02em', color: '#ededf4' }}>
        in<span style={{ color: '#a78bfa' }}>bounce</span>
      </span>
    </span>
  );
}
