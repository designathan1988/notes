import { useId } from 'react';

/** The Mosaic tile pattern: rotated squares in the surrounding kind color (CSS `color`). */
export function MosaicPattern({ className, mark = false }: { className?: string; mark?: boolean }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern
          id={`mosaic-${id}`}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect x="2" y="2" width="16" height="16" rx="4" fill="currentColor" opacity=".11" />
          <rect x="22" y="2" width="16" height="16" rx="4" fill="currentColor" opacity=".21" />
          <rect x="2" y="22" width="16" height="16" rx="4" fill="currentColor" opacity=".05" />
          <rect x="22" y="22" width="16" height="16" rx="4" fill="currentColor" opacity=".15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#mosaic-${id})`} />
      {mark && (
        <g transform="translate(0 0)" className="mosaic-pattern-mark">
          <svg x="78%" y="50%" overflow="visible">
            <g transform="rotate(45)">
              <rect x="-21" y="-21" width="18" height="18" rx="4" fill="var(--brand-iris)" />
              <rect x="1" y="-21" width="18" height="18" rx="4" fill="var(--brand-rose)" />
              <rect x="1" y="1" width="18" height="18" rx="4" fill="var(--brand-amber)" />
              <rect x="-21" y="1" width="18" height="18" rx="4" fill="var(--brand-mint)" />
            </g>
          </svg>
        </g>
      )}
    </svg>
  );
}
