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
      className="fixed bottom-0 left-0 right-0 bg-[#2E2018] border-t border-[#3e3020] flex"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2.5 gap-1 text-[10px] transition-colors ${
              isActive ? 'text-[#CE9C68]' : 'text-[#6b5a4a]'
            }`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
