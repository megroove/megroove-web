import { describe, expect, it } from 'vitest'
import type { MonthAlbumSource } from './monthAlbumStats'
import { calcMonthAlbums, monthLabelOf } from './monthAlbumStats'

const at = (y: number, m: number, d = 10) => new Date(y, m - 1, d, 9, 0, 0).toISOString()

const src = (over: Partial<MonthAlbumSource> & { at: string }): MonthAlbumSource => ({
  id: over.at + Math.random(),
  ...over,
})

describe('monthLabelOf', () => {
  it('groupByMonth と同じ形のラベルを作る', () => {
    expect(monthLabelOf(at(2026, 9))).toBe('2026年9月')
    expect(monthLabelOf(at(2026, 12))).toBe('2026年12月')
  })
})

describe('calcMonthAlbums', () => {
  it('月ごとに枚数をまとめる', () => {
    const albums = calcMonthAlbums([
      src({ at: at(2026, 9, 1) }),
      src({ at: at(2026, 9, 20) }),
      src({ at: at(2026, 8, 3) }),
    ])
    expect(albums.get('2026年9月')!.count).toBe(2)
    expect(albums.get('2026年8月')!.count).toBe(1)
  })

  it('枚数には未評価も数え、平均は評価済みだけで割る', () => {
    const album = calcMonthAlbums([
      src({ at: at(2026, 9, 1), rating: 5 }),
      src({ at: at(2026, 9, 2), rating: 3 }),
      src({ at: at(2026, 9, 3) }), // 未評価
    ]).get('2026年9月')!
    expect(album.count).toBe(3)
    expect(album.avgRating).toBe(4)
  })

  it('評価が無い月は平均を持たない', () => {
    expect(calcMonthAlbums([src({ at: at(2026, 7, 1) })]).get('2026年7月')!.avgRating).toBeNull()
  })

  it('ジャケットにはその月の最高評価の写真を使う', () => {
    const album = calcMonthAlbums([
      src({ at: at(2026, 9, 1), rating: 3, photoDataUrl: 'photo-low' }),
      src({ at: at(2026, 9, 2), rating: 5, photoDataUrl: 'photo-best' }),
      src({ at: at(2026, 9, 3), rating: 5 }), // 写真なしの5点は選ばれない
    ]).get('2026年9月')!
    expect(album.photoUrl).toBe('photo-best')
  })

  it('同点なら新しい方の写真を使う', () => {
    const album = calcMonthAlbums([
      src({ at: at(2026, 9, 1), rating: 4, photoDataUrl: 'old' }),
      src({ at: at(2026, 9, 20), rating: 4, photoDataUrl: 'new' }),
    ]).get('2026年9月')!
    expect(album.photoUrl).toBe('new')
  })

  it('写真が無ければ、その月に最も多かった産地を色の種にする', () => {
    const album = calcMonthAlbums([
      src({ at: at(2026, 9, 1), seed: 'ケニア', roastLevel: 'dark' }),
      src({ at: at(2026, 9, 2), seed: 'エチオピア', roastLevel: 'light' }),
      src({ at: at(2026, 9, 3), seed: 'エチオピア', roastLevel: 'light' }),
    ]).get('2026年9月')!
    expect(album.photoUrl).toBeUndefined()
    expect(album.seed).toBe('エチオピア')
    expect(album.roastLevel).toBe('light')
  })

  it('産地が無くても壊れない', () => {
    const album = calcMonthAlbums([src({ at: at(2026, 9, 1) })]).get('2026年9月')!
    expect(album.seed).toBeUndefined()
    expect(album.count).toBe(1)
  })

  it('記録が無ければ空', () => {
    expect(calcMonthAlbums([]).size).toBe(0)
  })

  it('年をまたいだ同じ月は別のアルバムになる', () => {
    const albums = calcMonthAlbums([
      src({ at: at(2026, 1, 5) }),
      src({ at: at(2025, 1, 5) }),
    ])
    expect(albums.get('2026年1月')!.count).toBe(1)
    expect(albums.get('2025年1月')!.count).toBe(1)
  })
})
