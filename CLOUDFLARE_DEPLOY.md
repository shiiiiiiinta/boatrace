# Cloudflare Workers デプロイガイド

このガイドでは、BOATRACE オッズAPIプロキシをCloudflare Workersにデプロイする手順を説明します。

---

## 📋 前提条件

- Cloudflareアカウント（無料プランでOK）
- Node.js (v16以降)
- npm または yarn

---

## 🚀 セットアップ手順

### ステップ1: Cloudflareアカウント作成

1. https://dash.cloudflare.com/sign-up にアクセス
2. メールアドレスとパスワードを入力して登録
3. メール認証を完了

---

### ステップ2: Wrangler CLI のインストール

Wrangler は Cloudflare Workers のデプロイツールです。

```bash
# npm を使用する場合
npm install -g wrangler

# yarn を使用する場合
yarn global add wrangler

# インストール確認
wrangler --version
```

---

### ステップ3: Cloudflare にログイン

```bash
wrangler login
```

ブラウザが開き、Cloudflareアカウントへのアクセスを許可するよう求められます。

---

### ステップ4: wrangler.toml の作成

プロジェクトルートに `wrangler.toml` ファイルを作成します。

```toml
name = "boatrace-odds-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"

# アカウント情報（オプション）
# account_id = "your-account-id"

# ワーカーの設定
workers_dev = true

# ルート設定（カスタムドメインを使用する場合）
# routes = [
#   { pattern = "api.example.com/*", zone_name = "example.com" }
# ]
```

**注意**: `account_id` は `wrangler whoami` コマンドで確認できます。

---

### ステップ5: ローカルでテスト

デプロイ前にローカルで動作確認します。

```bash
# ローカル開発サーバーを起動
wrangler dev

# または、ポート指定
wrangler dev --port 8787
```

ブラウザで http://localhost:8787 にアクセスして動作確認。

**テストエンドポイント:**
```
http://localhost:8787/
http://localhost:8787/api/health
http://localhost:8787/api/odds/01/1?hd=20260123
```

---

### ステップ6: デプロイ

```bash
# 本番環境にデプロイ
wrangler deploy

# または（旧コマンド）
wrangler publish
```

デプロイが成功すると、Worker の URL が表示されます：
```
✨ Published boatrace-odds-proxy (1.23 sec)
   https://boatrace-odds-proxy.your-subdomain.workers.dev
```

---

### ステップ7: 動作確認

デプロイされた URL にアクセスして動作確認します。

```bash
# ヘルスチェック
curl https://boatrace-odds-proxy.your-subdomain.workers.dev/api/health

# オッズ取得テスト（桐生競艇場、1R）
curl https://boatrace-odds-proxy.your-subdomain.workers.dev/api/odds/01/1
```

---

### ステップ8: フロントエンドの設定更新

`js/config.js` を編集して、Worker の URL を設定します。

```javascript
const CONFIG = {
  // デプロイしたWorkerのURL
  API_BASE_URL: 'https://boatrace-odds-proxy.your-subdomain.workers.dev',
  
  // デモモードをオフに
  USE_DEMO_MODE: false
};
```

これでフロントエンドから実際のAPIを呼び出せるようになります！

---

## 🔧 高度な設定

### カスタムドメインの設定

Workers に独自ドメインを割り当てることができます。

1. Cloudflare ダッシュボードにログイン
2. **Workers & Pages** → 対象のWorkerを選択
3. **Settings** → **Triggers** → **Custom Domains**
4. **Add Custom Domain** をクリック
5. ドメインを入力（例: `api.example.com`）

`wrangler.toml` にも追加:
```toml
routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
```

---

### 環境変数の設定

APIキーなどの機密情報を環境変数として設定できます。

```bash
# シークレットを設定
wrangler secret put API_KEY
# プロンプトで値を入力

# 環境変数を設定
wrangler secret put BOATRACE_API_KEY
```

Worker コードで使用:
```javascript
const apiKey = env.API_KEY;
```

---

### ログの確認

```bash
# リアルタイムログを表示
wrangler tail

# 特定のWorkerのログ
wrangler tail boatrace-odds-proxy
```

Cloudflare ダッシュボードでも確認可能：
- **Workers & Pages** → 対象のWorker → **Logs**

---

## 📊 使用量の確認

Cloudflare Workers の無料プランの制限：
- **リクエスト数**: 100,000/日
- **CPU時間**: 10ms/リクエスト
- **スクリプトサイズ**: 1MB

使用量の確認：
1. Cloudflare ダッシュボード
2. **Workers & Pages**
3. 対象のWorkerを選択
4. **Metrics** タブ

---

## 🔄 更新・削除

### Workerの更新

コードを修正したら再デプロイ:
```bash
wrangler deploy
```

### Workerの削除

```bash
wrangler delete boatrace-odds-proxy
```

---

## 🐛 トラブルシューティング

### エラー: "No account_id found"

```bash
# アカウントIDを確認
wrangler whoami

# wrangler.tomlに追加
account_id = "your-account-id-here"
```

### エラー: "Module worker does not export a default handler"

`worker.js` にイベントリスナーがあることを確認:
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
```

### CORS エラーが発生する

Worker のレスポンスに CORS ヘッダーが含まれているか確認:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### リクエストがタイムアウトする

Worker の CPU 時間制限（10ms）を超えている可能性があります。
- 処理を最適化
- 有料プランにアップグレード（30秒まで）

---

## 💰 料金プラン

### Free プラン
- **料金**: 無料
- **リクエスト**: 100,000/日
- **CPU時間**: 10ms/リクエスト
- **適用**: 個人プロジェクト、小規模サイト

### Paid プラン
- **料金**: $5/月〜
- **リクエスト**: 10,000,000/月（追加は$0.50/100万）
- **CPU時間**: 30秒/リクエスト
- **適用**: 本番環境、高トラフィック

---

## 📚 参考リソース

- **Cloudflare Workers 公式ドキュメント**: https://developers.cloudflare.com/workers/
- **Wrangler CLI ドキュメント**: https://developers.cloudflare.com/workers/wrangler/
- **Workers Examples**: https://developers.cloudflare.com/workers/examples/

---

## 🎯 まとめ

Cloudflare Workers を使えば、CORS問題を解決しながら高速・安価にAPIプロキシを運用できます。

**主な利点:**
- ✅ 無料プランで十分な性能
- ✅ グローバルCDNで高速配信
- ✅ サーバー管理不要
- ✅ 簡単デプロイ（1コマンド）

次のステップ: フロントエンドをデプロイして、完全に動作するアプリを公開しましょう！
