import { describe, expect, it } from 'vitest'
import {
  MIN_DAYS_WITH_RECORD,
  TIME_BUCKETS,
  calcCaffeineTrendSummary,
  calcDailyCaffeine,
  calcTimeOfDayShares,
} from './trends'

// 基準日: 2026-09-25（金）12:00
const NOW = new Date(2026, 8, 25, 12, 0, 0)

// ローカル時刻で摂取点を作る（集計はローカル日付・ローカル時刻で行う）
const at = (day: number, hour: number, mg = 100) => ({
  caffeineAmount: mg,
  at: new Date(2026, 8, day, hour, 0, 0).toISOString(),
})

describe('calcDailyCaffeine', () => {
  it('直近7日を古い順に並べ、記録の無い日も0で埋める', () => {
    const daily = calcDailyCaffeine([at(25, 8)], 7, NOW)
    expect(daily).toHaveLength(7)
    expect(daily[0].date).toBe('2026-09-19')
    expect(daily[6].date).toBe('2026-09-25')
    expect(daily[6].isToday).toBe(true)
    expect(daily.slice(0, 6).every(d => d.mg === 0)).toBe(true)
    expect(daily[6].mg).toBe(100)
  })

  it('同じ日の摂取を合算する', () => {
    const daily = calcDailyCaffeine([at(24, 8), at(24, 15, 80), at(24, 20, 20)], 7, NOW)
    expect(daily.find(d => d.date === '2026-09-24')!.mg).toBe(200)
  })

  it('期間より古い摂取は数えない', () => {
    const daily = calcDailyCaffeine([at(1, 8)], 7, NOW)
    expect(daily.every(d => d.mg === 0)).toBe(true)
  })

  it('曜日ラベルが付く', () => {
    // 2026-09-25 は金曜日
    expect(calcDailyCaffeine([], 7, NOW)[6].label).toBe('金')
  })
})

describe('calcTimeOfDayShares', () => {
  it('朝・昼・夕方・夜に振り分ける', () => {
    const shares = calcTimeOfDayShares(
      [at(25, 8), at(25, 12), at(25, 16), at(25, 22)],
      7, NOW,
    )
    const byId = Object.fromEntries(shares.map(s => [s.id, s]))
    expect(byId.morning.mg).toBe(100)
    expect(byId.midday.mg).toBe(100)
    expect(byId.evening.mg).toBe(100)
    expect(byId.night.mg).toBe(100)
    expect(shares.every(s => Math.abs(s.ratio - 0.25) < 1e-9)).toBe(true)
  })

  it('日をまたぐ「夜」に深夜・早朝を含める', () => {
    const shares = calcTimeOfDayShares([at(25, 1), at(24, 23)], 7, NOW)
    expect(shares.find(s => s.id === 'night')!.ratio).toBe(1)
  })

  it('境界は「その時刻から」で判定する（15時は夕方）', () => {
    const shares = calcTimeOfDayShares([at(25, 15)], 7, NOW)
    expect(shares.find(s => s.id === 'evening')!.ratio).toBe(1)
    expect(shares.find(s => s.id === 'midday')!.ratio).toBe(0)
  })

  it('記録が無ければ割合は0（0除算にしない）', () => {
    const shares = calcTimeOfDayShares([], 7, NOW)
    expect(shares.every(s => s.ratio === 0 && s.mg === 0)).toBe(true)
  })

  it('区分は隙間なく24時間を覆う', () => {
    for (let h = 0; h < 24; h++) {
      const shares = calcTimeOfDayShares([at(25, h)], 7, NOW)
      expect(shares.reduce((sum, s) => sum + s.ratio, 0)).toBeCloseTo(1, 9)
    }
    expect(TIME_BUCKETS).toHaveLength(4)
  })
})

describe('calcCaffeineTrendSummary', () => {
  it('記録のある日が下限に満たなければ傾向を出さない', () => {
    const s = calcCaffeineTrendSummary([at(25, 8), at(24, 8)], 7, NOW)
    expect(s.daysWithRecord).toBe(2)
    expect(s.hasEnoughData).toBe(false)
  })

  it('下限に達すれば出す', () => {
    const s = calcCaffeineTrendSummary([at(25, 8), at(24, 8), at(23, 8)], 7, NOW)
    expect(s.daysWithRecord).toBe(MIN_DAYS_WITH_RECORD)
    expect(s.hasEnoughData).toBe(true)
  })

  it('平均は「記録のあった日」で割る（飲まなかった日で薄めない）', () => {
    const s = calcCaffeineTrendSummary([at(25, 8, 300), at(24, 8, 100), at(23, 8, 200)], 7, NOW)
    expect(s.avgMgPerRecordedDay).toBe(200)
  })

  it('15時以降の割合は夕方と夜の合計', () => {
    const s = calcCaffeineTrendSummary(
      [at(25, 8), at(24, 16), at(23, 22)],
      7, NOW,
    )
    expect(s.afterMiddayRatio).toBeCloseTo(2 / 3, 9)
  })

  it('記録が無くても壊れない', () => {
    const s = calcCaffeineTrendSummary([], 7, NOW)
    expect(s).toEqual({
      daysWithRecord: 0,
      avgMgPerRecordedDay: 0,
      afterMiddayRatio: 0,
      hasEnoughData: false,
    })
  })
})
