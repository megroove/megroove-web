# megroove-api（Cloudflare Worker）

豆ラベルの AI 解析（`POST /analyze`）。写真を Claude（`claude-haiku-5-5`）に渡し、ラベルに書かれた項目だけを JSON で返す。
アプリ本体（GitHub Pages）とは別にデプロイする。写真は保存せず、ログにも残さない。

## 構成

- `src/index.ts` … 入口。`POST /analyze`: CORS（`ALLOWED_ORIGINS` と完全一致）→ 本文の大きさ → 形と画像の中身の検証 → Turnstile →
  回数の枠を取る → 解析（失敗したら端末の枠だけ返す）。`GET /quota?deviceId=` は今日の残り回数（表示用）
- `src/quota.ts` … 1日の回数制限（日本時間0時で切り替え）。端末 `LIMIT_DEVICE`（成功だけ数える）・IP `LIMIT_IP`・全体 `LIMIT_GLOBAL`
  （この2つは Claude を呼んだ回数＝費用の上限）。端末ID・IP は `HASH_SECRET` で HMAC にしてから D1 に置き、前日より前は消す
- `src/validate.ts` … 入力の検証（純粋関数。1枚 1.5MB・3枚まで・JPEG/PNG/WebP を先頭バイトで判定）
- `src/analyzer.ts` … 解析の差し替え口（`LabelAnalyzer`）。将来 Web 検索で補う版はここに足す
- `src/beanLabel.ts` … 返す項目の schema・指示文・返す前の後始末（日付・数値の範囲・長さ）

## はじめての準備（一度だけ）

1. `npx wrangler login`
2. Turnstile のウィジェットを作る（Cloudflare ダッシュボード → Turnstile。ホスト名 `megroove.github.io`）
3. シークレットを登録する（値はターミナルに貼る。ファイルには書かない）
   - `npx wrangler secret put ANTHROPIC_API_KEY`
   - `npx wrangler secret put TURNSTILE_SECRET`
4. 回数の記録（D1）: `npx wrangler d1 migrations apply megroove-usage --remote`（dev は `megroove-usage-dev --remote --env dev`）。
   ハッシュの鍵は乱数を直接流し込む（誰も知る必要がない）: `openssl rand -hex 32 | npx wrangler secret put HASH_SECRET`
5. `npm run deploy` → 表示された URL（`https://megroove-api.<アカウント>.workers.dev`）をアプリのビルド設定に使う

## 開発

- `npm test` / `npm run typecheck`
- ローカル実行は `.dev.vars`（git 管理外）に `ANTHROPIC_API_KEY` と `TURNSTILE_SECRET` を書いて `npx wrangler dev --env dev`。
  Turnstile は Cloudflare のテスト用キー（サイト `1x00000000000000000000AA` / シークレット `1x0000000000000000000000000000000AA`）で常に通る
