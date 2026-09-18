import { useMemo, useState } from 'react'
import type { Bean, Brew, QuickTweakKey } from '../../db'
import {
  BREW_METHOD_LABELS, DRIP_BAG_DOSE_G, QUICK_TWEAK_LIMITS,
  calcRatio, clampTweakValue, estimateCaffeine, loadSettings, predictBedtimeResidual,
} from '../../db'
import StarRating from './StarRating'

// プリセット = 「この条件で淹れる」1枚。実体は直近でその条件を使った記録なので、
// 豆・器具・飲み方までまるごと引き継げる（レシピの既定値だけでは足りない情報が入っている）
export interface QuickPreset {
  id: string
  name: string     // 「前回と同じ」 または レシピ名
  brew: Brew       // コピー元の記録
  bean?: Bean
}

export interface QuickSaveInput {
  preset: QuickPreset
  doseG?: number
  waterG?: number
  tempC?: number
  grindSize?: number
  rating: number   // 0 = 未評価（評価待ちに入る）
}

interface Props {
  presets: QuickPreset[]
  recentIntakes: { caffeineAmount: number; brewedAt: string }[]
  saving: boolean
  onSave: (input: QuickSaveInput) => void
  onDetail: () => void
  onClose: () => void
}

const TWEAK_ORDER: QuickTweakKey[] = ['doseG', 'waterG', 'tempC', 'grindSize']

// 星の一言（モックの文言に合わせる）
const STAR_LABELS = ['未評価', 'いまひとつ', 'ふつう', 'おいしい', 'また淹れたい', '今年のベスト級']

// プリセットの色見本。焙煎度から導く（P4「盤の色＝豆に合わせる」と同じ考え方）
const ROAST_SWATCH: Record<string, string> = {
  'light':        '#C98A54',
  'light-medium': '#BE7A42',
  'medium':       '#A9622F',
  'medium-dark':  '#834B26',
  'dark':         '#5E351B',
}

function formatTweak(key: QuickTweakKey, value: number): string {
  return `${value}${QUICK_TWEAK_LIMITS[key].unit}`
}

