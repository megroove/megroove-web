import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/',          label: 'ホーム',     icon: '⌂' },
  { to: '/library',   label: 'ライブラリ', icon: '📋' },
  { to: '/stock',     label: 'ストック',   icon: '◫' },
  { to: '/analysis',  label: '分析',       icon: '◎' },
  { to: '/caffeine',  label: 'カフェイン', icon: '⚡' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#2E2018] border-t border-[#3e3020] flex">
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-3 gap-0.5 text-xs transition-colors ${
              isActive ? 'text-[#CE9C68]' : 'text-[#6b5a4a]'
            }`
          }
        >
          <span className="text-xl leading-none">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
