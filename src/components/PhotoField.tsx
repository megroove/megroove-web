import { useRef } from 'react'
import { resizeImage } from '../db'
import { CameraIcon } from './icons'

interface Props {
  value?: string
  onChange: (v: string | undefined) => void
  // 失敗時のメッセージ通知（呼び出し側でトースト等に流す）
  onError?: (msg: string) => void
  maxPx?: number
  format?: 'jpeg' | 'webp'
  /** 空のときのボタン文言 */
  emptyLabel?: string
  /**
   * 「アルバムから選ぶ」ボタンも出す。iOS は capture があるとカメラが直接開き、
   * アルバムを選べないため、capture なしの入力を別に用意する
   */
  allowLibrary?: boolean
}

// 豆・器具など任意の写真フィールド。撮影/選択→リサイズ→プレビュー→削除。
// 記録（Brew）の写真ブロックと同じ作法（accept=image/* + capture、resizeImage(800)）。
export default function PhotoField({
  value, onChange, onError, maxPx = 800, format = 'jpeg', emptyLabel = '写真を追加', allowLibrary = false,
}: Props) {
  const cameraRef  = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      onChange(await resizeImage(file, maxPx, format))
    } catch (err) {
      onError?.(err instanceof Error ? err.message : '写真の読み込みに失敗しました')
    }
  }

  return (
    <div>
      {value ? (
        <div className="relative">
          <img src={value} alt="写真" className="w-full rounded-lg object-cover max-h-56" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full active:opacity-70"
          >
            削除
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 border border-dashed border-[#CE9C68]/40 text-[#CE9C68] py-6 rounded-xl text-sm flex items-center justify-center gap-2 active:opacity-70"
          >
            <CameraIcon size={20} />
            <span>{emptyLabel}</span>
          </button>
          {allowLibrary && (
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="shrink-0 px-4 border border-dashed border-[#CE9C68]/40 text-[#CE9C68] rounded-xl text-sm active:opacity-70"
            >
              アルバムから
            </button>
          )}
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {allowLibrary && (
        <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      )}
    </div>
  )
}
