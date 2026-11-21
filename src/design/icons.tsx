// Sade, kendi çizdiğimiz sekme ikonları (stroke tabanlı SVG).
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const IconToday = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="2" />
  </svg>
)

export const IconTrain = () => (
  <svg {...base}>
    <path d="M7 11V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v6a5 5 0 0 1-5 5h-1a4 4 0 0 1-4-4v-3z" />
    <path d="M7 11h6M10 18v3h5v-3" />
  </svg>
)

export const IconLibrary = () => (
  <svg {...base}>
    <path d="M4 4h5v16H4zM10 4h4v16h-4zM15 5l4 -1 3 15 -4 1z" />
  </svg>
)

export const IconProgress = () => (
  <svg {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

export const IconSettings = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </svg>
)
