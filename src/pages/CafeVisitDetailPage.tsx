import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CafeVisit } from '../db'
import {
  getCafeVisit, deleteCafeVisit, putCafeVisit,
  CAFE_DRINK_TYPE_LABELS, CAFE_DRINK_SIZE_LABELS,
  formatBrewDate,
} from '../db'
import PhotoLightbox from '../components/PhotoLightbox'
import { useToast, notifyDataRestored } from '../components/Toast'

const CUPPING_LABELS: Record<string, string> = {
  acidity: '酸味', sweetness: '甘み', bitterness: '苦味',
  body: 'ボディ', aftertaste: '後味',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#2E2018] rounded-xl p-4">
      <p className="text-xs text-[#CE9C68] mb-3 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-[#3e3020] last:border-0">
      <span className="text-xs text-[#6b5a4a]">{label}</span>
      <span className="text-sm text-[#F7EFE6] font-medium">{value}</span>
    </div>
  )
}

export default function CafeVisitDetailPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { id } = useParams<{ id: string }>()
  const [visit, setVisit] = useState<CafeVisit | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    getCafeVisit(id).then(v => setVisit(v ?? null))
  }, [id])

  if (!visit) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#6b5a4a] text-sm">
        読み込み中...
      </div>
    )
  }

  const handleDelete = async () => {
    const snapshot = visit
    try {
      await deleteCafeVisit(visit.id)
    } catch {
      showToast('削除に失敗しました', { type: 'error' })
      return
    }
    navigate('/library', { state: { tab: 'cafe' }, replace: true })
    showToast('記録を削除しました', {
      action: {
        label: '取り消す',
        onClick: () => {
          putCafeVisit(snapshot)
            .then(() => { notifyDataRestored(); showToast('削除を取り消しました', { type: 'success' }) })
            .catch(() => showToast('復元に失敗しました', { type: 'error' }))
        },
      },
    })
  }

  const stars = visit.rating
    ? '★'.repeat(visit.rating) + '☆'.repeat(5 - visit.rating)
    : undefined

  const hasCupping = visit.cupping && Object.values(visit.cupping).some(v => v !== undefined)

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm -mb-2">
        ← 戻る
      </button>

      {/* ヘッダー */}
      <div>
        <p className="text-xs text-[#CE9C68] mb-1">{formatBrewDate(visit.visitedAt)}</p>
        <h2 className="text-2xl font-semibold text-[#F7EFE6]">{visit.cafeName}</h2>
        {(visit.drinkName || visit.drinkType) && (
          <p className="text-base text-[#CE9C68] mt-0.5">
            {visit.drinkName ?? ''}
            {visit.drinkType ? ` · ${CAFE_DRINK_TYPE_LABELS[visit.drinkType]}` : ''}
            {visit.size ? ` · ${CAFE_DRINK_SIZE_LABELS[visit.size]}` : ''}
          </p>
        )}
        {stars && <p className="text-[#CE9C68] text-lg mt-1 tracking-tight">{stars}</p>}
      </div>

      {/* 写真 */}
      {visit.photoDataUrl && (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="rounded-xl overflow-hidden w-full -mt-1 active:opacity-80"
          >
            <img
              src={visit.photoDataUrl}
              alt="記録の写真"
              className="w-full object-cover max-h-72"
            />
          </button>
          {lightboxOpen && (
            <PhotoLightbox src={visit.photoDataUrl} onClose={() => setLightboxOpen(false)} />
          )}
        </>
      )}

      {/* フレーバー */}
      {visit.flavors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visit.flavors.map(f => (
            <span key={f} className="text-sm bg-[#2E2018] text-[#CE9C68] px-3 py-1 rounded-full">{f}</span>
          ))}
        </div>
      )}

      {/* ドリンク情報 */}
      <Section title="ドリンク情報">
        {visit.drinkType && <Row label="種類" value={CAFE_DRINK_TYPE_LABELS[visit.drinkType]} />}
        {visit.size && <Row label="サイズ" value={CAFE_DRINK_SIZE_LABELS[visit.size]} />}
        {visit.decaf && <Row label="デカフェ" value="はい" />}
        {visit.scene && <Row label="シーン" value={visit.scene} />}
        {(visit.drinkStyle?.length ?? 0) > 0 && (
          <Row label="飲み方" value={visit.drinkStyle!.join('・')} />
        )}
        {visit.beanOrigin && <Row label="豆の産地" value={visit.beanOrigin} />}
        {visit.price != null && <Row label="価格" value={`¥${visit.price.toLocaleString()}`} />}
        {visit.caffeineAmount != null && (
          <Row label="推定カフェイン" value={`${visit.caffeineAmount}mg`} />
        )}
      </Section>

      {/* カッピング */}
      {hasCupping && (
        <Section title="カッピング">
          {Object.entries(CUPPING_LABELS).map(([key, label]) => {
            const val = visit.cupping?.[key as keyof typeof visit.cupping]
            return val !== undefined ? (
              <Row key={key} label={label} value={val.toFixed(1)} />
            ) : null
          })}
          {visit.cuppingAverage !== undefined && (
            <div className="mt-2 pt-2 border-t border-[#3e3020] flex justify-between">
              <span className="text-xs text-[#CE9C68]">平均</span>
              <span className="text-sm text-[#993C1D] font-semibold">
                {visit.cuppingAverage.toFixed(2)}
              </span>
            </div>
          )}
        </Section>
      )}

      {/* メモ */}
      {visit.note && (
        <Section title="メモ">
          <p className="text-sm text-[#F7EFE6] whitespace-pre-wrap leading-relaxed">{visit.note}</p>
        </Section>
      )}

      {/* アクション */}
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={() => navigate(`/cafe/edit/${visit.id}`)}
          className="flex-1 bg-[#2E2018] text-[#CE9C68] py-3 rounded-xl text-sm font-semibold active:opacity-80"
        >
          編集する
        </button>
        <button type="button" onClick={() => setShowDeleteConfirm(true)}
          className="flex-1 bg-[#2E2018] text-red-400 py-3 rounded-xl text-sm font-semibold active:opacity-80"
        >
          削除する
        </button>
      </div>

      {/* 削除確認 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 px-4 pb-8">
          <div className="bg-[#2E2018] rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <p className="text-[#F7EFE6] font-semibold text-center">この記録を削除しますか？</p>
            <p className="text-[#6b5a4a] text-sm text-center">「{visit.cafeName}」の記録が削除されます。</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-[#3e3020] text-[#CE9C68] py-3 rounded-xl text-sm">
                キャンセル
              </button>
              <button type="button" onClick={handleDelete}
                className="flex-1 bg-red-900 text-white py-3 rounded-xl text-sm font-semibold">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
