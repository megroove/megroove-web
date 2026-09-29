import type { JacketColor } from './jacketColor'

interface Props {
  /** 写真があればジャケットの絵として使う。無ければ色地に文字だけ */
  photoUrl?: string
  color: JacketColor
  /** ジャケットに刷る主題（産地 or 豆名 or カフェ名） */
  title: string
  /** 同じく副題（品種・ドリンク名など） */
  subtitle?: string
  /** ジャケットの下に置く一行（豆名・抽出方法・日付） */
  caption: string
  rating?: number
  /** 評価待ち（まだ針を落としていない） */
  unrated?: boolean
  onClick: () => void
}

// 棚に並ぶ1枚。写真があれば写真、無ければ産地から導いた色で「ジャケット」を作る。
// 文字は色の上に載るので、色は jacketColor() 側でコントラストを担保してある。
export default function Jacket({
  photoUrl, color, title, subtitle, caption, rating, unrated, onClick,
}: Props) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left active:opacity-80">
      <div
        className="relative w-full aspect-square rounded-lg overflow-hidden flex flex-col justify-between p-2.5"
        style={{ background: color.bg }}
      >
        {photoUrl && (
          <>
            <img src={photoUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            {/* 写真の上でも文字が読めるよう、下半分に暗い膜をかける */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)' }}
            />
          </>
        )}

        <div className="relative min-w-0">
          <p className="text-sm font-bold leading-tight truncate" style={{ color: color.text }}>
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] leading-tight truncate mt-0.5" style={{ color: color.text, opacity: 0.82 }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="relative">
          {rating ? (
            <p className="text-[11px] tracking-tight" style={{ color: color.text }}>
              {'★'.repeat(rating)}
            </p>
          ) : unrated ? (
            <span
              className="inline-block text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.38)', color: color.text }}
            >
              評価待ち
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] text-[#A8916F] truncate mt-1.5 px-0.5">{caption}</p>
    </button>
  )
}
