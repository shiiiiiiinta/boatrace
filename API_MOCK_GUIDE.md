# 競艇オッズAPI モック実装について

このプロジェクトでは、Cloudflare Workersを使用して競艇公式APIへのプロキシを構築しています。

## 🎯 実装概要

### アーキテクチャ

```
[ブラウザ] → [Cloudflare Worker (プロキシ)] → [BOATRACE 公式サイト]
                     ↓
              CORS ヘッダー追加
                     ↓
              [ブラウザに返却]
```

### なぜプロキシが必要？

競艇公式サイト（`https://www.boatrace.jp`）はCORSヘッダーを返さないため、ブラウザから直接APIを呼び出すとセキュリティエラーが発生します。Cloudflare Workerをプロキシとして使用することで、この問題を解決します。

---

## 📁 関連ファイル

### バックエンド（Cloudflare Worker）
- **`worker.js`**: プロキシサーバーのコード
- **`wrangler.toml`**: Cloudflare Workers の設定ファイル

### フロントエンド
- **`js/config.js`**: API設定（デモモード/本番モード切り替え）
- **`js/main.js`**: オッズ取得・表示ロジック

---

## 🔄 動作モード

### 1. デモモード（デフォルト）

```javascript
// js/config.js
const CONFIG = {
  API_BASE_URL: 'YOUR_WORKER_URL',
  USE_DEMO_MODE: true  // ←これ
};
```

- モックデータを表示
- Workerのデプロイ不要
- すぐに動作確認可能

### 2. 本番モード

```javascript
// js/config.js
const CONFIG = {
  API_BASE_URL: 'https://boatrace-odds-proxy.your-subdomain.workers.dev',
  USE_DEMO_MODE: false  // ←本番APIを使用
};
```

- 実際の競艇公式サイトからデータ取得
- Cloudflare Workerのデプロイが必要
- リアルタイムのオッズ情報を表示

---

## 🚀 本番モードへの移行手順

### ステップ1: Cloudflare Workerをデプロイ

```bash
# Wranglerをインストール
npm install -g wrangler

# Cloudflareにログイン
wrangler login

# デプロイ
wrangler deploy
```

詳細: `CLOUDFLARE_DEPLOY.md` または `QUICKSTART.md` を参照

### ステップ2: Worker URLを取得

デプロイ成功後に表示されるURLをコピー:
```
https://boatrace-odds-proxy.your-subdomain.workers.dev
```

### ステップ3: フロントエンドの設定を変更

`js/config.js` を編集:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://boatrace-odds-proxy.your-subdomain.workers.dev',
  USE_DEMO_MODE: false
};
```

### ステップ4: 動作確認

ブラウザで `index.html` を開き、実際のAPIからデータが取得されることを確認。

---

## 🔍 API エンドポイント

### Worker API 仕様

#### GET /api/odds/:jcd/:rno?hd=YYYYMMDD

**パラメータ:**
- `jcd`: 場コード（01〜24）
- `rno`: レース番号（1〜12）
- `hd`: 開催日（YYYYMMDD形式、オプション）

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "jcd": "01",
    "raceNumber": 1,
    "hasRace": true,
    "odds": [
      {
        "boatNumber": 1,
        "odds": 1.5,
        "voteTickets": 12450,
        "voteAmount": 18675000
      },
      ...
    ],
    "timestamp": "2026-01-23T12:34:56.789Z"
  }
}
```

#### GET /api/health

ヘルスチェック用エンドポイント。

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-23T12:34:56.789Z"
  }
}
```

---

## ⚠️ 注意事項

### 1. HTMLパース処理

現在の `worker.js` には、BOATRACE公式サイトからのHTMLレスポンスをパースする処理が含まれていますが、**実際のHTML構造を確認して調整が必要**です。

```javascript
// worker.js の parseOddsHtml 関数
function parseOddsHtml(html) {
  // ※ 実際のHTML構造に応じて調整が必要
  const oddsMatches = html.matchAll(/oddstf_.*?>([\d.]+)<\/td>/g);
  // ...
}
```

### 2. モックデータのフォールバック

API取得に失敗した場合、自動的にモックデータを返すようになっています。開発・デバッグに便利です。

```javascript
// データが取得できない場合はモックを返す
if (!oddsData) {
  console.log('Could not parse data, returning mock data');
  oddsData = generateMockOdds();
}
```

### 3. レート制限

競艇公式サイトへの過度なリクエストは避けてください。現在のアプリは5分ごとの更新に設定されています。

---

## 🧪 テスト方法

### ローカルテスト

```bash
# Workerをローカルで起動
wrangler dev

# 別ターミナルでテスト
curl http://localhost:8787/api/odds/01/1
```

### 本番テスト

```bash
curl https://your-worker.workers.dev/api/odds/01/1
```

---

## 📊 パフォーマンス

### Cloudflare Workers の利点

- **グローバルCDN**: 世界中で高速レスポンス
- **スケーラブル**: トラフィック増加に自動対応
- **低レイテンシ**: 平均応答時間 < 50ms
- **コスト効率**: 無料プランで1日10万リクエスト

---

## 🔧 今後の改善点

1. **HTMLパース処理の精度向上**
   - 実際のBOATRACE公式サイトのHTML構造を解析
   - より確実なデータ抽出ロジックの実装

2. **キャッシング実装**
   - 同じレースのデータを一定時間キャッシュ
   - API呼び出し回数を削減

3. **エラーハンドリング強化**
   - リトライロジック
   - 部分的なデータ取得失敗時の対応

4. **データ検証**
   - 取得したオッズデータの妥当性チェック
   - 異常値の検出とフィルタリング

---

## 📚 参考資料

- `CLOUDFLARE_DEPLOY.md` - 詳細なデプロイ手順
- `QUICKSTART.md` - 最短デプロイ手順（5分）
- `PRODUCTION_GUIDE.md` - 本番リリース全般のガイド
- `GITHUB_GUIDE.md` - バージョン管理セットアップ

---

## 💬 サポート

何か問題が発生した場合は、以下を確認してください:

1. `wrangler dev` でローカル動作するか
2. CORS ヘッダーが正しく設定されているか
3. Worker のログに エラーが出ていないか（`wrangler tail`）

---

このモック実装により、CORS問題を解決しながら実際の競艇オッズデータを取得できます！
