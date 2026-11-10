import { t } from '../i18n/index.js';

const hubs = [
  {
    x: 150,
    y: 110,
    color: '#a297ff',
    label: 'Write in blocks',
    leaves: [
      [60, 60],
      [80, 170],
    ],
  },
  {
    x: 400,
    y: 120,
    color: '#f47fb1',
    label: 'Think on free-form canvases',
    leaves: [
      [480, 60],
      [490, 180],
    ],
  },
  {
    x: 390,
    y: 300,
    color: '#f5b83d',
    label: 'Organize in tables, boards and calendars',
    leaves: [
      [490, 350],
      [330, 380],
    ],
  },
  {
    x: 140,
    y: 300,
    color: '#4fd69a',
    label: 'See how everything connects',
    leaves: [
      [50, 340],
      [190, 385],
    ],
  },
] as const;

/** The product's own picture: four kinds of work joined around the Mosaic mark. */
export function AuthIllustration() {
  return (
    <svg className="auth-illustration" viewBox="0 0 540 410" aria-hidden="true">
      <defs>
        <filter id="auth-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <g stroke="#3a3750" strokeWidth="1.2">
        {hubs.map((hub) => (
          <g key={hub.label}>
            <line x1={270} y1={210} x2={hub.x} y2={hub.y} />
            {hub.leaves.map(([x, y]) => (
              <line key={`${x}-${y}`} x1={hub.x} y1={hub.y} x2={x} y2={y} />
            ))}
          </g>
        ))}
      </g>
      <g transform="translate(270 210) rotate(45)">
        <rect
          x="-44"
          y="-44"
          width="86"
          height="86"
          rx="18"
          fill="#8b7dff"
          filter="url(#auth-glow)"
          opacity=".4"
        />
        <rect x="-38" y="-38" width="35" height="35" rx="8" fill="var(--brand-iris)" />
        <rect x="3" y="-38" width="35" height="35" rx="8" fill="var(--brand-rose)" />
        <rect x="3" y="3" width="35" height="35" rx="8" fill="var(--brand-amber)" />
        <rect x="-38" y="3" width="35" height="35" rx="8" fill="var(--brand-mint)" />
      </g>
      {hubs.map((hub) => (
        <g key={hub.label}>
          <circle
            cx={hub.x}
            cy={hub.y}
            r="16"
            fill={hub.color}
            filter="url(#auth-glow)"
            opacity=".5"
          />
          <circle cx={hub.x} cy={hub.y} r="8" fill={hub.color} />
          {hub.leaves.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={hub.color} />
          ))}
          <text
            x={hub.x}
            y={hub.y < 200 ? hub.y - 22 : hub.y + 32}
            textAnchor="middle"
            fill="#edecf5"
            fontSize="13"
            fontWeight="500"
            paintOrder="stroke"
            stroke="#12111b"
            strokeWidth="5"
            strokeLinejoin="round"
          >
            {t(hub.label)}
          </text>
        </g>
      ))}
    </svg>
  );
}
