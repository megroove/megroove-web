// カフェイン摂取の傾向（日別・時間帯別）の集計。
//
// CLAUDE.md §12 の健康情報方針に従い、ここでは**数値を出すだけ**にする。
// 「多い/少ない」「控えるべき」といった評価・助言・因果の判断は一切しない
// （表示側でも同じ規律を守ること）。
//
// 対象はコーヒー記録・カフェ記録・コーヒー以外のカフェイン飲料の3つを合算する
// （カフェイン管理にのみ合流させ、ライブラリ・分析・ランキングには混ぜない既存方針どおり）。

export interface IntakePoint {
  caffeineAmount: number
  /** 摂取時刻（ISO） */
  at: string
}

export interface DailyCaffeine {
  /** 'YYYY-MM-DD'（ローカル日付） */
  date: string
  /** 曜日ラベル（日〜土） */
  label: string
  mg: number
  isToday: boolean
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function localDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** 直近 days 日ぶんの日別合計（古い順）。記録が無い日も 0 として並べる */
export function calcDailyCaffeine(
  points: IntakePoint[],
  days = 7,
  now: Date = new Date(),
): DailyCaffeine[] {
  const today = localDate(now)
  const result: DailyCaffeine[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const date = localDate(d)
    result.push({
      date,
      label: WEEKDAYS[d.getDay()],
      mg: 0,
      isToday: date === today,
    })
  }

  const byDate = new Map(result.map(r => [r.date, r]))
  for (const p of points) {
    const row = byDate.get(localDate(new Date(p.at)))
    if (row) row.mg += p.caffeineAmount
  }

  for (const r of result) r.mg = Math.round(r.mg)
  return result
}

// 時間帯の区切り。「15時以降が何%か」をそのまま読み取れるよう 15 時を境にしている
export const TIME_BUCKETS = [
  { id: 'morning', label: '朝',   from: 5,  to: 11, note: '5〜11時' },
  { id: 'midday',  label: '昼',   from: 11, to: 15, note: '11〜15時' },
  { id: 'evening', label: '夕方', from: 15, to: 18, note: '15〜18時' },
  { id: 'night',   label: '夜',   from: 18, to: 5,  note: '18〜5時' },
] as const

export type TimeBucketId = typeof TIME_BUCKETS[number]['id']

export interface BucketShare {
  id: TimeBucketId
  label: string
  note: string
  mg: number
  /** 0〜1。合計が 0 のときは 0 */
  ratio: number
}

function bucketOf(hour: number): TimeBucketId {
  for (const b of TIME_BUCKETS) {
    // 夜のように日をまたぐ区間は「from 以上 または to 未満」で判定する
    const hit = b.from < b.to
      ? hour >= b.from && hour < b.to
      : hour >= b.from || hour < b.to
    if (hit) return b.id
  }
  return 'night'
}

/** 直近 days 日ぶんの時間帯別の量と割合 */
export function calcTimeOfDayShares(
  points: IntakePoint[],
  days = 7,
  now: Date = new Date(),
): BucketShare[] {
  // 集計の窓は日別グラフと厳密に同じにする（起点の0時 〜 今日の終わり）。
  // ここだけ「現在時刻まで」にすると、同じ今日のぶんが棒グラフには乗って割合には乗らず、
  // 画面上の数字が食い違う
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime()
  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const totals = new Map<TimeBucketId, number>(TIME_BUCKETS.map(b => [b.id, 0]))

  let total = 0
  for (const p of points) {
    const d = new Date(p.at)
    if (d.getTime() < from || d.getTime() >= to) continue
    const id = bucketOf(d.getHours())
    totals.set(id, (totals.get(id) ?? 0) + p.caffeineAmount)
    total += p.caffeineAmount
  }

  return TIME_BUCKETS.map(b => {
    const mg = Math.round(totals.get(b.id) ?? 0)
    return {
      id: b.id,
      label: b.label,
      note: b.note,
      mg,
      ratio: total > 0 ? (totals.get(b.id) ?? 0) / total : 0,
    }
  })
}

export interface CaffeineTrendSummary {
  /** 期間内で記録のあった日数 */
  daysWithRecord: number
  /** 記録のあった日の1日あたり平均 (mg)。記録が無ければ 0 */
  avgMgPerRecordedDay: number
  /** 15時以降の割合（0〜1） */
  afterMiddayRatio: number
  /** 傾向として見せてよいだけの記録があるか */
  hasEnoughData: boolean
}

/** 傾向表示の下限。母数が小さい割合は誤解を招くため、記録のある日が3日に満たなければ出さない */
export const MIN_DAYS_WITH_RECORD = 3

export function calcCaffeineTrendSummary(
  points: IntakePoint[],
  days = 7,
  now: Date = new Date(),
): CaffeineTrendSummary {
  const daily = calcDailyCaffeine(points, days, now)
  const recorded = daily.filter(d => d.mg > 0)
  const shares = calcTimeOfDayShares(points, days, now)
  const afterMidday = shares
    .filter(s => s.id === 'evening' || s.id === 'night')
    .reduce((sum, s) => sum + s.ratio, 0)

  return {
    daysWithRecord: recorded.length,
    avgMgPerRecordedDay: recorded.length > 0
      ? Math.round(recorded.reduce((sum, d) => sum + d.mg, 0) / recorded.length)
      : 0,
    afterMiddayRatio: afterMidday,
    hasEnoughData: recorded.length >= MIN_DAYS_WITH_RECORD,
  }
}
