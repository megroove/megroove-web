import { useState, useRef } from 'react'
import { exportBackup, parseBackupFile, importBackup, type ImportResult } from '../../db'

type ImportStep = 'idle' | 'preview' | 'importing' | 'done' | 'error'

export default function DataTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting,   setExporting]   = useState(false)
  const [step,        setStep]        = useState<ImportStep>('idle')
  const [preview,     setPreview]     = useState<ImportResult | null>(null)
  const [parsedData,  setParsedData]  = useState<Awaited<ReturnType<typeof parseBackupFile>> | null>(null)
  const [mode,        setMode]        = useState<'merge' | 'replace'>('merge')
  const [result,      setResult]      = useState<ImportResult | null>(null)
  const [errorMsg,    setErrorMsg]    = useState('')

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportBackup()
    } finally {
      setExporting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setStep('idle')
    setErrorMsg('')
    try {
      const data = await parseBackupFile(file)
      setParsedData(data)
      setPreview({
        beans:     data.beans?.length ?? 0,
        equipment: data.equipment?.length ?? 0,
        recipes:   data.recipes?.length ?? 0,
        brews:     data.brews?.length ?? 0,
      })
      setStep('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました')
      setStep('error')
    }
  }

  const handleImport = async () => {
    if (!parsedData) return
    setStep('importing')
    try {
      const r = await importBackup(parsedData, mode)
      setResult(r)
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'インポートに失敗しました')
      setStep('error')
    }
  }

  const reset = () => {
    setStep('idle')
    setParsedData(null)
    setPreview(null)
    setResult(null)
    setErrorMsg('')
  }

  return (
    <div className="flex flex-col gap-6">

      {/* エクスポート */}
      <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#F7EFE6]">データをエクスポート</h3>
          <p className="text-xs text-[#6b5a4a] mt-1">
            全記録（豆・器具・レシピ・ブリュー）をJSONファイルに書き出します。端末移行やバックアップに使用してください。
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
        >
          {exporting ? '書き出し中...' : '⬆ JSONファイルを書き出す'}
        </button>
      </section>

      {/* インポート */}
      <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F7EFE6]">データをインポート</h3>
          <p className="text-xs text-[#6b5a4a] mt-1">
            エクスポートしたJSONファイルを読み込みます。「完全置換」を選ぶと既存データがすべて削除されます。
          </p>
        </div>

        {/* idle / error */}
        {(step === 'idle' || step === 'error') && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-[#CE9C68]/40 text-[#CE9C68] py-3 rounded-xl text-sm font-semibold"
            >
              ⬇ JSONファイルを選択
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            {step === 'error' && (
              <p className="text-red-400 text-xs text-center">{errorMsg}</p>
            )}
          </>
        )}

        {/* preview */}
        {step === 'preview' && preview && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#3e3020] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-2">読み込み内容</p>
              {[
                ['豆',       preview.beans],
                ['器具',     preview.equipment],
                ['レシピ',   preview.recipes],
                ['ブリュー', preview.brews],
              ].map(([label, count]) => (
                <div key={label as string} className="flex justify-between py-1 border-b border-[#2e2018] last:border-0">
                  <span className="text-sm text-[#6b5a4a]">{label}</span>
                  <span className="text-sm text-[#F7EFE6] tabular-nums">{count}件</span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-[#CE9C68] mb-2">インポート方法</p>
              <div className="flex gap-2">
                {(['merge', 'replace'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm transition-colors ${
                      mode === m
                        ? 'bg-[#993C1D] text-[#F7EFE6]'
                        : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {m === 'merge' ? '追加インポート' : '完全置換'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#6b5a4a] mt-1.5">
                {mode === 'merge'
                  ? '既存データを残し、ファイルの内容を追加します（同じIDがあれば上書き）。'
                  : '⚠ 既存データをすべて削除してからインポートします。'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="flex-1 py-3 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleImport}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm ${
                  mode === 'replace'
                    ? 'bg-red-900 text-white'
                    : 'bg-[#993C1D] text-[#F7EFE6]'
                }`}
              >
                インポートする
              </button>
            </div>
          </div>
        )}

        {/* importing */}
        {step === 'importing' && (
          <p className="text-[#CE9C68] text-sm text-center py-4">インポート中...</p>
        )}

        {/* done */}
        {step === 'done' && result && (
          <div className="flex flex-col gap-3">
            <div className="bg-[#3e3020] rounded-xl p-4 text-center">
              <p className="text-[#F7EFE6] font-semibold mb-1">インポート完了</p>
              <p className="text-xs text-[#CE9C68]">
                豆{result.beans}・器具{result.equipment}・レシピ{result.recipes}・ブリュー{result.brews}件
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="w-full text-[#CE9C68] text-sm py-2"
            >
              閉じる
            </button>
          </div>
        )}
      </section>

      {/* 注意書き */}
      <p className="text-xs text-[#4a3a2a] text-center pb-2">
        ブラウザのデータ削除（キャッシュ消去など）でIndexedDBが失われる場合があります。
        定期的にエクスポートしてバックアップを保管してください。
      </p>
    </div>
  )
}
