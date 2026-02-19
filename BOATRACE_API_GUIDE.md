# 競艇公式API 利用ガイド

## ✅ 重要なお知らせ

**競艇（BOATRACE）の公式サイトは、APIの利用登録は不要です。**

公式サイトは誰でもアクセス可能で、データはHTMLとして公開されています。ただし、**CORS制限があるためブラウザから直接アクセスできません**。

---

## 🔍 BOATRACE 公式サイトの構造

### オッズページのURL構造

```
https://www.boatrace.jp/owpc/pc/race/oddstf?jcd={場コード}&rno={レース番号}&hd={開催日}
```

**パラメータ:**
- `jcd`: 場コード（01〜24）
  - 01: 桐生
  - 02: 戸田
  - ...
  - 24: 大村

- `rno`: レース番号（1〜12）

- `hd`: 開催日（YYYYMMDD形式）
  - 例: 20260123

**例:**
```
# 桐生競艇場、1R、2026年1月23日
https://www.boatrace.jp/owpc/pc/race/oddstf?jcd=01&rno=1&hd=20260123
```

---

## ⚠️ CORS問題について

### 問題

ブラウザから直接アクセスすると、以下のエラーが発生します：

```
Access to fetch at 'https://www.boatrace.jp/...' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

### 原因

競艇公式サイトは CORS ヘッダーを返さないため、ブラウザのセキュリティポリシーにより直接アクセスがブロックされます。

### 解決策

以下のいずれかの方法でCORS問題を回避する必要があります：

1. **Cloudflare Workers でプロキシを構築** ← 推奨
2. バックエンドサーバーを立てる
3. ブラウザ拡張機能でCORSを無効化（開発用のみ）

---

## 🚀 Cloudflare Workers デプロイ手順（簡易版）

### 前提条件

- Cloudflareアカウント（無料）
- Node.js がインストール済み

### 手順

```bash
# 1. Wrangler をインストール
npm install -g wrangler

# 2. Cloudflare にログイン
wrangler login

# 3. プロジェクトフォルダに移動
cd /path/to/your/project

# 4. デプロイ
wrangler deploy
```

デプロイが成功すると、以下のような URL が発行されます：

```
✨ Published boatrace-odds-proxy
   https://boatrace-odds-proxy.your-subdomain.workers.dev
```

この URL を `js/config.js` に設定すれば、本番APIが使えます。

---

## 🆓 無料で利用可能

### Cloudflare Workers 無料プラン

- **リクエスト数**: 100,000/日
- **CPU時間**: 10ms/リクエスト
- **料金**: 完全無料

個人利用や小規模サイトなら無料プランで十分です。

### BOATRACE 公式サイト

- 利用登録: **不要**
- API キー: **不要**
- 料金: **無料**

---

## 📝 利用規約の確認

競艇公式サイトの利用規約を必ず確認してください。

### 確認事項

1. **スクレイピングの可否**
   - 過度なアクセスは避ける
   - robots.txt を確認

2. **データの商用利用**
   - 個人的な利用は問題なし
   - 商用利用の場合は要確認

3. **再配布**
   - 取得したデータの扱いに注意

### 推奨事項

- アクセス頻度を制限する（現在は5分間隔）
- User-Agent を設定する
- サーバー負荷を考慮する

---

## 🔧 代替案：CORSプロキシサービス

Cloudflare Workers以外の選択肢：

### 1. CORS Anywhere（開発用のみ）

```javascript
const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
const apiUrl = 'https://www.boatrace.jp/owpc/pc/race/oddstf?...';
fetch(proxyUrl + apiUrl);
```

**注意**: 本番環境では使用しないでください。

### 2. 自前のサーバー

Node.js + Express で簡単にプロキシサーバーを構築可能。

---

## 💡 まとめ

1. **競艇APIは登録不要**で誰でも利用可能
2. **CORS問題を解決するプロキシが必要**
3. **Cloudflare Workers が最も簡単で無料**
4. 利用規約を守って適切に利用する

---

## 🆘 デプロイできない場合

### 私（AI）にはデプロイ機能がありません

申し訳ございませんが、私はCloudflareへの実際のデプロイはできません。

### あなたができること

1. **Wrangler CLI でデプロイ**
   ```bash
   wrangler deploy
   ```

2. **Cloudflare ダッシュボードから手動デプロイ**
   - https://dash.cloudflare.com
   - Workers & Pages → Create Worker
   - `worker.js` のコードをコピー&ペースト

3. **GitHub Actions で自動デプロイ**
   - リポジトリにプッシュすると自動デプロイ

---

## 📖 詳細ドキュメント

- `QUICKSTART.md` - 5分でデプロイ
- `CLOUDFLARE_DEPLOY.md` - 詳細手順
- `API_MOCK_GUIDE.md` - API仕様

---

何かお困りのことがあれば、具体的な手順をサポートします！
