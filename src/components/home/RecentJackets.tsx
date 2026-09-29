import type { JacketColor } from '../library/jacketColor'

export interface RecentJacketItem {
  id: string
  photoUrl?: string
  color: JacketColor
  rating?: number
  /** タイルの下に置く短い一行（日付）。タイルは 80px 前後なので名前は入らない */
  dateLabel: string
  onClick: () => void
}

interface Props {
  items: RecentJacketItem[]
  onSeeAll: () => void
}

// ホームの「最近の一枚」。棚（ライブラリ）と同じ色の考え方で、直近の記録を絵として並べる。
// タイルが小さいので**文字は載せず、絵と星だけ**にする（産地名を載せても確実に切れる）。
export default function RecentJackets({ items, onSeeAll }: Props) {
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#CE9C68] uppercase tracking-wider">最近の一枚</p>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs text-[#A8916F] -mr-1 px-1 py-1 active:opacity-70"
        >
          すべて見る →
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="w-full text-left active:opacity-80"
          >
            <div
              className="relative w-full aspect-square rounded-lg overflow-hidden flex items-end"
              style={{ background: item.color.bg }}
            >
              {item.photoUrl && (
                <img
                  src={item.photoUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {/* 星は絵の下端に置く。写真の上でも読めるよう、下側だけ暗い膜をかける */}
              {item.rating ? (
                <>
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/2"
                    style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.62) 100%)' }}
                  />
                  <p
                    className="relative w-full px-1 pb-1 text-[9px] leading-none tracking-tight text-center"
                    style={{ color: item.color.text }}
                  >
                    {'★'.repeat(item.rating)}
                  </p>
                </>
              ) : null}
            </div>
            <p className="text-[10px] text-[#A8916F] truncate mt-1 text-center">{item.dateLabel}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
