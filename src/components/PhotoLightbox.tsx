import { useEffect, useState } from 'react'

export default function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 overflow-auto"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed right-4 w-11 h-11 flex items-center justify-center text-white/60 text-xl bg-white/10 rounded-full active:bg-white/20 z-10"
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        ✕
      </button>
      {/* タップで等倍⇄拡大を切り替え。拡大時はスクロールで見る位置を移動できる */}
      <div className={zoomed ? 'min-w-full min-h-full w-max' : 'w-full h-full flex items-center justify-center'}>
        <img
          src={src}
          alt="写真"
          className={
            zoomed
              ? 'max-w-none w-[200vw] cursor-zoom-out select-none'
              : 'max-w-full max-h-svh object-contain cursor-zoom-in select-none'
          }
          onClick={e => { e.stopPropagation(); setZoomed(z => !z) }}
          draggable={false}
        />
      </div>
    </div>
  )
}
