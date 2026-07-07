// レコード×コーヒーの世界観に合わせた自前ラインアイコン。
// OS依存の絵文字を使わず、全環境で同じ見た目・currentColor で着色できるようにする。

interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

function Svg({ size = 24, className, strokeWidth = 1.8, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </Svg>
  )
}

// レコード盤（ライブラリ / 表示モード）
export function DiscIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function StockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V8.5" />
      <path d="M10 12.5h4" />
    </Svg>
  )
}

export function AnalysisIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h16" />
      <path d="M7 20v-6" />
      <path d="M12 20V9" />
      <path d="M17 20v-9" />
    </Svg>
  )
}

export function CaffeineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2.5 5.5 13H11l-1 8.5L17.5 11H12l1-8.5z" />
    </Svg>
  )
}

// コーヒーカップ（真上から見た液面＋取っ手。アプリアイコンと同じモチーフ）
export function CupIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="12" r="7" />
      <circle cx="11" cy="12" r="3.2" />
      <path d="M18 9.5a3.2 3.2 0 0 1 0 5" />
    </Svg>
  )
}

export function CafeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 8.5 6 4h12l1 4.5" />
      <path d="M3.5 8.5h17" />
      <path d="M5 8.5V20h14V8.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </Svg>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9" />
    </Svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 7.5 9 5h6l1.5 2.5H20A1.5 1.5 0 0 1 21.5 9v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5h3.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.8 2.6 2.8 14.4 0 17-2.8-2.6-2.8-14.4 0-17z" />
    </Svg>
  )
}

export function TrophyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 5.5H4.5c.2 2.8 1.6 4.3 3.5 4.6" />
      <path d="M16 5.5h3.5c-.2 2.8-1.6 4.3-3.5 4.6" />
      <path d="M12 13v3.5" />
      <path d="M8.5 20c.5-2.3 1.8-3.5 3.5-3.5s3 1.2 3.5 3.5h-7z" />
    </Svg>
  )
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15" />
    </Svg>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </Svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m15.8 15.8 4.2 4.2" />
    </Svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5V14" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5" />
    </Svg>
  )
}

// 分析ランキング用の順位バッジ（🥇🥈🥉 の置き換え）
const RANK_COLORS = ['#d4a94e', '#a8a29e', '#b0764a']

export function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLORS[rank - 1] ?? '#6b5a4a'
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ border: `2px solid ${color}`, color }}
      aria-label={`${rank}位`}
    >
      {rank}
    </span>
  )
}
