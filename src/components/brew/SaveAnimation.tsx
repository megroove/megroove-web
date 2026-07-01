import { useEffect, useMemo } from 'react'
import RecordDisk from './RecordDisk'

const MILESTONES = new Set([1, 10, 30, 50, 100, 200, 365, 500, 1000])

interface Props {
  brewCount: number
  onDone: () => void
}

function Confetti() {
  const COLORS = ['#993C1D', '#CE9C68', '#F7EFE6', '#FFD700', '#c0753d']
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        color: COLORS[i % COLORS.length],
        left: `${5 + (i / 27) * 90}%`,
        delay: `${(Math.sin(i) * 0.5 + 0.5) * 0.5}s`,
        duration: `${1.5 + (Math.cos(i) * 0.5 + 0.5) * 0.8}s`,
        isCircle: i % 3 !== 0,
        size: 8 + (i % 3) * 4,
      })),
    []
  )

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[60]">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: p.left,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}

export default function SaveAnimation({ brewCount, onDone }: Props) {
  const isMilestone = MILESTONES.has(brewCount)

  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate(isMilestone ? [30, 50, 30] : 30)
    if (!isMilestone) {
      const t = setTimeout(onDone, 1400)
      return () => clearTimeout(t)
    }
  }, [isMilestone, onDone])

  if (isMilestone) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6"
        onClick={onDone}
      >
        <Confetti />
        <div style={{ animation: 'milestone-pop 0.5s ease-out forwards' }}>
          <p className="text-7xl font-bold text-[#F7EFE6] text-center tabular-nums">{brewCount}</p>
          <p className="text-2xl text-[#CE9C68] text-center mt-2 font-semibold">杯目！</p>
        </div>
        <p className="text-xs text-[#6b5a4a] mt-4">タップして続ける</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-6 pointer-events-none">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-[#CE9C68]"
          style={{
            width: '80px',
            height: '80px',
            animation: `ripple-out 1.1s ease-out ${i * 0.22}s forwards`,
          }}
        />
      ))}
      <div style={{ animation: 'disk-in 0.55s 0.15s ease-out both' }}>
        <RecordDisk size={120} />
      </div>
      <p
        className="text-[#F7EFE6] text-base font-medium"
        style={{ animation: 'disk-in 0.45s 0.45s ease-out both' }}
      >
        一杯を記録しました
      </p>
    </div>
  )
}
