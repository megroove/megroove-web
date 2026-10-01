import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Bean } from '../db'
import {
  getAllBrews, getAllBeans, getAllCafeVisits, putBean,
  withSaveTimeout, saveErrorMessage,
} from '../db'
import type { ContinentProgress, PassportStamp } from '../components/passport/passportStats'
import { calcPassport, listBeansMissingOrigin } from '../components/passport/passportStats'
import { jacketColor } from '../components/library/jacketColor'
import { flagFor } from '../components/passport/flag'
import OriginInput from '../components/OriginInput'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { GlobeIcon } from '../components/icons'

// 押されたスタンプ。国旗を出し、描けない環境では頭文字に退避する（flag.ts 参照）。
// 地色は産地ごとに変わる（棚のジャケットと同じ導き方）
function Stamp({ stamp }: { stamp: PassportStamp }) {
  const color = jacketColor(stamp.country)
  const flag = flagFor(stamp.country)
  return (
    <div className="bg-[#2E2018] rounded-xl p-2.5 flex flex-col items-center gap-1.5">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center border-2"
        style={{ background: color.bg, borderColor: '#CE9C68' }}
      >
        {flag ? (
          // 国名はすぐ下に出ているので、読み上げでは旗を飛ばす
          <span className="text-[26px] leading-none" aria-hidden="true">{flag}</span>
        ) : (
          <span className="text-lg font-bold" style={{ color: color.text }}>
            {stamp.country.slice(0, 2)}
          </span>
        )}
      </div>
      <p className="text-[11px] text-[#F7EFE6] font-semibold text-center leading-tight line-clamp-2">
        {stamp.country}
      </p>
      <p className="text-[10px] text-[#A8916F]">
        {stamp.count}杯{stamp.avgRating != null && <> · ★{stamp.avgRating}</>}
      </p>
    </div>
  )
}

// まだ押されていない枠。押しつけがましくならないよう、静かな破線で置く
function EmptySlot({ country }: { country: string }) {
  return (
    <div className="rounded-xl p-2.5 flex flex-col items-center gap-1.5 opacity-70">
      <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#3e3020]" />
      <p className="text-[11px] text-[#A8916F] text-center leading-tight line-clamp-2">{country}</p>
    </div>
  )
}

