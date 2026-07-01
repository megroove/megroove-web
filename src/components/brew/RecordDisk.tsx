export default function RecordDisk({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="57" fill="#1a0a05" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="#2a1808" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="43" fill="none" stroke="#2a1808" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="#2a1808" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="29" fill="none" stroke="#2a1808" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="22" fill="#993C1D" />
      <text x="60" y="57" textAnchor="middle" fill="#F7EFE6" fontSize="12" fontFamily="system-ui" fontWeight="bold">M</text>
      <text x="60" y="68" textAnchor="middle" fill="#CE9C68" fontSize="5" fontFamily="system-ui" letterSpacing="0.5">MEGROOVE</text>
      <circle cx="60" cy="60" r="3.5" fill="#0d0502" />
    </svg>
  )
}
