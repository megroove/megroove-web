import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildProvisionPackage,
  ALL_SCOPES, SCOPE_LABELS, SCOPE_DESCRIPTIONS,
  type DataScope, type ProvisionPackage,
} from '../provision'
import { useToast } from '../components/Toast'
import { GlobeIcon, DownloadIcon } from '../components/icons'

type PeriodKey = 'all' | '12m' | '3m'
const PERIOD_LABELS: Record<PeriodKey, string> = { all: '全期間', '12m': '直近12ヶ月', '3m': '直近3ヶ月' }
const PERIOD_MONTHS: Record<PeriodKey, number | null> = { all: null, '12m': 12, '3m': 3 }

const ALWAYS_EXCLUDED = [
  '写真', '自由記述メモ', '正確な時刻（日付に丸め）',
  '豆の名前', 'カフェ名', '器具の名前・メーカー', 'カフェイン・就寝の設定',
]

export default function DataProvisionPage() {
  const navigate = useNavigate()
  const showToast = useToast()

  const [scopes, setScopes] = useState<DataScope[]>(['brew.params', 'brew.rating'])
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [pkg, setPkg] = useState<ProvisionPackage | null>(null)
  const [building, setBuilding] = useState(false)

  const toggleScope = (s: DataScope) => {
    setPkg(null)
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const handleBuild = async () => {
    if (scopes.length === 0 || building) return
    setBuilding(true)
    try {
      setPkg(await buildProvisionPackage({ scopes, periodMonths: PERIOD_MONTHS[period] }))
    } catch {
      showToast('パッケージの生成に失敗しました', { type: 'error' })
    } finally {
      setBuilding(false)
    }
  }

  const handleDownload = () => {
    if (!pkg) return
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `megroove-provision-${pkg.generatedAt}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('提供パッケージを保存しました', { type: 'success' })
  }

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm shrink-0">
          ← 戻る
        </button>
        <h2 className="text-xl font-semibold text-[#F7EFE6]">データ提供の準備</h2>
      </div>

      {/* 説明 */}
      <div className="bg-[#2E2018] rounded-xl p-4 flex gap-3">
        <span className="text-[#CE9C68] shrink-0 mt-0.5"><GlobeIcon size={18} /></span>
        <p className="text-xs text-[#CE9C68] leading-relaxed">
          将来、あなたの記録データをカフェやロースターに提供してポイント等の特典を受け取れる仕組みを準備しています。
          ここでは「実際に提供されるデータ」を匿名化した形で確認・ダウンロードできます。
          <span className="text-[#F7EFE6] font-medium">この画面からデータが端末の外へ送信されることは一切ありません。</span>
        </p>
      </div>

      {/* スコープ選択 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">提供するデータの範囲</h3>
        {ALL_SCOPES.map(s => {
          const selected = scopes.includes(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleScope(s)}
              className={`w-full rounded-xl p-4 text-left transition-colors border ${
                selected
                  ? 'bg-[#2E2018] border-[#993C1D]'
                  : 'bg-[#2E2018] border-transparent opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#F7EFE6] font-medium">{SCOPE_LABELS[s]}</p>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] shrink-0 ${
                  selected ? 'border-[#993C1D] bg-[#993C1D] text-[#F7EFE6]' : 'border-[#4a3a2a] text-transparent'
                }`}>
                  ✓
                </span>
              </div>
              <p className="text-xs text-[#6b5a4a] mt-1">{SCOPE_DESCRIPTIONS[s]}</p>
            </button>
          )
        })}
      </section>

      {/* 期間 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">期間</h3>
        <div className="flex gap-2">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(p => (
            <button key={p} type="button"
              onClick={() => { setPeriod(p); setPkg(null) }}
              className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                period === p ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#2E2018] text-[#CE9C68]'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </section>

      {/* 生成 */}
      <button
        type="button"
        onClick={handleBuild}
        disabled={scopes.length === 0 || building}
        className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-xl font-semibold text-sm active:opacity-80 disabled:opacity-40"
      >
        {building ? '生成中...' : '提供パッケージをプレビュー'}
      </button>

      {/* プレビュー */}
      {pkg && (
        <section className="flex flex-col gap-3">
          <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <p className="text-xs text-[#CE9C68]">レコード数</p>
              <p className="text-sm text-[#F7EFE6] font-semibold tabular-nums">
                {pkg.records.length}件
                {pkg.monthlyStats ? ` ＋ 月次集計${pkg.monthlyStats.length}ヶ月` : ''}
              </p>
            </div>
            <div className="flex justify-between items-baseline">
              <p className="text-xs text-[#CE9C68]">期間</p>
              <p className="text-sm text-[#F7EFE6] tabular-nums">{pkg.period.from} 〜 {pkg.period.to}</p>
            </div>
            <div>
              <p className="text-xs text-[#CE9C68] mb-1">あなたの仮名ID（プレビュー用）</p>
              <p className="text-[10px] text-[#6b5a4a] font-mono break-all leading-relaxed">{pkg.pseudoId}</p>
              <p className="text-[10px] text-[#6b5a4a] mt-1 leading-relaxed">
                このIDは提供先ごとに異なる値が生成されるため、企業間であなたを突合できません。
                名前・メールアドレス等の個人情報は含まれません。
              </p>
            </div>
          </div>

          <div className="bg-[#1a0a05] border border-[#2E2018] rounded-xl p-3">
            <p className="text-xs text-[#CE9C68] mb-2">送信されるJSONそのもの</p>
            <pre className="text-[10px] text-[#a8916f] font-mono leading-relaxed max-h-64 overflow-auto whitespace-pre">
              {JSON.stringify(pkg, null, 2)}
            </pre>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="w-full border border-[#CE9C68]/40 text-[#CE9C68] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-70"
          >
            <DownloadIcon size={16} />
            JSONをダウンロード
          </button>
        </section>
      )}

      {/* 常に除外 */}
      <section className="bg-[#2E2018] rounded-xl p-4">
        <p className="text-xs text-[#CE9C68] mb-2">どの範囲を選んでも、次の情報は絶対に含まれません</p>
        <div className="flex flex-wrap gap-1.5">
          {ALWAYS_EXCLUDED.map(item => (
            <span key={item} className="text-[10px] bg-[#3e3020] text-[#6b5a4a] px-2 py-1 rounded-full">
              {item}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
