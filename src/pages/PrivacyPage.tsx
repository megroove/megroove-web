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
          本アプリの運営者はサーバーを保有しておらず、記録データが運営者や第三者に送信されることはありません。
        </p>
      </Section>

      <Section title="2. 収集しない情報">
        <p>
          本アプリは、アカウント登録・ログイン機能を持たず、氏名・メールアドレス等の個人情報を収集しません。
          アクセス解析ツールや広告配信のためのCookie・トラッキングも使用していません。
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

      <Section title="6. 本ポリシーの変更">
        <p>
          内容を変更する場合は、本ページで告知します。重要な変更（データ提供機能の開始等）の際は、
          アプリ内でも分かりやすくお知らせします。
        </p>
      </Section>

      <Section title="7. お問い合わせ">
        <p>
          本ポリシーに関するお問い合わせ:{' '}
          <a href="mailto:megroove.app@gmail.com" className="text-[#F7EFE6] underline">
            megroove.app@gmail.com
          </a>
        </p>
      </Section>

      <p className="text-[10px] text-[#4a3a2a] text-center pb-2">制定日: 2026年7月9日</p>
    </div>
  )
}
