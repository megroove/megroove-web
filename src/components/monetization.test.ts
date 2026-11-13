import { describe, expect, it } from 'vitest'
import { MONETIZATION, parseMonetizationConfig, pickAffiliateItems, preferenceTags, type AffiliateItem } from './monetization'

const item = (id: string, tags: string[]): AffiliateItem => ({ id, title: id, url: `https://example.com/${id}`, tags })

describe('parseMonetizationConfig', () => {
  it('出荷時の設定: 応援は https の URL だけ、アフィリエイトは出さない', () => {
    expect(MONETIZATION.support.url).toMatch(/^(https:\/\/.+)?$/)
    expect(MONETIZATION.affiliate.enabled).toBe(false)
  })
  it('https 以外のリンクと欠けた項目は捨てる', () => {
    const c = parseMonetizationConfig({
      support: { url: 'http://ko-fi.com/x' },
      affiliate: { enabled: true, items: [
        { id: 'a', title: 'A', url: 'https://example.com/a', tags: ['roast:light', 3] },
        { id: 'b', title: 'B', url: 'javascript:alert(1)', tags: [] },
        { title: 'C', url: 'https://example.com/c' },
      ] },
    })
    expect(c.support.url).toBe('')
    expect(c.affiliate.items).toEqual([{ id: 'a', title: 'A', description: undefined, url: 'https://example.com/a', tags: ['roast:light'] }])
  })
  it('壊れた設定でも落ちない', () => {
    expect(parseMonetizationConfig(null)).toEqual({ support: { url: '', service: '' }, affiliate: { enabled: false, items: [] } })
  })
})

describe('preferenceTags', () => {
  it('焙煎度・国・精製と、最も強まっている味を1つ', () => {
    expect(preferenceTags({
      roastLevel: 'light', country: 'エチオピア', process: 'ナチュラル',
      direction: { acidity: 0.6, sweetness: 0.3, bitterness: -0.4 },
    })).toEqual(['roast:light', 'country:エチオピア', 'process:ナチュラル', 'taste:acidity'])
  })
  it('小さな差は味の傾向にしない', () => {
    expect(preferenceTags({ direction: { acidity: 0.1 } })).toEqual([])
  })
})

describe('pickAffiliateItems', () => {
  const items = [item('a', ['roast:dark']), item('b', ['roast:light']), item('c', ['roast:light', 'country:エチオピア']), item('d', ['taste:acidity'])]
  it('重なりの多い順・同点は設定の順に最大2件', () => {
    const picked = pickAffiliateItems({ enabled: true, items }, ['roast:light', 'country:エチオピア', 'taste:acidity'])
    expect(picked.map(i => i.id)).toEqual(['c', 'b'])
  })
  it('無効・好みが無い・重ならないときは出さない', () => {
    expect(pickAffiliateItems({ enabled: false, items }, ['roast:light'])).toEqual([])
    expect(pickAffiliateItems({ enabled: true, items }, [])).toEqual([])
    expect(pickAffiliateItems({ enabled: true, items }, ['process:ハニー'])).toEqual([])
  })
})
