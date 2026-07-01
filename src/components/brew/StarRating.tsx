interface Props {
  value: number
  onChange: (v: number) => void
}

export default function StarRating({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s === value ? 0 : s)}
          className={`text-3xl leading-none transition-transform active:scale-90 ${
            s <= value ? 'text-[#CE9C68]' : 'text-[#3e3020]'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
