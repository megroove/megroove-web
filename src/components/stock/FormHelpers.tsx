import { useState } from 'react'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[#CE9C68] mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

export function TextInput({
  value, onChange, placeholder, autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a] text-sm"
    />
  )
}

export function NumberInput({
  value, onChange, placeholder, min,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  min?: number
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
      placeholder={placeholder ?? '—'}
      min={min}
      className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a] text-sm tabular-nums"
    />
  )
}

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none text-sm"
    />
  )
}

export function ChipSelect<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            o.value === value
              ? 'bg-[#993C1D] text-[#F7EFE6]'
              : 'bg-[#3e3020] text-[#CE9C68]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-3">
        <p className="text-sm text-[#F7EFE6] text-center">{label}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="flex-1 py-3 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 py-3 rounded-xl bg-red-900 text-white text-sm font-semibold"
          >
            削除する
          </button>
        </div>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="w-full text-[#6b5a4a] text-sm py-2"
    >
      {label}
    </button>
  )
}

export function ModalSheet({
  open, children,
}: {
  open: boolean
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end">
      <div
        className="bg-[#1a0a05] w-full rounded-t-2xl flex flex-col"
        style={{ animation: 'fade-up 0.2s ease-out', maxHeight: '90svh' }}
      >
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export function SaveButton({
  label = '保存', disabled, saving, onClick,
}: {
  label?: string
  disabled?: boolean
  saving?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl font-semibold disabled:opacity-40"
    >
      {saving ? '保存中...' : label}
    </button>
  )
}
