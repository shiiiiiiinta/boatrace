# 🚀 Cloudflare Pages デプロイ完全ガイド

## 📋 準備

Cloudflare Pages にデプロイするファイル：
```
index.html
css/style.css
js/config.js
js/main.js
```

---

## 🎯 デプロイ手順（直接アップロード）

### ステップ1: Cloudflare Dashboard にアクセス

1. https://dash.cloudflare.com/ にログイン
2. 左メニューから「Workers & Pages」をクリック
3. 「Create application」ボタンをクリック
4. 「Pages」タブを選択
5. 「Upload assets」を選択

### ステップ2: プロジェクト名を設定

1. **Project name** を入力
   - 例: `boatrace-odds`
   - この名前がURLになります: `https://boatrace-odds.pages.dev`

2. 「Create project」をクリック

### ステップ3: ファイルをアップロード

1. 以下のファイル・フォルダを選択してドラッグ&ドロップ：
   ```
   index.html
   css/ (フォルダごと)
   js/ (フォルダごと)
   ```

2. 「Deploy site」をクリック

### ステップ4: デプロイ完了

- 数秒でデプロイが完了します
- **公開URL** が表示されます
  - 例: `https://boatrace-odds.pages.dev`
- このURLでアクセス可能になります

---

## 🔄 更新方法

### ファイルを更新する場合

1. Cloudflare Dashboard → Workers & Pages → `boatrace-odds`
2. 「Deployments」タブ
3. 「Create deployment」
4. 更新したファイルをアップロード
5. 「Save and Deploy」

---

## 🌐 カスタムドメイン設定（オプション）

独自ドメイン（例: `odds.yourname.com`）を使いたい場合：

### ステップ1: ドメインを追加

1. Cloudflare Pages のプロジェクトページ
2. 「Custom domains」タブ
3. 「Set up a custom domain」
4. ドメイン名を入力（例: `odds.yourname.com`）

### ステップ2: DNS設定

1. Cloudflare DNS設定ページに移動
2. CNAMEレコードを追加
   - **Name**: `odds`
   - **Target**: `boatrace-odds.pages.dev`

---

## 📱 公開後の確認

### 確認項目

1. ✅ サイトが正しく表示される
2. ✅ オッズデータが取得できる
3. ✅ 自動更新が動作する
4. ✅ メール送信機能が動作する

### トラブルシューティング

#### 問題1: Worker APIに接続できない

**症状**: オッズが表示されない

**原因**: `js/config.js` のAPI_BASE_URLが正しくない

**解決**:
```javascript
// js/config.js
const CONFIG = {
    USE_DEMO_MODE: false, // 必ずfalse
    API_BASE_URL: 'https://boatrace.shinta7023.workers.dev' // Workerの正しいURL
};
```

#### 問題2: CORSエラー

**症状**: ブラウザコンソールに「CORS policy」エラー

**原因**: Worker のCORS設定

**解決**: Worker は既に正しく設定済みのはず（`Access-Control-Allow-Origin: *`）

---

## 📊 Cloudflare Pages の制限

### 無料プランの制限

- **ビルド数**: 月500回まで
- **帯域幅**: 無制限
- **リクエスト数**: 無制限
- **ファイルサイズ**: 25MB/ファイル
- **プロジェクト数**: 100個まで

**→ このアプリには十分すぎる制限です！**

---

## 🎨 代替方法: GitHubと連携

もしGitHubを使いたい場合：

### ステップ1: GitHubにプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/boatrace-odds.git
git push -u origin main
```

### ステップ2: Cloudflare Pages と連携

1. Cloudflare Pages → Create application → Pages
2. 「Connect to Git」を選択
3. GitHubアカウントを連携
4. リポジトリを選択
5. 自動デプロイ設定

**メリット**:
- Gitにプッシュするだけで自動デプロイ
- バージョン管理が楽

---

## 🔐 環境変数の設定（必要な場合）

もし将来的に環境変数（API Keyなど）が必要になったら：

1. Cloudflare Pages のプロジェクトページ
2. 「Settings」タブ
3. 「Environment variables」
4. 変数を追加

---

## 📝 デプロイ後のURL

デプロイが完了すると、以下のようなURLで公開されます：

```
https://boatrace-odds.pages.dev
```

または、カスタムドメインを設定した場合：

```
https://odds.yourname.com
```

---

## 🎉 完了！

Cloudflare Pages にデプロイすることで：
- ✅ 高速なCDN配信
- ✅ 自動HTTPS
- ✅ 無料で無制限
- ✅ Worker と同じプラットフォーム

**デプロイ準備ができたら「デプロイします」と報告してください！**
