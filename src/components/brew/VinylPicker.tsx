import type { RoastLevel, VinylColorId } from '../../db'
import { VINYL_COLORS, resolveVinyl } from '../../db'

interface Props {
  value: VinylColorId
  onChange: (id: VinylColorId) => void
  /** 「豆に合わせる」の見本に使う焙煎度（不明なら中煎り相当で描く） */
  roastLevel?: RoastLevel
}

// 盤の色を選ぶチップ列。抽出中の画面と設定画面の両方から使う。
export default function VinylPicker({ value, onChange, roastLevel }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {VINYL_COLORS.map(({ id, name }) => {
        const palette = resolveVinyl(id, roastLevel)
        const selected = id === value
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={selected}
            className={`min-h-11 pl-1.5 pr-3 rounded-full flex items-center gap-2 border transition-colors ${
              selected ? 'bg-[#3e3020] border-[#CE9C68]' : 'bg-[#2E2018] border-[#3e3020]'
            }`}
          >
            {/* 色見本は小さな盤（溝とレーベルまで描いて実物と対応させる） */}
            <span
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: palette.disk, border: `1px solid ${palette.rim}` }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: palette.label }}
              />
            </span>
            <span className={`text-xs ${selected ? 'text-[#F7EFE6] font-medium' : 'text-[#CE9C68]'}`}>
              {name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
