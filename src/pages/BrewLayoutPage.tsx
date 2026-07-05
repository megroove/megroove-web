import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BrewBlockId, BrewLayoutSettings } from '../db'
import { loadBrewLayout, saveBrewLayout, DEFAULT_BREW_LAYOUT, BREW_BLOCK_LABELS } from '../db'

const BLOOM_MIN = 10
const BLOOM_MAX = 120
const BLOOM_STEP = 5

export default function BrewLayoutPage() {
  const navigate = useNavigate()
  const [layout, setLayout] = useState<BrewLayoutSettings>(loadBrewLayout)

  const updateLayout = (next: BrewLayoutSettings) => {
    setLayout(next)
    saveBrewLayout(next)
  }

  const bloomTimeSec = layout.bloomTimeSec ?? 30

  const changeBloomTime = (delta: number) => {
    const next = Math.min(BLOOM_MAX, Math.max(BLOOM_MIN, bloomTimeSec + delta))
    updateLayout({ ...layout, bloomTimeSec: next })
  }

  const changeZone = (id: BrewBlockId, zone: 'main' | 'detail' | 'hidden') => {
    const next: BrewLayoutSettings = {
      main:   layout.main.filter(x => x !== id),
      detail: layout.detail.filter(x => x !== id),
      hidden: layout.hidden.filter(x => x !== id),
    }
    next[zone] = [...next[zone], id]
    updateLayout(next)
  }

  const moveInZone = (id: BrewBlockId, dir: -1 | 1) => {
    const zone = (
      layout.main.includes(id) ? 'main' :
      layout.detail.includes(id) ? 'detail' : 'hidden'
    ) as 'main' | 'detail' | 'hidden'
    const arr = [...layout[zone]]
    const idx = arr.indexOf(id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= arr.length) return
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    updateLayout({ ...layout, [zone]: arr })
  }

  const resetLayout = () => {
    updateLayout({
      main:   [...DEFAULT_BREW_LAYOUT.main],
      detail: [...DEFAULT_BREW_LAYOUT.detail],
      hidden: [],
    })
  }

  const renderZoneSection = (
    zone: 'main' | 'detail' | 'hidden',
    title: string,
    blocks: BrewBlockId[],
  ) => (
    <div key={zone} className="bg-[#2E2018] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-[#3e3020]">
        <p className="text-xs text-[#CE9C68] font-medium">{title}</p>
      </div>

      {zone === 'main' && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3020]">
          <span className="text-sm text-[#6b5a4a]">豆</span>
          <span className="text-xs bg-[#3e3020] text-[#4a3a2a] px-2 py-0.5 rounded-full">固定</span>
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="px-4 py-3 text-xs text-[#4a3a2a] text-center">
          {zone === 'hidden' ? '非表示の項目はありません' : '項目がありません'}
        </div>
      ) : (
        blocks.map((id, idx) => (
          <div key={id} className="flex items-center px-3 py-3 gap-2 border-b border-[#3e3020] last:border-0">
            {zone !== 'hidden' ? (
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveInZone(id, -1)}
                  className="w-6 h-5 flex items-center justify-center text-[10px] text-[#CE9C68] disabled:text-[#3e3020]"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={idx === blocks.length - 1}
                  onClick={() => moveInZone(id, 1)}
                  className="w-6 h-5 flex items-center justify-center text-[10px] text-[#CE9C68] disabled:text-[#3e3020]"
                >
                  ▼
                </button>
              </div>
            ) : (
              <div className="w-6 shrink-0" />
            )}

            <span className="flex-1 text-sm text-[#F7EFE6]">{BREW_BLOCK_LABELS[id]}</span>

            <div className="flex gap-1.5 shrink-0">
              {zone !== 'main' && (
                <button
                  type="button"
                  onClick={() => changeZone(id, 'main')}
                  className="text-xs text-[#CE9C68] px-2 py-1 rounded-lg bg-[#3e3020] active:opacity-70"
                >
                  メインへ
                </button>
              )}
              {zone !== 'detail' && (
                <button
                  type="button"
                  onClick={() => changeZone(id, 'detail')}
                  className="text-xs text-[#CE9C68] px-2 py-1 rounded-lg bg-[#3e3020] active:opacity-70"
                >
                  詳細へ
                </button>
              )}
              {zone !== 'hidden' && (
                <button
                  type="button"
                  onClick={() => changeZone(id, 'hidden')}
                  className="text-xs text-[#6b5a4a] px-2 py-1 rounded-lg bg-[#3e3020] active:opacity-70"
                >
                  非表示
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm shrink-0">
          ← 戻る
        </button>
        <h2 className="text-xl font-semibold text-[#F7EFE6]">記録画面のカスタマイズ</h2>
      </div>

      <p className="text-xs text-[#6b5a4a]">
        各項目をメイン表示・詳細（折りたたみ内）・非表示に振り分けられます。「豆」は固定です。
      </p>

      {renderZoneSection('main',   'メイン表示（常時表示）',   layout.main)}
      {renderZoneSection('detail', '詳細表示（折りたたみ内）', layout.detail)}
      {layout.hidden.length > 0 &&
        renderZoneSection('hidden', '非表示', layout.hidden)
      }

      {/* 蒸らしタイマー設定 */}
      <div className="bg-[#2E2018] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-[#3e3020]">
          <p className="text-xs text-[#CE9C68] font-medium">蒸らしタイマー</p>
        </div>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-[#F7EFE6]">カスタム時間</p>
            <p className="text-xs text-[#6b5a4a] mt-0.5">記録画面のタイマーで最初に選択される時間</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeBloomTime(-BLOOM_STEP)}
              disabled={bloomTimeSec <= BLOOM_MIN}
              className="w-8 h-8 rounded-full bg-[#3e3020] text-[#CE9C68] text-lg flex items-center justify-center disabled:text-[#3e3020] active:opacity-70"
            >
              −
            </button>
            <span className="text-[#F7EFE6] font-semibold tabular-nums text-base w-14 text-center">
              {bloomTimeSec}秒
            </span>
            <button
              type="button"
              onClick={() => changeBloomTime(BLOOM_STEP)}
              disabled={bloomTimeSec >= BLOOM_MAX}
              className="w-8 h-8 rounded-full bg-[#3e3020] text-[#CE9C68] text-lg flex items-center justify-center disabled:text-[#3e3020] active:opacity-70"
            >
              ＋
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetLayout}
        className="text-xs text-[#6b5a4a] py-1.5 text-center underline"
      >
        デフォルトに戻す
      </button>
    </div>
  )
}
