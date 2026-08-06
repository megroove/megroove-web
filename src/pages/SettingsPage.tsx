import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTab from '../components/stock/DataTab'
import { loadSettings, saveSettings } from '../db'
import { MoonIcon } from '../components/icons'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [sleepOn, setSleepOn] = useState(() => loadSettings().sleepTrackingEnabled)

  const toggleSleep = () => {
    const next = { ...loadSettings(), sleepTrackingEnabled: !sleepOn }
    saveSettings(next)
    setSleepOn(next.sleepTrackingEnabled)
  }

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-6 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm self-start">
          ← 戻る
        </button>
        <h2 className="text-xl font-semibold text-[#F7EFE6]">設定</h2>
      </div>

      {/* メニュー */}
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate('/settings/brew-layout')}
          className="w-full bg-[#2E2018] rounded-xl px-4 py-4 flex items-center justify-between active:opacity-80"
        >
          <div className="text-left">
            <p className="text-sm text-[#F7EFE6]">記録画面のカスタマイズ</p>
            <p className="text-xs text-[#6b5a4a] mt-0.5">表示項目の並び順・メイン／詳細の振り分け</p>
          </div>
          <span className="text-[#6b5a4a] text-sm ml-3">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings/data-provision')}
          className="w-full bg-[#2E2018] rounded-xl px-4 py-4 flex items-center justify-between active:opacity-80"
        >
          <div className="text-left">
            <p className="text-sm text-[#F7EFE6]">データ提供の準備 <span className="text-[10px] text-[#993C1D] font-semibold ml-1">PREVIEW</span></p>
            <p className="text-xs text-[#6b5a4a] mt-0.5">提供パッケージの内容確認・ダウンロード（送信はしません）</p>
          </div>
          <span className="text-[#6b5a4a] text-sm ml-3">→</span>
        </button>
      </section>

      {/* 機能 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">機能</h3>
        <div className="w-full bg-[#2E2018] rounded-xl px-4 py-4 flex items-center justify-between">
          <div className="text-left pr-3">
            <p className="text-sm text-[#F7EFE6] flex items-center gap-1.5"><MoonIcon size={15} /> 睡眠の記録（任意）</p>
            <p className="text-xs text-[#6b5a4a] mt-0.5 leading-relaxed">
              朝にワンタップで眠りを記録し、カフェインとの傾向を数値で確認できます。オフにしても記録は残ります。
            </p>
          </div>
          <button type="button" onClick={toggleSleep}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              sleepOn ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
            }`}
          >
            {sleepOn ? 'オン' : 'オフ'}
          </button>
        </div>
      </section>

      {/* データ管理 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
          データ管理
        </h3>
        <DataTab />
      </section>

      {/* このアプリについて */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
          このアプリについて
        </h3>
        <button
          type="button"
          onClick={() => navigate('/settings/privacy')}
          className="w-full bg-[#2E2018] rounded-xl px-4 py-4 flex items-center justify-between active:opacity-80"
        >
          <p className="text-sm text-[#F7EFE6]">プライバシーポリシー</p>
          <span className="text-[#6b5a4a] text-sm ml-3">→</span>
        </button>
        <a
          href="mailto:megroove.app@gmail.com"
          className="w-full bg-[#2E2018] rounded-xl px-4 py-4 flex items-center justify-between active:opacity-80"
        >
          <div className="text-left">
            <p className="text-sm text-[#F7EFE6]">お問い合わせ</p>
            <p className="text-xs text-[#6b5a4a] mt-0.5">megroove.app@gmail.com</p>
          </div>
          <span className="text-[#6b5a4a] text-sm ml-3">→</span>
        </a>
      </section>
    </div>
  )
}
