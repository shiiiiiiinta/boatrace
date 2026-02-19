# Cloudflare Workers プロキシ - クイックスタートガイド

競艇オッズAPIプロキシをCloudflare Workersでデプロイする最短手順です。

---

## 📦 必要なもの

- Node.js (v16以降)
- Cloudflareアカウント（無料）

---

## ⚡ クイックスタート（5分）

### 1. Wrangler をインストール

```bash
npm install -g wrangler
```

### 2. Cloudflare にログイン

```bash
wrangler login
```

ブラウザが開くので、アカウントにログインして承認。

### 3. デプロイ

プロジェクトフォルダで実行:

```bash
wrangler deploy
```

### 4. Worker URL を取得

デプロイ成功後、URLが表示されます:
```
https://boatrace-odds-proxy.your-subdomain.workers.dev
```

### 5. フロントエンド設定を更新

`js/config.js` を編集:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://boatrace-odds-proxy.your-subdomain.workers.dev',
  USE_DEMO_MODE: false  // 本番APIを使用
};
```

### 6. 動作確認

ブラウザで `index.html` を開いて、実際のAPIからデータが取得されることを確認！

---

## 🧪 ローカルテスト

デプロイ前にローカルで確認:

```bash
wrangler dev
```

http://localhost:8787 でアクセス可能。

---

## 📝 テストコマンド

### ヘルスチェック
```bash
curl https://your-worker.workers.dev/api/health
```

### オッズ取得（桐生、1レース）
```bash
curl https://your-worker.workers.dev/api/odds/01/1
```

---

## 🔧 トラブルシューティング

### Q: "No account_id found" エラー

A: `wrangler.toml` にアカウントIDを追加:

```bash
wrangler whoami  # アカウントIDを確認
```

```toml
account_id = "your-account-id"
```

### Q: CORS エラーが出る

A: Worker コードに CORS ヘッダーが含まれているか確認。すでに `worker.js` に実装済みです。

### Q: 無料プランで足りる？

A: はい！無料プランで1日10万リクエストまで可能。個人利用なら十分です。

---

## 💡 次のステップ

1. **カスタムドメイン設定** - `CLOUDFLARE_DEPLOY.md` 参照
2. **GitHub連携** - `GITHUB_GUIDE.md` 参照
3. **本番デプロイ** - フロントエンドもデプロイして公開

---

詳細は `CLOUDFLARE_DEPLOY.md` を参照してください！
