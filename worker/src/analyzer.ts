import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { BeanLabelSchema, SYSTEM_PROMPT, type BeanLabel } from './beanLabel'
import type { LabelImage } from './validate'

// 解析の差し替え口。今は写真だけを Claude に読ませる。
// 将来「Web 検索で情報を補う」版を足すときは、この interface を実装した別クラスを作って index.ts で選ぶ。
export interface LabelAnalyzer {
  analyze(images: LabelImage[]): Promise<AnalyzeOutcome>
}

export type AnalyzeOutcome =
  | { kind: 'ok'; label: BeanLabel }
  | { kind: 'unreadable' } // 拒否・形が崩れた・途中で切れた（回数は消費しない）

const MODEL = 'claude-haiku-5-5'

export class ClaudeLabelAnalyzer implements LabelAnalyzer {
  private client: Anthropic

  constructor(apiKey: string) {
    // 失敗の再試行は1回まで（利用者を長く待たせない）
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 })
  }

  async analyze(images: LabelImage[]): Promise<AnalyzeOutcome> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      // ラベルの書き起こしは深い推論が要らないので low（費用と待ち時間を抑える）
      output_config: { effort: 'low', format: zodOutputFormat(BeanLabelSchema) },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          ...images.map(img => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
          })),
          { type: 'text' as const, text: 'この豆の袋のラベルを書き起こしてください。' },
        ],
      }],
    })

    // 拒否・打ち切りでは中身が schema どおりとは限らないので、使わない
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return { kind: 'unreadable' }
    if (!response.parsed_output) return { kind: 'unreadable' }
    return { kind: 'ok', label: response.parsed_output }
  }
}
