import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Brew, Bean, Equipment, Recipe } from '../db'
import {
  getBrew, getBean, getEquipment, getRecipe, deleteBrew, putBrew,
  calcRatio, formatBrewDate, ROAST_LEVEL_LABELS, daysSinceRoast,
} from '../db'
import PhotoLightbox from '../components/PhotoLightbox'
import { useToast, notifyDataRestored } from '../components/Toast'
import { CupIcon } from '../components/icons'

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
      <span className="text-sm text-[#F7EFE6] font-medium tabular-nums">{value}</span>
    </div>
  )
}

const CUPPING_LABELS = {
  acidity: '酸味', sweetness: '甘み', bitterness: '苦味',
  body: 'ボディ', aftertaste: '後味',
} as const

export default function BrewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showToast = useToast()

  const [brew, setBrew] = useState<Brew | null>(null)
  const [bean, setBean] = useState<Bean | undefined>()
  const [equipment, setEquipment] = useState<Equipment | undefined>()
  const [recipe, setRecipe] = useState<Recipe | undefined>()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    getBrew(id).then(b => {
      if (!b) { navigate('/library', { replace: true }); return }
      setBrew(b)
      if (b.beanId) getBean(b.beanId).then(setBean)
      if (b.equipmentId) getEquipment(b.equipmentId).then(setEquipment)
      if (b.recipeId) getRecipe(b.recipeId).then(setRecipe)
    })
  }, [id, navigate])

  if (!brew) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#6b5a4a] text-sm">読み込み中...</p>
      </div>
    )
  }

  const hasCupping = Object.values(brew.cupping).some(v => v !== undefined)

  const handleDelete = async () => {
    const snapshot = brew
    try {
      await deleteBrew(brew.id)
    } catch {
      showToast('削除に失敗しました', { type: 'error' })
      return
    }
    navigate('/library', { replace: true })
    showToast('記録を削除しました', {
      action: {
        label: '取り消す',
        onClick: () => {
          putBrew(snapshot)
            .then(() => { notifyDataRestored(); showToast('削除を取り消しました', { type: 'success' }) })
            .catch(() => showToast('復元に失敗しました', { type: 'error' }))
        },
      },
    })
  }

  const handleReproduce = () => {
    navigate('/brew', { state: { fromBrewId: brew.id } })
  }

  const handleEdit = () => {
    navigate(`/brew/edit/${brew.id}`)
  }

  return (
    <div className="flex flex-col flex-1">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2018]">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="text-[#CE9C68] text-sm"
        >
          ← ライブラリ
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="text-[#CE9C68] text-sm font-medium"
        >
          編集
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {/* 日時 */}
        <div>
          <p className="text-[#F7EFE6] text-lg font-semibold">{formatBrewDate(brew.brewedAt)}</p>
          {brew.rating && (
            <p className="text-[#CE9C68] text-xl mt-1">
              {'★'.repeat(brew.rating)}{'☆'.repeat(5 - brew.rating)}
            </p>
          )}
        </div>

        {/* 写真 */}
        {brew.photoDataUrl && (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="rounded-xl overflow-hidden w-full active:opacity-80"
            >
              <img
                src={brew.photoDataUrl}
                alt="記録の写真"
                className="w-full object-cover max-h-72"
              />
            </button>
            {lightboxOpen && (
              <PhotoLightbox src={brew.photoDataUrl} onClose={() => setLightboxOpen(false)} />
            )}
          </>
        )}

        {/* 豆 */}
        {bean && (
          <Section title="豆">
            <p className="text-[#F7EFE6] font-semibold mb-1">{bean.name}</p>
            <p className="text-sm text-[#CE9C68]">
              {ROAST_LEVEL_LABELS[bean.roastLevel]}
              {bean.roastedAt ? ` · 焙煎から${daysSinceRoast(bean.roastedAt)}日` : ''}
              {bean.origin ? ` · ${bean.origin}` : ''}
            </p>
          </Section>
        )}

        {/* 抽出条件 */}
        <Section title="抽出条件">
          {brew.doseG !== undefined && brew.waterG !== undefined && (
            <Row
              label="粉量 / 湯量 / 比率"
              value={`${brew.doseG}g / ${brew.waterG}g / ${calcRatio(brew.doseG, brew.waterG)}`}
            />
          )}
          {brew.grindSize !== undefined && <Row label="挽き目" value={brew.grindSize} />}
          {brew.tempC !== undefined && <Row label="湯温" value={`${brew.tempC}°C`} />}
          {recipe && <Row label="レシピ" value={recipe.name} />}
          {equipment && <Row label="器具" value={equipment.name} />}
          {brew.totalTimeSec !== undefined && (
            <Row
              label="総抽出時間"
              value={`${Math.floor(brew.totalTimeSec / 60)}:${String(brew.totalTimeSec % 60).padStart(2, '0')}`}
            />
          )}
          {brew.pourCount !== undefined && <Row label="注湯回数" value={`${brew.pourCount}回`} />}
        </Section>

        {/* フレーバー */}
        {brew.flavors.length > 0 && (
          <Section title="フレーバー">
            <div className="flex flex-wrap gap-2">
              {brew.flavors.map(f => (
                <span key={f} className="bg-[#3e3020] text-[#CE9C68] text-sm px-3 py-1 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* カッピング */}
        {hasCupping && (
          <Section title="カッピング">
            {(Object.entries(CUPPING_LABELS) as [keyof typeof CUPPING_LABELS, string][]).map(
              ([key, label]) =>
                brew.cupping[key] !== undefined ? (
                  <Row key={key} label={label} value={brew.cupping[key]!.toFixed(1)} />
                ) : null
            )}
            {brew.cuppingAverage !== undefined && (
              <div className="mt-2 pt-2 border-t border-[#3e3020] flex justify-between">
                <span className="text-xs text-[#CE9C68]">平均</span>
                <span className="text-sm text-[#993C1D] font-semibold">
                  {brew.cuppingAverage.toFixed(2)}
                </span>
              </div>
            )}
          </Section>
        )}

        {/* メモ */}
        {brew.note && (
          <Section title="メモ">
            <p className="text-sm text-[#F7EFE6] whitespace-pre-wrap leading-relaxed">{brew.note}</p>
          </Section>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col gap-3 mt-2 mb-2">
          <button
            type="button"
            onClick={handleReproduce}
            className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl font-semibold active:opacity-80 flex items-center justify-center gap-2"
          >
            <CupIcon size={20} />
            この条件で淹れる
          </button>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-[#6b5a4a] text-sm py-2"
            >
              この記録を削除
            </button>
          ) : (
            <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm text-[#F7EFE6] text-center">この記録を削除しますか？</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl bg-red-900 text-white text-sm font-semibold"
                >
                  削除する
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
