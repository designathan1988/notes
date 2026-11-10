/**
 * The Sinapta symbol: two nerve endings facing each other and the signal crossing the gap.
 * One colour, the text colour, with no tile; `size` is its height, the width follows (4:3).
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={(size * 4) / 3}
      height={size}
      viewBox="4 9 40 30"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="6.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 13.5c7.4 0 12.6 4.4 13.6 10.5-1 6.1-6.2 10.5-13.6 10.5" />
        <path d="M39.5 13.5c-7.4 0-12.6 4.4-13.6 10.5 1 6.1 6.2 10.5 13.6 10.5" />
      </g>
      <circle cx="24" cy="24" r="3.6" fill="currentColor" />
    </svg>
  );
}
