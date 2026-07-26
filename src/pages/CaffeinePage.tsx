import { useState, useEffect } from 'react'
import { getAllBrews, getAllCafeVisits, getAllCaffeineIntakes, putCaffeineIntake, deleteCaffeineIntake } from '../db'
import {
  calcResidualCaffeine, loadSettings, saveSettings, getBedtimeDate, isSameLocalDay,
  CAFFEINE_CATEGORY_LABELS, CAFFEINE_CATEGORY_UNIT_MG,
  newId, nowISO, toDatetimeLocal, fromDatetimeLocal,
} from '../db'
import type { CaffeineCategory } from '../db'
import CaffeineGraph from '../components/caffeine/CaffeineGraph'
import { CupIcon, CafeIcon, DrinkIcon } from '../components/icons'
import { useToast } from '../components/Toast'

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

const CATEGORY_ORDER: CaffeineCategory[] = ['energy', 'black_tea', 'green_tea', 'oolong_tea', 'cola', 'other']

type IntakeEntry = {
  id?: string          // 'other' のみ（削除用）
  caffeineAmount: number
  brewedAt: string     // 摂取時刻（brew/cafe/other 共通キー）
  label: string        // 表示用ラベル
  kind: 'brew' | 'cafe' | 'other'
}

export default function CaffeinePage() {
  const showToast = useToast()
  const [intakeEntries, setIntakeEntries] = useState<IntakeEntry[]>([])
  const [settings, setSettings] = useState(loadSettings)
  const [now, setNow] = useState(() => new Date())
  const [reloadKey, setReloadKey] = useState(0)

  // その他の飲み物 追加シート
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [addCategory, setAddCategory] = useState<CaffeineCategory>('energy')
  const [addPerUnitMg, setAddPerUnitMg] = useState(CAFFEINE_CATEGORY_UNIT_MG.energy) // 1本/1杯あたりの目安（調整可）
  const [addQuantity, setAddQuantity] = useState(1)
  const [addAt, setAddAt] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    Promise.all([getAllBrews(), getAllCafeVisits(), getAllCaffeineIntakes()]).then(([brews, visits, others]) => {
      const brewEntries: IntakeEntry[] = brews
        .filter(b => b.caffeineAmount != null && new Date(b.brewedAt).getTime() > cutoff)
        .map(b => ({
          caffeineAmount: b.caffeineAmount!,
          brewedAt: b.brewedAt,
          label: 'ホームブリュー',
          kind: 'brew' as const,
        }))

      const cafeEntries: IntakeEntry[] = visits
        .filter(v => v.caffeineAmount != null && new Date(v.visitedAt).getTime() > cutoff)
        .map(v => ({
          caffeineAmount: v.caffeineAmount!,
          brewedAt: v.visitedAt,
          label: v.cafeName,
          kind: 'cafe' as const,
        }))

      const otherEntries: IntakeEntry[] = others
        .filter(o => new Date(o.consumedAt).getTime() > cutoff)
        .map(o => ({
          id: o.id,
          caffeineAmount: o.caffeineAmount,
          brewedAt: o.consumedAt,
          label: o.note
            ? `${CAFFEINE_CATEGORY_LABELS[o.category]}（${o.note}）`
            : CAFFEINE_CATEGORY_LABELS[o.category],
          kind: 'other' as const,
        }))

      const merged = [...brewEntries, ...cafeEntries, ...otherEntries]
        .sort((a, b) => b.brewedAt.localeCompare(a.brewedAt))

      setIntakeEntries(merged)
    }).catch(() => {/* カフェイン履歴の読込失敗時はグラフを空で表示 */})
  }, [reloadKey])

  const openAddSheet = () => {
    setAddCategory('energy')
    setAddPerUnitMg(CAFFEINE_CATEGORY_UNIT_MG.energy)
    setAddQuantity(1)
    setAddAt(toDatetimeLocal(nowISO()))
    setAddNote('')
    setShowAddSheet(true)
  }

  // カテゴリを別のものに変えたら、その参考値に戻す（同じチップの再タップは無変更）
  const selectAddCategory = (cat: CaffeineCategory) => {
    if (cat === addCategory) return
    setAddCategory(cat)
    setAddPerUnitMg(CAFFEINE_CATEGORY_UNIT_MG[cat])
  }

  // 1本/1杯あたりの目安を 0〜1000mg・整数にクランプ
  const setPerUnitClamped = (v: number) =>
    setAddPerUnitMg(Number.isFinite(v) ? Math.min(1000, Math.max(0, Math.round(v))) : 0)

  const addEstimate = Math.round(addPerUnitMg * addQuantity)

  const handleAddSave = async () => {
    if (addSaving) return
    setAddSaving(true)
    try {
      await putCaffeineIntake({
        id: newId(),
        createdAt: nowISO(),
        consumedAt: addAt ? fromDatetimeLocal(addAt) : nowISO(),
        category: addCategory,
        quantity: addQuantity,
        caffeineAmount: addEstimate,
        note: addNote.trim() || undefined,
      })
      setShowAddSheet(false)
      setReloadKey(k => k + 1)
      showToast('摂取を記録しました', { type: 'success' })
    } catch {
      showToast('保存に失敗しました', { type: 'error' })
    } finally {
      setAddSaving(false)
    }
  }

  const handleDeleteOther = async (id: string) => {
    try {
      await deleteCaffeineIntake(id)
      setReloadKey(k => k + 1)
      showToast('削除しました', { type: 'success' })
    } catch {
      showToast('削除に失敗しました', { type: 'error' })
    }
  }

  const intakes = intakeEntries.map(e => ({
    caffeineAmount: e.caffeineAmount,
    brewedAt: e.brewedAt,
  }))

  const current = calcResidualCaffeine(intakes, now)
  const bedtime = getBedtimeDate(settings.bedtimeHour, settings.bedtimeMinute, now)
  const atBedtime = calcResidualCaffeine(intakes, bedtime)

  const MAX_REF = 400
  const pct = Math.min(100, (current / MAX_REF) * 100)
  const barColor = current < 100 ? '#4ade80' : current < 250 ? '#CE9C68' : '#993C1D'

  // 今日（0時〜現在）の摂取合計。バーは 500mg スケールに 400mg の目安ラインを重ねる
  const todayIntake = intakeEntries
    .filter(e => isSameLocalDay(e.brewedAt, now))
    .reduce((sum, e) => sum + e.caffeineAmount, 0)
  const intakeScale = Math.max(500, todayIntake)
  const intakePct = (todayIntake / intakeScale) * 100
  const guidePct = (400 / intakeScale) * 100

  // 就寝時のステータスは、ユーザー自身が設定した目標値との比較のみで表現する
  // （睡眠への影響を断定しない。CLAUDE.md「健康情報の扱い」参照）
  const target = settings.bedtimeTargetMg
  const exceedsTarget = atBedtime > target
  const bedtimeLabel = !exceedsTarget ? '目標内' : atBedtime <= target * 2 ? '目標超え' : '目標を大きく超え'
  const bedtimeColor = !exceedsTarget ? 'text-emerald-400' : atBedtime <= target * 2 ? 'text-amber-400' : 'text-[#E07A4F]'

  const updateSettings = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <h2 className="text-xl font-semibold text-[#F7EFE6]">カフェイン</h2>

      {/* 現在の残留量 */}
      <div className="bg-[#2E2018] rounded-xl p-5">
        <p className="text-xs text-[#CE9C68]">現在の体内残留量（推定）</p>
        <p className="text-4xl font-bold text-[#F7EFE6] tabular-nums mt-2">
          {Math.round(current)}
          <span className="text-lg font-normal text-[#CE9C68] ml-1">mg</span>
        </p>
        <div className="mt-3 h-2 bg-[#3e3020] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>

      {/* 今日の摂取量（1日の目安 400mg は摂取量に対する基準なのでこちらに表示） */}
      <div className="bg-[#2E2018] rounded-xl p-5">
        <p className="text-xs text-[#CE9C68]">今日の摂取量（推定）</p>
        <p className="text-4xl font-bold text-[#F7EFE6] tabular-nums mt-2">
          {Math.round(todayIntake)}
          <span className="text-lg font-normal text-[#CE9C68] ml-1">mg</span>
        </p>
        <div className="mt-3 relative h-2 bg-[#3e3020] rounded-full">
          <div
            className="h-full rounded-full bg-[#CE9C68] transition-all duration-500"
            style={{ width: `${intakePct}%` }}
          />
          {/* 400mg 目安ライン */}
          <div
            className="absolute -top-1 -bottom-1 w-px bg-[#F7EFE6]/40"
            style={{ left: `${guidePct}%` }}
          />
        </div>
        <p className="text-xs text-[#4a3a2a] mt-1.5">
          参考: 健康な成人では 1日 400mg 程度までが目安とされています（EFSA・食品安全委員会）
        </p>
        {todayIntake > 400 && (
          <p className="text-xs text-[#CE9C68] mt-1">一般的な目安を上回っています（目安には個人差があります）</p>
        )}
      </div>

      {/* 推移グラフ */}
      <div className="bg-[#2E2018] rounded-xl p-4">
        <p className="text-xs text-[#CE9C68] mb-3">体内残留量の推移</p>
        <CaffeineGraph
          intakes={intakes}
          bedtimeHour={settings.bedtimeHour}
          bedtimeMinute={settings.bedtimeMinute}
          targetMg={settings.bedtimeTargetMg}
          now={now}
        />
        <div className="flex gap-4 mt-2 justify-end">
          <span className="text-[10px] text-[#6b5a4a] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#F7EFE6" strokeWidth="2"/>
            </svg>
            実績
          </span>
          <span className="text-[10px] text-[#6b5a4a] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#F7EFE6" strokeWidth="2" strokeDasharray="5 4" opacity="0.45"/>
            </svg>
            予測
          </span>
          <span className="text-[10px] text-[#CE9C68] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#CE9C68" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
            目標
          </span>
          <span className="text-[10px] text-[#993C1D] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#993C1D" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
            就寝
          </span>
        </div>
      </div>

      {/* 就寝時予測 */}
      <div className={`rounded-xl p-5 flex items-center justify-between ${
        exceedsTarget ? 'bg-amber-900/40 border border-amber-600/40' : 'bg-[#2E2018]'
      }`}>
        <div>
          <p className="text-xs text-[#CE9C68] mb-1">
            就寝時の予測（{pad(settings.bedtimeHour)}:{pad(settings.bedtimeMinute)}）
          </p>
          <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">
            {Math.round(atBedtime)}
            <span className="text-sm font-normal text-[#CE9C68] ml-1">mg</span>
          </p>
          {exceedsTarget && (
            <p className="text-xs text-amber-400 mt-1">目標 {settings.bedtimeTargetMg}mg を上回る見込みです（推定）</p>
          )}
          <p className="text-[10px] text-[#6b5a4a] mt-1">睡眠への感じ方には個人差があります</p>
        </div>
        <span className={`text-sm font-medium ${bedtimeColor}`}>{bedtimeLabel}</span>
      </div>

      {/* その他の飲み物を追加（コーヒー以外のカフェイン） */}
      <button
        type="button"
        onClick={openAddSheet}
        className="bg-[#2E2018] rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm text-[#CE9C68] font-medium active:opacity-80"
      >
        <DrinkIcon size={16} />
        その他の飲み物を追加
      </button>

      {/* 過去24時間の摂取ログ */}
      <div className="bg-[#2E2018] rounded-xl p-4">
        <p className="text-xs text-[#CE9C68] mb-3">過去24時間の摂取</p>
        {intakeEntries.length === 0 ? (
          <p className="text-[#4a3a2a] text-sm text-center py-3">記録された摂取はありません</p>
        ) : (
          <div className="flex flex-col">
            {intakeEntries.map((entry, i) => {
              const residual = calcResidualCaffeine(
                [{ caffeineAmount: entry.caffeineAmount, brewedAt: entry.brewedAt }],
                now,
              )
              const d = new Date(entry.brewedAt)
              return (
                <div key={i}
                  className="flex items-center justify-between py-2.5 border-b border-[#3e3020] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#6b5a4a] tabular-nums w-10 shrink-0">
                      {pad(d.getHours())}:{pad(d.getMinutes())}
                    </span>
                    <div>
                      <p className="text-sm text-[#F7EFE6]">{entry.caffeineAmount}mg 摂取</p>
                      <p className="text-xs text-[#6b5a4a] flex items-center gap-1">
                        {entry.kind === 'brew'
                          ? <CupIcon size={11} className="shrink-0" />
                          : entry.kind === 'cafe'
                            ? <CafeIcon size={11} className="shrink-0" />
                            : <DrinkIcon size={11} className="shrink-0" />}
                        {entry.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-[#CE9C68] tabular-nums">
                      残 {Math.round(residual)}mg
                    </span>
                    {entry.kind === 'other' && entry.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOther(entry.id!)}
                        className="text-xs text-[#6b5a4a] active:opacity-60 px-1"
                        aria-label="削除"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 設定 */}
      <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-4">
        <p className="text-xs text-[#CE9C68]">設定</p>

        {/* 就寝時刻 */}
        <div>
          <p className="text-xs text-[#6b5a4a] mb-2">就寝予定時刻</p>
          <div className="flex items-center gap-2 justify-center">
            <select value={settings.bedtimeHour}
              onChange={e => updateSettings({ bedtimeHour: Number(e.target.value) })}
              className="bg-[#3e3020] text-[#F7EFE6] rounded-lg px-3 py-2 text-lg font-semibold outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{pad(i)}</option>
              ))}
            </select>
            <span className="text-[#F7EFE6] text-xl font-semibold">:</span>
            <select value={settings.bedtimeMinute}
              onChange={e => updateSettings({ bedtimeMinute: Number(e.target.value) })}
              className="bg-[#3e3020] text-[#F7EFE6] rounded-lg px-3 py-2 text-lg font-semibold outline-none"
            >
              {[0, 15, 30, 45].map(m => (
                <option key={m} value={m}>{pad(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 目標残留量 */}
        <div>
          <p className="text-xs text-[#6b5a4a] mb-2">就寝時の目標残留量</p>
          <div className="flex items-center gap-2 justify-center">
            <button type="button"
              onClick={() => updateSettings({ bedtimeTargetMg: Math.max(0, settings.bedtimeTargetMg - 10) })}
              className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
            >
              −
            </button>
            <span className="w-20 text-center text-[#F7EFE6] text-xl font-semibold tabular-nums">
              {settings.bedtimeTargetMg}mg
            </span>
            <button type="button"
              onClick={() => updateSettings({ bedtimeTargetMg: Math.min(200, settings.bedtimeTargetMg + 10) })}
              className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
            >
              ＋
            </button>
          </div>
          <p className="text-xs text-[#4a3a2a] text-center mt-1">0〜200mg。就寝時に残したくない量を、あなたの体感に合わせて設定してください（感じ方には個人差があります）</p>
        </div>
      </div>

      <div className="text-xs text-[#4a3a2a] text-center pb-2 flex flex-col gap-1.5 leading-relaxed">
        <p>
          カフェイン量はコーヒー粉 1g あたり約 12mg、カフェドリンクは種類とサイズからの推定値です。
          残留量は半減期 5.5 時間の一般的なモデルによる概算で、実際の代謝には大きな個人差があります。
        </p>
        <p>
          コーヒー以外の飲料（紅茶・緑茶・ウーロン茶等）の値は、食品安全委員会「食品中のカフェイン」の
          浸出液100mLあたりの目安（紅茶約30mg・せん茶約20mg・ウーロン茶約20mg）を1杯150mL換算した参考値です。
          エナジードリンクは製品により約36〜150mg/本と幅が大きいため控えめの目安、コーラは一般的な参考値です。
          いずれも商品・淹れ方・サイズで変動します。
        </p>
        <p>
          本画面の数値は生活の参考情報であり、医学的な助言・診断ではありません。
          体調に不安があるときは医師などの専門家にご相談ください。
        </p>
        <p>
          参考: 食品安全委員会・欧州食品安全機関（EFSA）は、健康な成人で 1日 400mg 程度までを
          目安とする見解を公表しています。
        </p>
      </div>

      {/* その他の飲み物 追加シート */}
      {showAddSheet && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowAddSheet(false)}
        >
          <div
            className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg p-5 pb-8 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[#F7EFE6] font-semibold">その他の飲み物を追加</h3>

            {/* カテゴリ選択 */}
            <div>
              <p className="text-xs text-[#CE9C68] mb-2">種類</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ORDER.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => selectAddCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm active:opacity-80 ${
                      addCategory === cat
                        ? 'bg-[#993C1D] text-[#F7EFE6]'
                        : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {CAFFEINE_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* 1本/1杯あたりの目安（参考値を初期表示。缶の表示などが分かれば調整できる） */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#CE9C68]">1本/1杯あたりの目安（調整できます）</p>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setPerUnitClamped(addPerUnitMg - 5)}
                    className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
                  >−</button>
                  <div className="flex items-baseline">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={1000}
                      value={addPerUnitMg}
                      onChange={e => setPerUnitClamped(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-14 bg-transparent text-[#F7EFE6] text-lg font-semibold outline-none tabular-nums text-right"
                    />
                    <span className="text-xs text-[#CE9C68] ml-1">mg</span>
                  </div>
                  <button type="button"
                    onClick={() => setPerUnitClamped(addPerUnitMg + 5)}
                    className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
                  >＋</button>
                </div>
              </div>
              <p className="text-[11px] text-[#6b5a4a] mt-2">
                商品・サイズで変動する参考値です。分かる場合は缶やパッケージの表示に合わせて調整できます。
              </p>
            </div>

            {/* 数量 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#CE9C68]">杯数 / 本数</p>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setAddQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
                >−</button>
                <span className="w-10 text-center text-[#F7EFE6] text-lg font-semibold tabular-nums">{addQuantity}</span>
                <button type="button"
                  onClick={() => setAddQuantity(q => Math.min(20, q + 1))}
                  className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
                >＋</button>
              </div>
            </div>

            {/* 時刻 */}
            <div>
              <p className="text-xs text-[#CE9C68] mb-2">時刻</p>
              <input
                type="datetime-local"
                value={addAt}
                onChange={e => setAddAt(e.target.value)}
                className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none text-sm"
              />
            </div>

            {/* メモ（任意・銘柄など） */}
            <div>
              <p className="text-xs text-[#CE9C68] mb-2">メモ（任意・銘柄など）</p>
              <input
                type="text"
                value={addNote}
                onChange={e => setAddNote(e.target.value)}
                placeholder="例: モンスター"
                className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a] text-sm"
              />
            </div>

            <p className="text-sm text-[#CE9C68] text-center">
              合計の目安 <span className="text-[#F7EFE6] font-semibold text-base tabular-nums">約 {addEstimate}mg</span>
              <span className="text-[11px] text-[#6b5a4a] ml-1">（{addPerUnitMg} × {addQuantity}）</span>
            </p>

            <button
              type="button"
              onClick={handleAddSave}
              disabled={addSaving}
              className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40"
            >
              {addSaving ? '保存中...' : 'この摂取を記録する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
