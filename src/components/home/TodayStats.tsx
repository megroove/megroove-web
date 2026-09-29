interface Props {
  cups: number
  residualMg: number
  streak: number
  onCaffeine: () => void
}

function Cell({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <>
      <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">
        {value}
        <span className="text-xs font-normal text-[#CE9C68] ml-0.5">{unit}</span>
      </p>
      <p className="text-[10px] text-[#A8916F] mt-1">{label}</p>
    </>
  )
}

// 今日の数値。3枚のカードに散らすと余白を食うので、1枚に3分割で収める。
export default function TodayStats({ cups, residualMg, streak, onCaffeine }: Props) {
  return (
    <div className="bg-[#2E2018] rounded-xl grid grid-cols-3 divide-x divide-[#3e3020] py-3">
      <div className="px-2 text-center">
        <Cell value={cups} unit="杯" label="今日" />
      </div>
      {/* カフェインだけは詳細画面への入口を兼ねる */}
      <button type="button" onClick={onCaffeine} className="px-2 text-center active:opacity-80">
        <Cell value={residualMg} unit="mg" label="体内残留(推定)" />
      </button>
      <div className="px-2 text-center">
        <Cell value={streak} unit="日" label="連続記録" />
      </div>
    </div>
  )
}