export default function QuickBrewSheet({
  presets, recentIntakes, saving, onSave, onDetail, onClose,
}: Props) {
  const [presetIndex, setPresetIndex] = useState(0)
  const preset = presets[presetIndex] ?? presets[0]

  // 「今日だけ変えたところ」の現在値。プリセットを選び直すとその条件に戻る
  const baseValues = useMemo(() => ({
    doseG:     preset?.brew.doseG,
    waterG:    preset?.brew.waterG,
    tempC:     preset?.brew.tempC,
    grindSize: preset?.brew.grindSize,
  }), [preset])

  const [values, setValues] = useState(baseValues)
  const [openTweak, setOpenTweak] = useState<QuickTweakKey | null>(null)
  const [rating, setRating] = useState(0)

  const pickPreset = (i: number) => {
    const next = presets[i]
    if (!next) return
    setPresetIndex(i)
    setValues({
      doseG:     next.brew.doseG,
      waterG:    next.brew.waterG,
      tempC:     next.brew.tempC,
      grindSize: next.brew.grindSize,
    })
    setOpenTweak(null)
  }

  const isDripBag = preset?.brew.method === 'drip_bag'
  // ドリップバッグは粉量・挽き目を自分で決めないので、記録画面と同じく出さない
  const tweakKeys = TWEAK_ORDER.filter(k => {
    if (isDripBag && (k === 'doseG' || k === 'grindSize')) return false
    return values[k] != null
  })

  const step = (key: QuickTweakKey, dir: 1 | -1) => {
    const cur = values[key]
    if (cur == null) return
    const { step: s } = QUICK_TWEAK_LIMITS[key]
    setValues(v => ({ ...v, [key]: clampTweakValue(key, cur + dir * s, cur) }))
  }

  // 就寝時の推定残留量（記録画面と同じ関数を使う。変更後の粉量で再計算される）
  const prediction = useMemo(() => {
    const settings = loadSettings()
    const mg = isDripBag
      ? estimateCaffeine(DRIP_BAG_DOSE_G, preset?.bean?.decaf)
      : values.doseG != null ? estimateCaffeine(values.doseG, preset?.bean?.decaf) : null
    const p = predictBedtimeResidual(recentIntakes, mg, settings)
    return p ? { ...p, targetMg: settings.bedtimeTargetMg } : null
  }, [isDripBag, values.doseG, preset?.bean, recentIntakes])

  // プリセットが無いときは何も出さない（呼び出し側でも件数を見ているが、念のため）
  if (!preset) return null

  const now = new Date()

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg px-5 pt-2 pb-8 max-h-[88dvh] overflow-y-auto space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* つまみ（タップでも閉じられる） */}
        <button
          type="button"
          aria-label="シートを閉じる"
          onClick={onClose}
          className="mx-auto w-20 h-5 flex items-center justify-center"
        >
          <span className="w-10 h-1 rounded-full bg-[#5a4632]" />
        </button>

        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[#F7EFE6] font-semibold text-lg">いつもの一杯を記録</h3>
          <span className="text-xs text-[#6b5a4a] tabular-nums shrink-0">
            {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
          </span>
        </div>

        {/* プリセット（前回と同じ ＋ よく使うレシピ）。1枚のときは選択UIにしない */}
        <div className="flex gap-2.5">
          {presets.map((p, i) => {
            const selected = i === presetIndex
            const pBean = p.bean
            const pDrip = p.brew.method === 'drip_bag'
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(i)}
                aria-pressed={selected}
                className={`min-w-0 rounded-xl p-3 text-left flex flex-col gap-1.5 border transition-colors ${
                  selected ? 'bg-[#3e3020] border-[#CE9C68]' : 'bg-[#1a0a05] border-[#3e3020]'
                }`}
                style={{ flex: selected ? '1.5 1 0' : '1 1 0' }}
              >
                <span className="flex items-center gap-2">
                  {pBean?.photoDataUrl ? (
                    <img src={pBean.photoDataUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                  ) : (
                    <span
                      className="w-7 h-7 rounded shrink-0"
                      style={{ background: ROAST_SWATCH[pBean?.roastLevel ?? 'medium'] }}
                    />
                  )}
                  <span className="text-[13px] font-semibold text-[#F7EFE6] truncate">{p.name}</span>
                </span>
                <span className="text-[11px] text-[#CE9C68] truncate">
                  {(p.bean?.name ?? (pDrip ? '銘柄なし' : 'ホームブリュー'))}を
                  {BREW_METHOD_LABELS[p.brew.method ?? 'pour_over']}で
                </span>
                <span className="text-[10px] text-[#6b5a4a] truncate">
                  {p.brew.doseG != null && !pDrip ? `${p.brew.doseG}g／` : ''}
                  {p.brew.waterG != null ? `${p.brew.waterG}g` : ''}
                  {p.brew.tempC != null ? `、${p.brew.tempC}°C` : ''}
                </span>
              </button>
            )
          })}
        </div>

        {/* 今日だけ変えたところ */}
        {tweakKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#CE9C68]">今日だけ変えたところ</p>
            <div className="flex flex-wrap gap-2">
              {tweakKeys.map(key => {
                const v = values[key]!
                const changed = v !== baseValues[key]
                const open = openTweak === key
                return (
                  <button
                    key={key}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenTweak(open ? null : key)}
                    className={`min-h-11 px-3 rounded-xl text-xs text-[#F7EFE6] border transition-colors ${
                      changed ? 'bg-[#3e3020]' : 'bg-[#2E2018]'
                    } ${open || changed ? 'border-[#CE9C68]' : 'border-[#3e3020]'}`}
                  >
                    {QUICK_TWEAK_LIMITS[key].label} {formatTweak(key, v)}
                  </button>
                )
              })}
            </div>

            {openTweak && values[openTweak] != null && (
              <div className="flex items-center justify-between gap-3 bg-[#1a0a05] border border-[#3e3020] rounded-xl py-2 pl-4 pr-2">
                <span className="text-xs text-[#CE9C68]">{QUICK_TWEAK_LIMITS[openTweak].label}</span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label={`${QUICK_TWEAK_LIMITS[openTweak].label}を減らす`}
                    onClick={() => step(openTweak, -1)}
                    className="w-11 h-11 rounded-full bg-[#3e3020] text-[#CE9C68] text-lg font-semibold flex items-center justify-center active:opacity-70"
                  >
                    −
                  </button>
                  <span className="text-lg font-semibold text-[#F7EFE6] tabular-nums min-w-16 text-center">
                    {formatTweak(openTweak, values[openTweak]!)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${QUICK_TWEAK_LIMITS[openTweak].label}を増やす`}
                    onClick={() => step(openTweak, 1)}
                    className="w-11 h-11 rounded-full bg-[#3e3020] text-[#CE9C68] text-lg font-semibold flex items-center justify-center active:opacity-70"
                  >
                    ＋
                  </button>
                </div>
              </div>
            )}

            {/* 比率は淹れている実感の要。粉量・湯量がそろうときだけ出す */}
            {!isDripBag && values.doseG != null && values.waterG != null && (
              <p className="text-center text-xs text-[#6b5a4a]">
                比率 <span className="text-[#CE9C68] tabular-nums">{calcRatio(values.doseG, values.waterG)}</span>
              </p>
            )}
          </div>
        )}

        {/* 評価（任意） */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[#CE9C68]">評価（あとからでも大丈夫です）</p>
            <p className="text-xs text-[#6b5a4a]">{STAR_LABELS[rating]}</p>
          </div>
          <StarRating value={rating} onChange={setRating} />
        </div>

        {/* 就寝時の推定残留量（推定・目安。5mg 未満は出さない） */}
        {prediction && prediction.mg >= 5 && (
          <p className="text-[11px] text-[#6b5a4a] text-center">
            いま飲むと、就寝時（{prediction.hour.toString().padStart(2, '0')}:{prediction.minute.toString().padStart(2, '0')}）の推定残留量は約{Math.round(prediction.mg)}mg
            （目標 {prediction.targetMg}mg・個人差があります）
          </p>
        )}

        {rating === 0 && (
          <p className="text-xs text-[#6b5a4a] text-center">飲んでから、あとで評価を足せます</p>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDetail}
            className="px-4 py-3.5 rounded-2xl bg-[#1a0a05] border border-[#3e3020] text-[#F7EFE6] text-sm active:opacity-80 shrink-0"
          >
            詳しく記録
          </button>
          <button
            type="button"
            onClick={() => onSave({ preset, ...values, rating })}
            disabled={saving}
            className="flex-1 bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40"
          >
            {saving ? '保存中...' : 'この内容で記録'}
          </button>
        </div>
        <p className="text-[11px] text-[#6b5a4a] text-center">
          タイマーで淹れるときは「詳しく記録」から
        </p>
      </div>
    </div>
  )
}
