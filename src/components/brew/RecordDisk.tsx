import type { VinylPalette } from '../../db'

// Megroove 既定の盤（アイコンと同じ色）。色を選べるのは抽出中と保存演出だけで、
// それ以外の画面（ホーム・記録詳細・ツアー）はこの既定のまま。
const CLASSIC: VinylPalette = {
  disk: '#1a0a05',
  groove: '#2a1808',
  rim: '#3a2410',
  label: '#993C1D',
  labelText: '#F7EFE6',
  labelSub: '#CE9C68',
}

interface Props {
  size?: number
  /** 盤の色。省略時は Megroove 既定 */
  vinyl?: VinylPalette
}

export default function RecordDisk({ size = 120, vinyl = CLASSIC }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 縁取り: 背景（#1a0a05）と同系色の盤でも輪郭が分かるようにする */}
      <circle cx="60" cy="60" r="57" fill={vinyl.disk} stroke={vinyl.rim} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="50" fill="none" stroke={vinyl.groove} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="43" fill="none" stroke={vinyl.groove} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="36" fill="none" stroke={vinyl.groove} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="29" fill="none" stroke={vinyl.groove} strokeWidth="1.5" />
      {/* レーベルは全色ともコーラル固定。明るい盤でも文字のコントラストを保つため */}
      <circle cx="60" cy="60" r="22" fill={vinyl.label} stroke={vinyl.rim} strokeWidth="0.75" />
      <text x="60" y="57" textAnchor="middle" fill={vinyl.labelText} fontSize="12" fontFamily="system-ui" fontWeight="bold">M</text>
      <text x="60" y="68" textAnchor="middle" fill={vinyl.labelSub} fontSize="5" fontFamily="system-ui" letterSpacing="0.5">MEGROOVE</text>
      <circle cx="60" cy="60" r="3.5" fill="#0d0502" />
    </svg>
  )
}
