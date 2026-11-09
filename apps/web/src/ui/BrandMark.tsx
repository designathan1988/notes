/** The Mosaic symbol: four pieces forming one diamond, one per kind of content. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g transform="rotate(45 16 16)">
        <rect x="5" y="5" width="10" height="10" rx="2.2" fill="var(--brand-iris)" />
        <rect x="17" y="5" width="10" height="10" rx="2.2" fill="var(--brand-rose)" />
        <rect x="17" y="17" width="10" height="10" rx="2.2" fill="var(--brand-amber)" />
        <rect x="5" y="17" width="10" height="10" rx="2.2" fill="var(--brand-mint)" />
      </g>
    </svg>
  );
}
