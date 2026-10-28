// Minimal line icons (Lucide-style), drawn with currentColor so they follow the theme.

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function BarbellIcon() {
  return (
    <svg {...base}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </svg>
  )
}

export function StatsIcon() {
  return (
    <svg {...base}>
      <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function MenuIcon() {
  return (
    <svg {...base}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function PencilIcon() {
  return (
    <svg {...base}>
      <path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg {...base}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg {...base}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg {...base} width={18} height={18}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function RightIcon() {
  return (
    <svg {...base} width={18} height={18}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg {...base} width={16} height={16} className={spinning ? 'spin' : undefined}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...base} width={18} height={18}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function UpIcon() {
  return (
    <svg {...base} width={18} height={18}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

export function DownIcon() {
  return (
    <svg {...base} width={18} height={18}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
