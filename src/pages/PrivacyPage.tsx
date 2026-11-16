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

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm shrink-0">
          ← 戻る
        </button>
        <h2 className="text-xl font-semibold text-[#F7EFE6]">プライバシーポリシー</h2>
      </div>

      <p className="text-xs text-[#6b5a4a] leading-relaxed">
        Megroove（以下「本アプリ」）における情報の取り扱いについて説明します。
      </p>

      <Section title="1. 基本方針 — データはあなたの端末の中だけ">
        <p>
          本アプリは、記録したすべてのデータ（抽出記録・カフェ記録・豆・器具・レシピ・写真・設定）を
          <span className="text-[#F7EFE6] font-medium">お使いのブラウザ内（IndexedDB / localStorage）にのみ保存</span>します。
        </p>
        <p>
          記録データが運営者や第三者に送信されることはありません。分析画面の「好みのプロファイル」も、
          お使いの端末の中だけで計算しています。
        </p>
        <p>
          例外は、あなたが「豆ラベルの読み取り（AI）」を使ったときだけです。このときに限り、選んだ写真を外部に送ります（第3項）。
        </p>
      </Section>

      <Section title="2. 収集しない情報">
        <p>
          本アプリは、アカウント登録・ログイン機能を持たず、氏名・メールアドレス等の個人情報を収集しません。
          広告配信のためのトラッキングやCookieは使用しません。
        </p>
        <p>
          ただし、分析画面の好みのプロファイルの下に、あなたの好みに合いそうな豆・道具の
          <span className="text-[#F7EFE6] font-medium">アフィリエイトリンク（「PR」と表示します）</span>を出すことがあります。
          表示は文字のリンクだけで、画像や計測用のタグを読み込まないため、表示しただけでは外部に何も送られません。
          リンクを押すと移動先のサイトに移り、購入などがあった場合に本アプリの運営者が紹介料を受け取ることがあります。
        </p>
        <p>
          サービス改善のための利用状況の把握として、<span className="text-[#F7EFE6] font-medium">Cookieを使わない匿名のアクセス解析</span>
          （Cloudflare Web Analytics）のみを使用します（詳細は第3項）。個人を識別する情報や、
          あなたの記録内容は解析に一切含まれません。
        </p>
      </Section>

      <Section title="3. 外部への送信について（外部送信規律に基づく公表）">
        <p>
          本アプリの利用に伴い、お使いの端末から外部へ送信される情報は次のとおりです。
        </p>
        <p>
          ・アプリ本体の配信: 本アプリは GitHub Pages（GitHub, Inc.）から配信されており、
          ページの取得時に IPアドレス等の接続情報が同社のサーバーに送信されます（Webサイトの表示に必要な通信）。
          取り扱いは
          <span className="text-[#F7EFE6]"> GitHub のプライバシーステートメント</span>
          に従います。
        </p>
        <p>
          ・匿名のアクセス解析: Cloudflare Web Analytics（Cloudflare, Inc.）を利用し、
          ページの表示回数などの匿名の利用統計を収集します。Cookieを使わず、あなたを個人として識別しません。
          <span className="text-[#F7EFE6]">記録内容・写真・個人情報は一切送信されません</span>。
          取り扱いは同社のプライバシーポリシーに従います。
        </p>
        <p>
          ・豆ラベルの読み取り（AI）: 豆の追加画面で読み取りを使ったときだけ、選んだ写真を本アプリの中継サーバー
          （Cloudflare Workers）を通じて Anthropic, PBC の AI（Claude）に送り、書かれている項目を読み取ります。
          初回に同意をいただいてから送ります。
        </p>
        <p className="pl-3">
          - 送る情報: 選んだ写真、端末ごとのランダムな番号（回数制限のため）、通信に伴う IPアドレス
          <br />
          - 運営者の中継サーバーは、写真と読み取り結果を保存・記録しません
          <br />
          - 回数制限のため、端末の番号と IPアドレスは元に戻せない形（鍵付きハッシュ）に変えてから、利用回数とともに翌日まで保持し、その後削除します
          <br />
          - Anthropic 社は、届いた写真と結果を同社の規約に基づき原則30日以内に削除し、AI の学習には使いません
        </p>
        <p>
          ・不正利用の防止（Cloudflare Turnstile）: 読み取りの画面を開いたときだけ、ボットでないことを確かめるために、
          ブラウザや端末の情報が Cloudflare, Inc. に送られます。読み取りを使わなければ読み込みません。
        </p>
        <p>
          ・外部サイトへのリンク: 「Megroove を応援する」（Ko-fi）やアフィリエイトリンクは、押したときだけ移動先のサイトを開きます。
          移動先での情報の取り扱いは、各サイトのプライバシーポリシーに従います。
        </p>
        <p>
          ・上記以外の外部送信はありません。オフライン用キャッシュ（Service Worker）も端末内で完結します。
        </p>
      </Section>

      <Section title="4. 将来のデータ提供機能について">
        <p>
          本アプリでは、ご自身の記録データをパートナー企業に提供して特典を受け取れる仕組みを準備しています。
          この機能が導入された場合も、次の原則を守ります。
        </p>
        <p>・提供は常にあなたの明示的な操作・同意によってのみ行われます（自動送信はありません）</p>
        <p>・送信前に、送信先・利用目的・送信されるデータそのものを画面で確認できます</p>
        <p>・写真・自由記述メモ・正確な時刻・豆の名前・カフェ名は送信されません</p>
        <p>・提供先ごとに異なる仮名IDを使用し、氏名等の個人情報は含まれません</p>
        <p>・同意はいつでも撤回できます</p>
      </Section>

      <Section title="5. データの管理と削除">
        <p>
          記録データは「設定 → データ管理」からいつでもJSONファイルとして書き出し・取り込みできます。
        </p>
        <p>
          ブラウザのサイトデータ削除を行うと、本アプリのすべてのデータが端末から完全に消去されます
          （運営者側にコピーは存在しません）。
        </p>
      </Section>

      <Section title="6. 健康に関する情報について">
        <p>
          本アプリが表示するカフェインの摂取量・体内残留量・就寝時の残留予測などは、
          公表されている一般的なモデルに基づく<span className="text-[#F7EFE6] font-medium">推定・目安</span>であり、
          医学的な助言・診断・治療に代わるものではありません。
        </p>
        <p>
          カフェインへの感受性や代謝の速さには大きな個人差があります。
          表示はあなたの記録から計算した参考情報としてご利用ください。
          健康に不安がある場合や、妊娠中・授乳中の方、持病をお持ちの方は、医師などの専門家にご相談ください。
        </p>
        <p>
          なお、本アプリは睡眠データ等の外部ヘルスデータとは連携せず、健康関連の数値もすべて端末内でのみ計算・保存されます。
        </p>
      </Section>

      <Section title="7. 本ポリシーの変更">
        <p>
          内容を変更する場合は、本ページで告知します。本アプリの利用条件は、設定の「利用規約」をご覧ください。重要な変更（データ提供機能の開始等）の際は、
          アプリ内でも分かりやすくお知らせします。
        </p>
      </Section>

      <Section title="8. お問い合わせ">
        <p>
          本ポリシーに関するお問い合わせ:{' '}
          <a href="mailto:megroove.app@gmail.com" className="text-[#F7EFE6] underline">
            megroove.app@gmail.com
          </a>
        </p>
      </Section>

      <p className="text-[10px] text-[#4a3a2a] text-center pb-2">制定日: 2026年7月9日 ・ 改定日: 2026年11月16日（豆ラベルの読み取り・アフィリエイトリンク・外部リンクを明記）</p>
    </div>
  )
}
