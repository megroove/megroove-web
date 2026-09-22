import RecordDisk from './RecordDisk'

// トーンアームの進行: 外周着地から4分（240秒）かけて最内周へ（超過後は留まる）。
// 針は装飾で、正確な時間は常に数字が主表示
const ARM_FULL_SEC = 240
const ARM_FULL_DEG = 18

// 基準サイズ（このサイズで位置を調整し、他のサイズは比率で拡縮する）
const BASE = 120

interface Props {
  elapsedSec: number
  size?: number
  /** 盤を回すか（false＝静止。計測していないときの見せ方） */
  spinning?: boolean
}

// 抽出中＝レコード再生。盤が回り、針が経過に応じて外周→内周へ進む
export default function Turntable({ elapsedSec, size = BASE, spinning = true }: Props) {
  const armDeg = Math.min(elapsedSec / ARM_FULL_SEC, 1) * ARM_FULL_DEG
  const k = size / BASE

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div style={spinning ? { animation: 'disk-spin 1.8s linear infinite' } : undefined}>
        <RecordDisk size={size} />
      </div>
      {/* トーンアーム: 外側=着地アニメ（arm-drop は fill:both のため進行 rotate とは要素を分ける） */}
      <div
        className="absolute"
        style={{
          top: -12 * k,
          right: -32 * k,
          width: 64 * k,
          height: 88 * k,
          animation: 'arm-drop 0.35s ease-in both',
          // px ではなく % で指定して、どのサイズでも同じ支点で回るようにする
          transformOrigin: '68.75% 13.64%',
        }}
      >
        {/* 内側=経過に応じて外周→内周へ回り込む */}
        <svg
          width={64 * k}
          height={88 * k}
          viewBox="0 0 64 88"
          style={{
            transform: `rotate(${armDeg}deg)`,
            transformOrigin: '68.75% 13.64%',
            transition: 'transform 0.3s linear',
          }}
        >
          <circle cx="44" cy="12" r="9" fill="#2E2018" stroke="#CE9C68" strokeWidth="1.5" />
          <circle cx="44" cy="12" r="3" fill="#CE9C68" />
          <line x1="44" y1="12" x2="26" y2="58" stroke="#CE9C68" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="26" y1="58" x2="18" y2="72" stroke="#CE9C68" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
