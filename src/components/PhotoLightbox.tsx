import { useEffect } from 'react'

export default function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-safe-or-4 right-4 w-11 h-11 flex items-center justify-center text-white/60 text-xl bg-white/10 rounded-full active:bg-white/20"
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        ✕
      </button>
      <img
        src={src}
        alt="写真"
        className="max-w-full max-h-full object-contain select-none"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />
    </div>
  )
}
