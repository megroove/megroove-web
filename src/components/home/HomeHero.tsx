import HomeTurntable from './HomeTurntable'
import { CafeIcon, GearIcon, PlayIcon } from '../icons'

interface Props {
  greeting: string
  /** 記録が1件でもあるか。無いうちは「最初の一杯」に寄せ、針も上げたままにする */
  hasRecords: boolean
  onBrew: () => void
  onCafe: () => void
  onSettings: () => void
}

// ホームの主役。盤（ターンテーブル）を大きく置き、「淹れる」を主CTAにする。
// 盤は**回さない**（回るのは抽出中だけ。演出を安売りしない）し、タップもさせない
// ＝操作は下のボタンに一本化して「押せそうで押せない」迷いを作らない。
export default function HomeHero({ greeting, hasRecords, onBrew, onCafe, onSettings }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* 見出し（左寄せ）＋ 設定 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#A8916F]">{greeting}</p>
          <h1 className="text-2xl font-semibold text-[#F7EFE6] mt-0.5">Megroove</h1>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label="設定"
          className="w-11 h-11 -mr-2 flex items-center justify-center text-[#A8916F] active:opacity-60 rounded-full shrink-0"
        >
          <GearIcon size={22} />
        </button>
      </div>

      {/* 盤（デッキごと1枚の面として置く） */}
      <HomeTurntable
        armLifted={!hasRecords}
        caption={hasRecords ? '針を落として、今日の一杯を' : 'まずは一杯、記録してみましょう'}
      />

      {/* 主CTA＝淹れる。カフェは副ボタンとして幅を落とす */}
      <div className="grid grid-cols-5 gap-3">
        <button
          type="button"
          onClick={onBrew}
          className="col-span-3 bg-[#993C1D] text-[#F7EFE6] rounded-2xl py-4 flex flex-col items-center justify-center gap-1 active:opacity-80"
        >
          <span className="flex items-center gap-2">
            <PlayIcon size={18} />
            <span className="text-base font-semibold">
              {hasRecords ? '淹れる' : '最初の一杯を記録する'}
            </span>
          </span>
          {hasRecords && <span className="text-[11px] text-[#F7EFE6]/70">ブルームタイマーで記録</span>}
        </button>
        <button
          type="button"
          onClick={onCafe}
          className="col-span-2 bg-[#4a3828] text-[#F7EFE6] rounded-2xl py-4 flex flex-col items-center justify-center gap-1 active:opacity-80"
        >
          <CafeIcon size={20} />
          <span className="text-sm font-semibold">カフェ</span>
          <span className="text-[11px] text-[#F7EFE6]/70">お店の一杯</span>
        </button>
      </div>
    </div>
  )
}
