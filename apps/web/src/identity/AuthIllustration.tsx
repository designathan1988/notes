import { t } from '../i18n/index.js';

const hubs = [
  {
    x: 150,
    y: 110,
    color: '#9dbcdb',
    label: 'Write in blocks',
    leaves: [
      [60, 60],
      [80, 170],
    ],
  },
  {
    x: 400,
    y: 120,
    color: '#ea94b6',
    label: 'Think on free-form canvases',
    leaves: [
      [480, 60],
      [490, 180],
    ],
  },
  {
    x: 390,
    y: 300,
    color: '#e8b54c',
    label: 'Organize in tables, boards and calendars',
    leaves: [
      [490, 350],
      [330, 380],
    ],
  },
  {
    x: 140,
    y: 300,
    color: '#93cba3',
    label: 'See how everything connects',
    leaves: [
      [50, 340],
      [190, 385],
    ],
  },
] as const;

/** The product's own picture: four kinds of work joined around the Sinapta mark. */
export function AuthIllustration() {
  return (
    <svg className="auth-illustration" viewBox="0 0 540 410" aria-hidden="true">
      <defs>
        <filter id="auth-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <g stroke="#3a3a40" strokeWidth="1.2">
        {hubs.map((hub) => (
          <g key={hub.label}>
            <line x1={270} y1={210} x2={hub.x} y2={hub.y} />
            {hub.leaves.map(([x, y]) => (
              <line key={`${x}-${y}`} x1={hub.x} y1={hub.y} x2={x} y2={y} />
            ))}
          </g>
        ))}
      </g>
      <circle cx="270" cy="210" r="30" fill="#f4f4f5" filter="url(#auth-glow)" opacity=".18" />
      <g transform="translate(270 210) scale(2.6) translate(-24 -24)">
        <g
          fill="none"
          stroke="#18181b"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8.5 13.5c7.4 0 12.6 4.4 13.6 10.5-1 6.1-6.2 10.5-13.6 10.5" />
          <path d="M39.5 13.5c-7.4 0-12.6 4.4-13.6 10.5 1 6.1 6.2 10.5 13.6 10.5" />
        </g>
        <g
          fill="none"
          stroke="#f4f4f5"
          strokeWidth="6.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8.5 13.5c7.4 0 12.6 4.4 13.6 10.5-1 6.1-6.2 10.5-13.6 10.5" />
          <path d="M39.5 13.5c-7.4 0-12.6 4.4-13.6 10.5 1 6.1 6.2 10.5 13.6 10.5" />
        </g>
        <circle cx="24" cy="24" r="3.6" fill="#f4f4f5" />
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
            fill="#f4f4f5"
            fontSize="13"
            fontWeight="500"
            paintOrder="stroke"
            stroke="#18181b"
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
