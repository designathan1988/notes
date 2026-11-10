import { useId } from 'react';

/** The Sinapta symbol: two nerve endings facing each other and the signal crossing the gap. */
export function BrandMark({ size = 24 }: { size?: number }) {
  const tile = useId();
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f3f46" />
          <stop offset="1" stopColor="#111113" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${tile})`} />
      <rect
        x="0.5"
        y="0.5"
        width="47"
        height="47"
        rx="12.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.12"
      />
      <g fill="none" stroke="#fff" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 13.5c7.4 0 12.6 4.4 13.6 10.5-1 6.1-6.2 10.5-13.6 10.5" />
        <path d="M39.5 13.5c-7.4 0-12.6 4.4-13.6 10.5 1 6.1 6.2 10.5 13.6 10.5" />
      </g>
      <circle cx="24" cy="24" r="3.6" fill="var(--brand-signal, #ffc247)" />
    </svg>
  );
}