function ContinentSection({ progress }: { progress: ContinentProgress }) {
  // 未踏は既定で畳む。全部広げると「埋まっていない」ほうが主役になってしまう
  const [showUnvisited, setShowUnvisited] = useState(false)
  const pct = progress.total > 0 ? (progress.visited / progress.total) * 100 : 0

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-[#F7EFE6] font-semibold">{progress.continent}</p>
        <p className="text-xs text-[#A8916F] tabular-nums">
          {progress.visited}<span className="text-[#6b5a4a]"> / {progress.total}</span>
        </p>
      </div>

      {/* 進捗。埋まった分だけコーラルで満ちる */}
      <div className="h-1.5 rounded-full bg-[#2E2018] overflow-hidden">
        <div className="h-full rounded-full bg-[#993C1D]" style={{ width: `${pct}%` }} />
      </div>

      {progress.stamps.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {progress.stamps.map(s => <Stamp key={s.country} stamp={s} />)}
        </div>
      )}

      {progress.unvisited.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowUnvisited(v => !v)}
            aria-expanded={showUnvisited}
            className="self-start min-h-11 text-xs text-[#A8916F] active:opacity-70"
          >
            {showUnvisited ? '▲ 閉じる' : `▽ まだ出会っていない ${progress.unvisited.length} か国`}
          </button>
          {showUnvisited && (
            <div className="grid grid-cols-4 gap-2">
              {progress.unvisited.map(c => <EmptySlot key={c} country={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function PassportPage() {
  const navigate = useNavigate()
  const showToast = useToast()

  const [brews, setBrews] = useState<Awaited<ReturnType<typeof getAllBrews>>>([])
  const [beans, setBeans] = useState<Bean[]>([])
  const [visits, setVisits] = useState<Awaited<ReturnType<typeof getAllCafeVisits>>>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  // 産地未登録の豆を、この画面で直接埋められるようにする
  const [editingBeanId, setEditingBeanId] = useState<string | null>(null)
  const [originDraft, setOriginDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    Promise.all([getAllBrews(), getAllBeans(), getAllCafeVisits()])
      .then(([bs, bn, vs]) => { setBrews(bs); setBeans(bn); setVisits(vs) })
      .catch(() => setDbError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const passport = useMemo(() => calcPassport(brews, beans, visits), [brews, beans, visits])
  const missing = useMemo(() => listBeansMissingOrigin(brews, beans), [brews, beans])
  const recentOrigins = useMemo(
    () => [...new Set(beans.map(b => b.origin).filter((o): o is string => !!o?.trim()))],
    [beans],
  )

  const saveOrigin = async (bean: Bean) => {
    const origin = originDraft.trim()
    if (!origin || saving) return
    setSaving(true)
    try {
      await withSaveTimeout(putBean({ ...bean, origin }))
      setEditingBeanId(null)
      setOriginDraft('')
      load()
      showToast(`${bean.name} の産地を登録しました`, { type: 'success' })
    } catch (e) {
      console.error('[megroove] 産地の保存に失敗しました:', e)
      showToast(saveErrorMessage(e), { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const pct = (passport.visitedCount / passport.totalCountries) * 100

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2018]">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm">
          ← 戻る
        </button>
        <h2 className="text-lg font-semibold text-[#F7EFE6] flex-1">産地パスポート</h2>
      </div>

      <div className="px-4 py-5 flex flex-col gap-6">
        {dbError && (
          <div className="bg-[#3e1a0a] border border-[#993C1D]/40 rounded-xl px-4 py-3 text-sm text-[#CE9C68]">
            データの読み込みに失敗しました。
          </div>
        )}

        {/* 全体の進捗。まず「いくつ集めたか」を見せる */}
        <div className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[#CE9C68]">出会った産地</p>
              <p className="text-3xl font-bold text-[#F7EFE6] tabular-nums mt-0.5">
                {passport.visitedCount}
                <span className="text-base font-normal text-[#A8916F]"> / {passport.totalCountries}</span>
              </p>
            </div>
            <p className="text-xs text-[#A8916F] tabular-nums">
              {Math.round(pct)}%
            </p>
          </div>
          <div className="h-2 rounded-full bg-[#1a0a05] overflow-hidden">
            <div className="h-full rounded-full bg-[#993C1D]" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* 産地未登録の豆（パスポートが埋まらない最大の原因なので、ここで直せる） */}
        {missing.length > 0 && (
          <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm text-[#F7EFE6] font-medium">
                産地が未登録の豆が {missing.length} 件あります
              </p>
              <p className="text-xs text-[#A8916F] mt-1 leading-relaxed">
                登録すると、その杯数ぶんスタンプが増えます。袋の表示や購入ページで確認できます。
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {missing.slice(0, 8).map(({ bean, count }) => (
                <div key={bean.id} className="bg-[#1a0a05] rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-[#F7EFE6] truncate">{bean.name}</p>
                    <p className="text-[11px] text-[#A8916F] shrink-0">{count}杯</p>
                  </div>

                  {editingBeanId === bean.id ? (
                    <div className="flex flex-col gap-2">
                      <OriginInput
                        value={originDraft}
                        onChange={setOriginDraft}
                        recentOrigins={recentOrigins}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveOrigin(bean)}
                          disabled={!originDraft.trim() || saving}
                          className="flex-1 min-h-11 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold active:opacity-80 disabled:opacity-40"
                        >
                          {saving ? '保存中...' : '登録する'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingBeanId(null); setOriginDraft('') }}
                          className="min-h-11 px-4 rounded-xl text-sm text-[#A8916F] active:opacity-70"
                        >
                          やめる
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingBeanId(bean.id); setOriginDraft('') }}
                      className="self-start min-h-11 px-3 rounded-full border border-[#3e3020] text-xs text-[#CE9C68] active:opacity-70"
                    >
                      産地を登録する
                    </button>
                  )}
                </div>
              ))}
              {missing.length > 8 && (
                <p className="text-[11px] text-[#A8916F] text-center">
                  ほか {missing.length - 8} 件はストックから登録できます
                </p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-[#A8916F] text-sm text-center py-12">読み込み中...</p>
        ) : passport.visitedCount === 0 && missing.length === 0 ? (
          <EmptyState
            title="まだスタンプがありません"
            description="豆やカフェ記録に産地を登録すると、ここに押されていきます"
            action={{ label: 'ストックを開く', onClick: () => navigate('/stock') }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {passport.byContinent.map(p => (
              <ContinentSection key={p.continent} progress={p} />
            ))}
          </div>
        )}

        {/* マスターに無い書き方で入力された産地。捨てずに拾って見せる */}
        {passport.unknownOrigins.length > 0 && (
          <div className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-2 flex items-center gap-1.5">
              <GlobeIcon size={13} /> その他の産地
            </p>
            <div className="flex flex-wrap gap-2">
              {passport.unknownOrigins.map(o => (
                <span key={o} className="bg-[#3e3020] text-[#CE9C68] text-xs px-3 py-1 rounded-full">
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
