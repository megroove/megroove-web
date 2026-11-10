import type { AffiliateItem } from '../monetization'

// 好みプロファイルの下に置くアフィリエイト枠。広告であることを必ず先に示す（ステマ規制）。
// 文字のリンクだけ＝画像やタグを読み込まない。rel="sponsored" で検索エンジンにも広告と伝える
export default function AffiliatePicks({ items }: { items: AffiliateItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="w-full border-t border-[#3e3020] pt-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[#F7EFE6] border border-[#A8916F] rounded px-1.5 py-0.5">PR</span>
        <p className="text-xs text-[#A8916F]">あなたの好みに合いそうな豆・道具（広告・アフィリエイトを含みます）</p>
      </div>
      {items.map(item => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="bg-[#1a0a05] rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-11 active:opacity-80"
        >
          <span className="min-w-0">
            <span className="block text-sm text-[#F7EFE6]">{item.title}</span>
            {item.description && <span className="block text-xs text-[#A8916F] mt-0.5">{item.description}</span>}
          </span>
          <span className="text-[#A8916F] text-sm shrink-0" aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  )
}
