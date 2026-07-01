import { useNavigate } from 'react-router-dom'
import DataTab from '../components/stock/DataTab'

export default function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm shrink-0">
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
      </section>

      {/* データ管理 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
          データ管理
        </h3>
        <DataTab />
      </section>
    </div>
  )
}
