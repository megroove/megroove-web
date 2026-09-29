interface Props {
  /** 見出し1行。状態ではなく「これから何が起きるか」に寄せる */
  title: string
  /** 説明1行。2行を超えないこと（説明的すぎると世界観が薄まる） */
  description?: string
  /** 行動はひとつだけ。既に画面内に追加ボタンがある場合は置かない */
  action?: { label: string; onClick: () => void }
}

// 空状態の共通形。「まだありません」で終わらせず、次の一歩を示す。
// 文字色は G-5 で決めた基準（#A8916F 以上＝コントラスト比 4.5:1 以上）を守る。
export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6">
      <p className="text-sm text-[#F7EFE6] font-medium">{title}</p>
      {description && (
        <p className="text-xs text-[#A8916F] leading-relaxed max-w-xs">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 min-h-11 px-5 rounded-2xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold active:opacity-80"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
