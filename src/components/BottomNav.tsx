import { NavLink } from 'react-router-dom'
import { HomeIcon, DiscIcon, StockIcon, AnalysisIcon, CaffeineIcon } from './icons'

const tabs = [
  { to: '/',          label: 'ホーム',     Icon: HomeIcon },
  { to: '/library',   label: 'ライブラリ', Icon: DiscIcon },
  { to: '/stock',     label: 'ストック',   Icon: StockIcon },
  { to: '/analysis',  label: '分析',       Icon: AnalysisIcon },
  { to: '/caffeine',  label: 'カフェイン', Icon: CaffeineIcon },
]

export default function BottomNav() {
  return (
    <nav
      className="shrink-0 relative z-20 bg-[#2E2018] border-t border-[#3e3020] flex"
      // ホームインジケータぶんの余白は要るが、丸ごと空けると帯が厚くなりすぎる。
      // 上限を設けて逃げは残しつつ、見た目の余白を詰める（安全でない環境では 0 のまま）
      style={{ paddingBottom: 'min(env(safe-area-inset-bottom), 20px)' }}
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            // min-h-11 = 44px。高さを詰めてもタップ領域は 44px を下回らせない
            `relative flex-1 min-h-11 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
              isActive ? 'text-[#CE9C68]' : 'text-[#A8916F]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* 選択中の手がかりを色だけに頼らない（色覚の差で判別できない状態を避ける） */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-[#CE9C68]" />
              )}
              <Icon size={20} />
              <span className={isActive ? 'font-semibold' : undefined}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
