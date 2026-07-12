import { useState, useEffect } from 'react'
import type { Bean, Brew, RoastLevel } from '../../db'
import {
  getAllBeans, getAllBrews, putBean, newId, nowISO,
  ROAST_LEVEL_LABELS, daysSinceRoast, formatBeanRemaining,
} from '../../db'
import OriginInput from '../OriginInput'

interface Props {
  currentBeanId?: string
  onSelect: (bean: Bean) => void
  onClose: () => void
}

const ROAST_LEVELS: RoastLevel[] = ['light', 'light-medium', 'medium', 'medium-dark', 'dark']

function AddBeanForm({ onAdd, onCancel, recentOrigins }: {
  onAdd: (b: Bean) => void
  onCancel: () => void
  recentOrigins: string[]
}) {
  const [name, setName] = useState('')
  const [roastLevel, setRoastLevel] = useState<RoastLevel>('medium')
  const [roastedAt, setRoastedAt] = useState('')
  const [origin, setOrigin] = useState('')
  const [amountG, setAmountG] = useState<number | undefined>()
  const [decaf, setDecaf] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const bean: Bean = {
      id: newId(),
      name: name.trim(),
      roastLevel,
      roastedAt: roastedAt || undefined,
      origin: origin.trim() || undefined,
      initialAmountG: amountG,
      decaf: decaf || undefined,
      createdAt: nowISO(),
    }
    await putBean(bean)
    onAdd(bean)
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h3 className="text-lg font-semibold text-[#F7EFE6]">豆を追加</h3>

      <div>
        <label className="text-xs text-[#CE9C68] mb-1.5 block">豆の名前 *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例: エチオピア イルガチェフェ"
          className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a]"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-[#CE9C68] mb-1.5 block">焙煎度</label>
        <div className="flex flex-wrap gap-2">
          {ROAST_LEVELS.map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setRoastLevel(level)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                roastLevel === level
                  ? 'bg-[#993C1D] text-[#F7EFE6]'
                  : 'bg-[#3e3020] text-[#CE9C68]'
              }`}
            >
              {ROAST_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[#CE9C68] mb-1.5 block">焙煎日</label>
        <input
          type="date"
          value={roastedAt}
          onChange={e => setRoastedAt(e.target.value)}
          className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none"
        />
      </div>

      <div>
        <label className="text-xs text-[#CE9C68] mb-1.5 block">産地（任意）</label>
        <OriginInput value={origin} onChange={setOrigin} recentOrigins={recentOrigins} />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDecaf(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            decaf ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
          }`}
        >
          デカフェ
        </button>
        <span className="text-[10px] text-[#6b5a4a]">カフェイン推定を約1/10にします</span>
      </div>

      <div>
        <label className="text-xs text-[#CE9C68] mb-1.5 block">内容量 g（任意・残量を自動計算）</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={amountG ?? ''}
          onChange={e => setAmountG(e.target.value ? Number(e.target.value) : undefined)}
          placeholder="例: 200"
          className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a] tabular-nums"
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl font-semibold disabled:opacity-40"
        >
          追加して、この記録で使う
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-[#CE9C68] py-3 rounded-2xl text-sm"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

export default function BeanPickerModal({ currentBeanId, onSelect, onClose }: Props) {
  const [beans, setBeans] = useState<Bean[]>([])
  const [brews, setBrews] = useState<Brew[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showFinished, setShowFinished] = useState(false)

  useEffect(() => {
    getAllBeans().then(setBeans).catch(() => {})
    getAllBrews().then(setBrews).catch(() => {})
  }, [])

  const handleAdd = (bean: Bean) => {
    onSelect(bean)
    onClose()
  }

  // 飲み切った豆は既定で隠す（選択中の豆は常に表示）
  const finishedCount = beans.filter(b => b.finishedAt && b.id !== currentBeanId).length
  const visibleBeans = showFinished
    ? beans
    : beans.filter(b => !b.finishedAt || b.id === currentBeanId)

  if (showAdd) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a0a05] overflow-y-auto">
        <div className="sticky top-0 flex items-center px-4 py-3 bg-[#1a0a05] border-b border-[#2e2018]">
          <button type="button" onClick={() => setShowAdd(false)} className="text-[#CE9C68] text-sm">
            ← 戻る
          </button>
        </div>
        <AddBeanForm
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
          recentOrigins={[...beans].reverse().map(b => b.origin).filter((o): o is string => Boolean(o))}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#1a0a05] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2018]">
        <h2 className="text-lg font-semibold text-[#F7EFE6]">豆を選ぶ</h2>
        <button type="button" onClick={onClose} className="text-[#CE9C68] text-sm">
          閉じる
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {beans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-[#CE9C68] text-sm">まだ豆が登録されていません</p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-[#993C1D] font-semibold text-sm"
            >
              ＋ 最初の豆を追加
            </button>
          </div>
        ) : (
          <ul>
            {visibleBeans.map(bean => (
              <li key={bean.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(bean); onClose() }}
                  className={`w-full flex items-center justify-between px-4 py-4 text-left border-b border-[#2e2018] active:bg-[#2e1810] ${
                    bean.id === currentBeanId ? 'bg-[#2e1810]' : ''
                  } ${bean.finishedAt ? 'opacity-60' : ''}`}
                >
                  <div>
                    <p className="text-[#F7EFE6] font-medium">{bean.name}</p>
                    <p className="text-xs text-[#CE9C68] mt-0.5">
                      {ROAST_LEVEL_LABELS[bean.roastLevel]}
                      {bean.roastedAt ? ` · 焙煎から${daysSinceRoast(bean.roastedAt)}日` : ''}
                      {bean.origin ? ` · ${bean.origin}` : ''}
                    </p>
                    {(bean.finishedAt || formatBeanRemaining(bean, brews)) && (
                      <p className="text-xs text-[#6b5a4a] mt-0.5">
                        {bean.finishedAt ? '飲み切り' : formatBeanRemaining(bean, brews)}
                      </p>
                    )}
                  </div>
                  {bean.id === currentBeanId && (
                    <span className="text-[#993C1D] text-lg">✓</span>
                  )}
                </button>
              </li>
            ))}
            {finishedCount > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowFinished(v => !v)}
                  className="w-full px-4 py-3 text-left text-xs text-[#6b5a4a] border-b border-[#2e2018]"
                >
                  {showFinished ? '▲ 飲み切った豆を隠す' : `▽ 飲み切った豆を表示（${finishedCount}）`}
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center gap-2 px-4 py-4 text-[#993C1D] font-semibold text-sm border-b border-dashed border-[#993C1D]/40"
              >
                ＋ 新しい豆を追加
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}
