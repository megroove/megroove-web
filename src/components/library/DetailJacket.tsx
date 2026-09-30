import type { JacketColor } from './jacketColor'

interface Props {
  photoUrl?: string
  color: JacketColor
  /** アルバムのタイトルにあたるもの（豆名／銘柄） */
  title: string
  /** アーティスト行にあたるもの（産地・焙煎度・焙煎からの日数） */
  subtitle?: string
  /** リリース日にあたるもの */
  dateLabel: string
  rating?: number
  /** 写真があるときだけ。拡大表示を開く */
  onOpenPhoto?: () => void
}

// 記録詳細の冒頭。1杯の記録を「1枚のレコード」として提示する。
// 棚（ライブラリ）と同じ絵に揃えるので、写真の無い記録でもジャケットとして成立する。
export default function DetailJacket({
  photoUrl, color, title, subtitle, dateLabel, rating, onOpenPhoto,
}: Props) {
  const art = (
    <div
      className="relative w-full aspect-square rounded-xl overflow-hidden"
      style={{ background: color.bg }}
    >
      {photoUrl && (
        <img src={photoUrl} alt="記録の写真" className="absolute inset-0 w-full h-full object-cover" />
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* ジャケット。写真があるときはタップで拡大できる */}
      {photoUrl && onOpenPhoto ? (
        <button type="button" onClick={onOpenPhoto} className="w-full active:opacity-80">
          {art}
        </button>
      ) : (
        art
      )}

      <div>
        <p className="text-xl font-semibold text-[#F7EFE6] leading-snug">{title}</p>
        {subtitle && <p className="text-sm text-[#CE9C68] mt-1">{subtitle}</p>}
        <div className="flex items-baseline justify-between gap-3 mt-2">
          <p className="text-xs text-[#A8916F]">{dateLabel}</p>
          {rating ? (
            <p className="text-[#CE9C68] text-base tracking-tight">
              {'★'.repeat(rating)}<span className="text-[#3e3020]">{'★'.repeat(5 - rating)}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
