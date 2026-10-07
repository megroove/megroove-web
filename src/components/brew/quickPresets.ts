import type { Bean, Brew, Recipe } from '../../db'
import { calcFrequentRecipes, currentBagId } from '../../db'
import type { QuickPreset } from './QuickBrewSheet'

/**
 * クイック記録のプリセット（「前回と同じ」＋よく使うレシピ上位2の最大3枚）。
 *
 * レシピの既定値だけでは豆・器具が分からないため、「そのレシピを直近で使った記録」を実体にして
 * 条件をまるごと引き継ぐ。
 *
 * 豆は `currentBagId()` で**「今の袋」に付け替える**（§5 リピート購入）。コピー元の記録が
 * 飲み切った袋を指したままだと、残量がその袋に積まれ、「焙煎から◯日」も前の袋の日付で出てしまう。
 * プリセットの見た目（豆名・焙煎度）は袋が違っても同じなので、付け替えないと気づけない。
 */
export function buildQuickPresets(
  brews: Brew[],
  recipes: Recipe[],
  beans: Bean[],
): QuickPreset[] {
  const last = brews.at(-1)
  if (!last) return []

  const beanMap = new Map(beans.map(b => [b.id, b]))
  const presetFor = (id: string, name: string, brew: Brew): QuickPreset => {
    const beanId = currentBagId(brew.beanId, beans)
    return { id, name, brew, beanId, bean: beanId ? beanMap.get(beanId) : undefined }
  }

  const presets: QuickPreset[] = [presetFor('last', '前回と同じ', last)]
  for (const { recipeId } of calcFrequentRecipes(brews)) {
    if (recipeId === last.recipeId) continue // 「前回と同じ」と同じ条件は並べない
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) continue
    const base = [...brews].reverse().find(b => b.recipeId === recipeId)
    if (!base) continue
    presets.push(presetFor(recipe.id, recipe.name, base))
  }
  return presets.slice(0, 3)
}
