# 🚀 本番モードへの切り替えガイド

このアプリを実際の競艇オッズAPIに接続するための手順です。

---

## 📋 現在の状態

✅ **デモモード**: モックデータを表示中  
❌ **本番モード**: 未設定（Cloudflare Worker のデプロイが必要）

---

## 🎯 本番モードに切り替える方法

### ステップ1: Cloudflare Worker をデプロイ

#### 1-1. Wrangler のインストール

ターミナル（コマンドプロンプト）で実行：

```bash
npm install -g wrangler
```

#### 1-2. Cloudflare にログイン

```bash
wrangler login
```

ブラウザが開くので、Cloudflareアカウントでログイン（無料アカウントでOK）。

#### 1-3. プロジェクトフォルダに移動

```bash
cd /path/to/boatrace-project
```

#### 1-4. デプロイ実行

```bash
wrangler deploy
```

成功すると、このような URL が表示されます：

```
✨ Published boatrace-odds-proxy
   https://boatrace-odds-proxy.xxxxxxxxxx.workers.dev
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   この URL をコピー！
```

---

### ステップ2: フロントエンド設定を変更

#### 2-1. `js/config.js` を開く

エディタで `js/config.js` を開きます。

#### 2-2. 設定を変更

```javascript
// 環境設定
const CONFIG = {
  // ステップ1で取得したWorker URLに変更
  API_BASE_URL: 'https://boatrace-odds-proxy.xxxxxxxxxx.workers.dev',
  
  // デモモードをオフに変更
  USE_DEMO_MODE: false
};
```

#### 2-3. 保存

ファイルを保存します。

---

### ステップ3: 動作確認

#### 3-1. ブラウザで開く

`index.html` をブラウザで開きます。

#### 3-2. 確認ポイント

- ローディング表示の後、データが表示される
- ブラウザのコンソールにエラーがないか確認（F12キーでコンソールを開く）
- 実際のオッズデータが取得されているか

---

## ⚠️ よくある問題と解決方法

### Q1: "wrangler: command not found" エラー

**原因**: Wrangler がインストールされていない

**解決策**:
```bash
npm install -g wrangler
```

Node.js がインストールされていない場合は、https://nodejs.org からインストール。

---

### Q2: Worker のデプロイができない

**原因**: `wrangler.toml` が見つからない、または設定が間違っている

**解決策**:

プロジェクトフォルダに `wrangler.toml` があることを確認：

```toml
name = "boatrace-odds-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"
workers_dev = true
```

---

### Q3: フロントエンドでエラーが出る

**原因**: Worker URL が間違っている、またはWorkerがデプロイされていない

**解決策**:

1. Worker が正しくデプロイされているか確認：
   ```bash
   curl https://your-worker-url.workers.dev/api/health
   ```

2. レスポンスが返ってくるはずです：
   ```json
   {"success":true,"data":{"status":"ok","timestamp":"..."}}
   ```

3. `js/config.js` のURLが正しいか確認

---

### Q4: CORS エラーが出る

**原因**: Worker のCORSヘッダー設定に問題がある

**解決策**:

`worker.js` に CORS ヘッダーが含まれていることを確認：

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

すでに実装済みのはずです。

---

## 🔄 デモモードに戻す方法

本番モードで問題が発生した場合、デモモードに戻せます。

`js/config.js` を編集：

```javascript
const CONFIG = {
  API_BASE_URL: 'YOUR_WORKER_URL',
  USE_DEMO_MODE: true  // ← true に変更
};
```

---

## 💰 料金について

### Cloudflare Workers 無料プラン

- **リクエスト数**: 100,000/日
- **CPU時間**: 10ms/リクエスト
- **料金**: **0円**

個人利用なら無料プランで十分です！

有料プランに自動移行することはありません。

---

## 📖 さらに詳しく知りたい方へ

- **`QUICKSTART.md`** - 5分で完了する最短手順
- **`CLOUDFLARE_DEPLOY.md`** - Cloudflare Workers の詳細
- **`BOATRACE_API_GUIDE.md`** - 競艇APIの仕組み
- **`API_MOCK_GUIDE.md`** - モックとAPIの切り替え

---

## ✅ まとめ

1. `wrangler deploy` でWorkerをデプロイ
2. 発行されたURLを `js/config.js` に設定
3. `USE_DEMO_MODE: false` に変更
4. ブラウザで確認

たったこれだけで、実際の競艇オッズが表示されます！

---

## 🆘 困ったときは

このガイドで解決しない場合は、以下を確認してください：

1. ブラウザのコンソール（F12キー）にエラーメッセージが出ていないか
2. Worker のログ（`wrangler tail`）にエラーが出ていないか
3. インターネット接続は正常か

具体的なエラーメッセージがあれば、それを元に解決できます！
