import { useNavigate } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#2E2018] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[#F7EFE6] mb-2">{title}</h3>
      <div className="text-xs text-[#CE9C68] leading-relaxed flex flex-col gap-2">
        {children}
      </div>
    </section>
  )
}

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm shrink-0">
          ← 戻る
        </button>
        <h2 className="text-xl font-semibold text-[#F7EFE6]">利用規約</h2>
      </div>

      <p className="text-xs text-[#A8916F] leading-relaxed">
        Megroove（以下「本アプリ」）を使うときの約束です。本アプリを使った時点で、この規約に同意いただいたものとします。
        情報の取り扱いは、別のページの「プライバシーポリシー」で説明しています。
      </p>

      <Section title="1. 本アプリについて">
        <p>
          本アプリは、個人が開発・運営する無料のコーヒー記録アプリです。記録したデータはお使いの端末の中に保存され、
          その管理（バックアップを含む）は利用者ご自身で行っていただきます。
        </p>
      </Section>

      <Section title="2. 豆ラベルの読み取り（AI）について">
        <p>
          読み取りの結果は AI による推定で、<span className="text-[#F7EFE6] font-medium">誤りや読み落としがあります</span>。
          結果は下書きとして入るだけなので、内容を確かめてから保存してください。
        </p>
        <p>
          読み取りには1日の回数の上限があります。上限・提供の内容は、予告なく変更・一時停止・終了することがあります。
        </p>
        <p>
          ご自身が撮影した写真など、送る権利のある写真だけを使ってください。人の顔や個人情報が写った写真は送らないでください。
        </p>
      </Section>

      <Section title="3. 禁止事項">
        <p>・本アプリの中継サーバーを、本アプリ以外から呼び出すこと、自動化した大量の送信など、本来の目的を外れた使い方</p>
        <p>・本アプリや、ほかの利用者の利用を妨げる行為</p>
        <p>・法令または公序良俗に反する行為</p>
      </Section>

      <Section title="4. 応援について">
        <p>
          「Megroove を応援する」は外部サービス（Ko-fi）を通じた任意の応援で、商品やサービスの購入ではありません。
          応援の有無で使える機能は変わらず、見返りもありません。お支払いと返金の扱いは、そのサービスの規約に従います。
        </p>
      </Section>

      <Section title="5. 外部サイトとアフィリエイトリンク">
        <p>
          本アプリには外部サイトへのリンクがあり、「PR」と表示したものはアフィリエイトリンクです。
          リンク先の商品・サービスの内容や取引については、リンク先の事業者の責任となります。
        </p>
      </Section>

      <Section title="6. 免責">
        <p>
          本アプリは現状のまま提供します。運営者は、本アプリの正確性・完全性・特定の目的への適合性を保証しません。
        </p>
        <p>
          ブラウザのデータ消去や端末の故障などによる記録の消失、本アプリの表示（カフェインの推定を含む）や
          AI の読み取り結果を利用したことにより生じた損害について、運営者に故意または重大な過失がある場合を除き、責任を負いません。
        </p>
      </Section>

      <Section title="7. 変更・終了">
        <p>
          運営者は、本アプリの内容やこの規約を変更し、または提供を終了することがあります。
          規約を変更する場合は本ページで告知し、変更後に本アプリを使った時点で変更後の規約に同意いただいたものとします。
        </p>
      </Section>

      <Section title="8. 準拠法・お問い合わせ">
        <p>この規約は日本法に従って解釈されます。</p>
        <p>
          お問い合わせ:{' '}
          <a href="mailto:megroove.app@gmail.com" className="text-[#F7EFE6] underline">
            megroove.app@gmail.com
          </a>
        </p>
      </Section>

      <p className="text-[10px] text-[#4a3a2a] text-center pb-2">制定日: 2026年11月16日</p>
    </div>
  )
}
