import { useRef } from 'react'
import { resizeImage } from '../db'
import { CameraIcon } from './icons'

interface Props {
  value?: string
  onChange: (v: string | undefined) => void
  // 失敗時のメッセージ通知（呼び出し側でトースト等に流す）
  onError?: (msg: string) => void
  maxPx?: number
}

// 豆・器具など任意の写真フィールド。撮影/選択→リサイズ→プレビュー→削除。
// 記録（Brew）の写真ブロックと同じ作法（accept=image/* + capture、resizeImage(800)）。
export default function PhotoField({ value, onChange, onError, maxPx = 800 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border border-dashed border-[#CE9C68]/40 text-[#CE9C68] py-6 rounded-xl text-sm flex items-center justify-center gap-2 active:opacity-70"
        >
          <CameraIcon size={20} />
          <span>写真を追加</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            onChange(await resizeImage(file, maxPx))
          } catch (err) {
            onError?.(err instanceof Error ? err.message : '写真の読み込みに失敗しました')
          }
        }}
      />
    </div>
  )
}
