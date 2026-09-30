import type { MonthAlbum as MonthAlbumData } from './monthAlbumStats'
import { jacketColor } from './jacketColor'

// 月の見出しを「1枚のアルバム」として見せる。
// 棚に並ぶジャケットより目立たせない（主役は1杯ごとの記録）ので、高さは抑えめにする。
export default function MonthAlbum({ album }: { album: MonthAlbumData }) {
  const color = jacketColor(album.seed, album.roastLevel)

  return (
    <div className="flex items-center gap-3 pt-1">
      {/* 月のジャケット（その月のベストの一杯。写真が無ければ最も多かった産地の色） */}
      <div
        className="w-10 h-10 rounded-md overflow-hidden shrink-0 relative"
        style={{ background: color.bg }}
      >
        {album.photoUrl && (
          <img src={album.photoUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#F7EFE6] font-semibold tracking-wide truncate">{album.label}</p>
        <p className="text-[11px] text-[#A8916F]">
          {album.count}枚
          {album.avgRating != null && <>　★ {album.avgRating.toFixed(1)}</>}
        </p>
      </div>
    </div>
  )
}
