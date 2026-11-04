import { useEffect, useRef, useState } from 'react'
import RecordDisk from '../brew/RecordDisk'
import { CameraIcon } from '../icons'
import { labelScanErrorMessage, type BeanLabelResult } from './labelScan'
import {
  analyzeLabel, hasLabelScanConsent, saveLabelScanConsent, TURNSTILE_SITE_KEY,
} from './labelScanClient'
import { loadTurnstile } from './turnstile'

const MAX_PHOTOS = 3

interface Props {
  /** 豆のリスト画像（あれば「リスト画像も解析に使う」を出す） */
  listImage?: string
  /** 結果を受け取り、フォームに入れた欄の数を返す */
  onResult: (result: BeanLabelResult) => number
}

type Status =
  | { kind: 'idle' }
  | { kind: 'consent' }
  | { kind: 'analyzing' }
  | { kind: 'done'; filled: number }
  | { kind: 'error'; message: string }

// 豆フォームの先頭に置く「ラベルから読み取る」。解析用の写真はこの画面の中だけで使い、保存しない。
export default function LabelScanSection({ listImage, onResult }: Props) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<{ file: File; url: string }[]>([])
  const [useListImage, setUseListImage] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  // 開いたときだけ Turnstile を読み込む（使わない人の端末からは何も送らない）
  useEffect(() => {
    if (!open || !widgetRef.current || !TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadTurnstile().then(ts => {
      if (cancelled || !widgetRef.current || widgetId.current) return
      widgetId.current = ts.render(widgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only', // 確認が要るときだけ表に出る
        theme: 'dark',
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(null),
        'error-callback': () => setToken(null),
      })
    }).catch(() => setStatus({ kind: 'error', message: labelScanErrorMessage('network') }))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [open])

  // プレビュー用の URL は、外したとき・画面を閉じたときに解放する
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => filesRef.current.forEach(f => URL.revokeObjectURL(f.url)), [])
  const clearFiles = () => { files.forEach(f => URL.revokeObjectURL(f.url)); setFiles([]) }
  const removeFile = (i: number) => {
    URL.revokeObjectURL(files[i].url)
    setFiles(prev => prev.filter((_, j) => j !== i))
  }

  const listCount = useListImage && listImage ? 1 : 0
  const room = MAX_PHOTOS - files.length - listCount

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const picked = [...list].slice(0, Math.max(0, room)).map(file => ({ file, url: URL.createObjectURL(file) }))
    setFiles(prev => [...prev, ...picked])
    setStatus({ kind: 'idle' })
  }

  const resetToken = () => {
    setToken(null)
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current) // トークンは1回きり
  }

  const run = async () => {
    if (!token) return
    setStatus({ kind: 'analyzing' })
    const outcome = await analyzeLabel(files.map(f => f.file), useListImage ? listImage : undefined, token)
    resetToken()
    if (!outcome.ok) { setStatus({ kind: 'error', message: labelScanErrorMessage(outcome.error) }); return }
    const filled = onResult(outcome.result)
    clearFiles() // 解析用の写真はここで手放す（保存しない）
    setUseListImage(false)
    setStatus({ kind: 'done', filled })
  }

  const handleRead = () => {
    if (!hasLabelScanConsent()) { setStatus({ kind: 'consent' }); return }
    void run()
  }

  const hasImages = files.length + listCount > 0
  const analyzing = status.kind === 'analyzing'

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-[#2E2018] rounded-xl p-4 flex items-center gap-3 text-left active:opacity-80"
      >
        <span className="text-[#CE9C68] shrink-0"><CameraIcon size={22} /></span>
        <span className="min-w-0">
          <span className="block text-sm text-[#F7EFE6] font-medium">ラベルから読み取る（AI）</span>
          <span className="block text-xs text-[#A8916F] mt-0.5">袋の裏のラベルを撮ると、読み取れた項目を下書きに入れます</span>
        </span>
      </button>
    )
  }

  return (
    <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#F7EFE6] font-medium">ラベルから読み取る（AI）</p>
        <button type="button" onClick={() => setOpen(false)} disabled={analyzing} className="min-h-11 px-2 text-xs text-[#A8916F]">
          閉じる
        </button>
      </div>

      {analyzing ? (
        <div className="py-6 flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div style={{ animation: 'disk-spin 1.8s linear infinite' }}><RecordDisk size={84} /></div>
          <p className="text-sm text-[#CE9C68]">ラベルを読んでいます…</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#A8916F] leading-relaxed">
            情報が書かれた面（裏のラベルなど）を最大{MAX_PHOTOS}枚。写真は読み取りにだけ使い、保存しません。
          </p>

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={f.url} className="relative aspect-square">
                  <img src={f.url} alt={`解析用の写真${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`解析用の写真${i + 1}を外す`}
                    className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {room > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex-1 min-h-11 border border-dashed border-[#CE9C68]/40 text-[#CE9C68] rounded-xl text-sm flex items-center justify-center gap-2 active:opacity-70"
              >
                <CameraIcon size={18} /> 撮影する
              </button>
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                className="shrink-0 min-h-11 px-4 border border-dashed border-[#CE9C68]/40 text-[#CE9C68] rounded-xl text-sm active:opacity-70"
              >
                アルバムから
              </button>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />

          {listImage && (
            <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                checked={useListImage}
                disabled={!useListImage && room <= 0}
                onChange={e => setUseListImage(e.target.checked)}
                className="w-5 h-5 accent-[#993C1D] shrink-0"
              />
              <span className="text-sm text-[#F7EFE6]">リスト画像も解析に使う（表面に情報があるとき）</span>
            </label>
          )}

          {status.kind === 'consent' ? (
            <div className="bg-[#1a0a05] rounded-xl p-3.5 flex flex-col gap-3">
              <p className="text-xs text-[#F7EFE6] leading-relaxed">
                読み取りのため、選んだ写真を <strong>Anthropic 社の AI（Claude）</strong>に送ります。
                写真はサーバーにも端末にも保存されません。結果は下書きとして入るだけで、確認してから保存できます。
                詳しくは設定のプライバシーポリシーをご覧ください。
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { saveLabelScanConsent(); void run() }}
                  className="flex-1 min-h-11 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold active:opacity-80"
                >
                  同意して読み取る
                </button>
                <button
                  type="button"
                  onClick={() => setStatus({ kind: 'idle' })}
                  className="min-h-11 px-4 rounded-xl text-sm text-[#A8916F]"
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRead}
              disabled={!hasImages || !token}
              className="w-full min-h-11 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold disabled:opacity-40 active:opacity-80"
            >
              {hasImages && !token ? '準備しています…' : '読み取る'}
            </button>
          )}

          {status.kind === 'done' && (
            <p className="text-xs text-[#CE9C68] leading-relaxed" role="status">
              {status.filled > 0
                ? `${status.filled}項目を下書きに入れました（AI の印）。内容を確かめてから保存してください。入力済みの欄はそのままです`
                : '新しく入れられる項目はありませんでした（入力済みの欄はそのままです）'}
            </p>
          )}
          {status.kind === 'error' && (
            <p className="text-xs text-[#E8A27A] leading-relaxed" role="alert">{status.message}</p>
          )}
        </>
      )}

      {/* Turnstile（確認が要るときだけ表示される） */}
      <div ref={widgetRef} />
    </div>
  )
}
