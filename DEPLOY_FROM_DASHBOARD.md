# 🌐 Cloudflare ダッシュボードから直接デプロイする方法

**コマンドライン不要！ブラウザだけで完結！**

---

## 📋 必要なもの

- Cloudflareアカウント（✅ 発行済み）
- ブラウザ
- `worker.js` ファイルの内容（このプロジェクトに含まれています）

---

## 🚀 手順（5分）

### ステップ1: Cloudflare ダッシュボードにログイン

1. https://dash.cloudflare.com にアクセス
2. メールアドレスとパスワードでログイン

---

### ステップ2: Workerを作成

1. 左サイドバーの **「Workers & Pages」** をクリック
2. 右上の **「Create application」** ボタンをクリック
3. **「Create Worker」** を選択
4. Worker名を入力（例: `boatrace-odds-proxy`）
5. **「Deploy」** をクリック

---

### ステップ3: コードを貼り付け

1. デプロイ後、**「Edit code」** ボタンをクリック
2. エディタが開くので、既存のコードを全て削除
3. **このプロジェクトの `worker.js` の内容を全てコピー**
4. エディタに貼り付け
5. 右上の **「Save and Deploy」** ボタンをクリック

---

### ステップ4: URLを取得

デプロイが完了すると、以下のような画面が表示されます：

```
Your worker is live at:
https://boatrace-odds-proxy.xxxxxxxxxx.workers.dev
                        ^^^^^^^^^^
                        あなた固有のサブドメイン
```

**この URL をコピーしてください！**

---

### ステップ5: 動作確認

ブラウザで以下のURLにアクセス：

```
https://your-worker-url.workers.dev/api/health
```

以下のようなレスポンスが返ってくればOK：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-02-18T..."
  }
}
```

---

### ステップ6: フロントエンドに設定

1. プロジェクトの `js/config.js` を開く
2. 以下のように編集：

```javascript
const CONFIG = {
  // ステップ4で取得したURL
  API_BASE_URL: 'https://your-worker-url.workers.dev',
  
  // デモモードをオフ
  USE_DEMO_MODE: false
};
```

3. ファイルを保存

---

### ステップ7: 完成！

`index.html` をブラウザで開くと、実際の競艇オッズ（または競艇APIから取得したデータ）が表示されます！

---

## 📸 スクリーンショット付き手順

### 1. Workers & Pages にアクセス

![Cloudflare Dashboard](画像)

左サイドバーから「Workers & Pages」をクリック

---

### 2. Create Worker

![Create Worker](画像)

「Create application」→「Create Worker」

---

### 3. Worker名を入力

![Worker Name](画像)

例: `boatrace-odds-proxy`

---

### 4. Edit Code

![Edit Code](画像)

「Edit code」をクリックしてエディタを開く

---

### 5. worker.js を貼り付け

![Paste Code](画像)

プロジェクトの `worker.js` の内容を全てコピー&ペースト

---

### 6. Save and Deploy

![Save](画像)

右上の「Save and Deploy」をクリック

---

### 7. URLを取得

![URL](画像)

表示されたURLをコピー

---

## ⚠️ よくある質問

### Q: Worker名は何でもいい？

A: はい、任意の名前でOKです。例：
- `boatrace-proxy`
- `odds-api`
- `my-boatrace-worker`

---

### Q: 料金は発生する？

A: いいえ、無料プランで十分です。
- 無料プラン: 1日10万リクエスト
- 自動的に有料プランに移行することはありません

---

### Q: コードを間違えた場合は？

A: 何度でも編集できます。
1. Worker の詳細ページに戻る
2. 「Edit code」をクリック
3. 修正して「Save and Deploy」

---

### Q: URLがわからなくなった

A: Workers & Pages → 作成したWorker → 「Preview」タブでURLを確認できます

---

## 🐛 トラブルシューティング

### エラー: "Syntax error"

**原因**: コードの貼り付けが不完全

**解決策**:
1. `worker.js` の内容を**最初から最後まで全て**コピー
2. エディタの内容を全て削除してから貼り付け
3. 再度「Save and Deploy」

---

### エラー: "Worker exceeds size limit"

**原因**: コードが大きすぎる（通常は発生しません）

**解決策**:
- `worker.js` のコメントを削除して軽量化
- 現在のコードサイズは問題ないはずです

---

### フロントエンドでCORSエラー

**原因**: Worker のコードにCORSヘッダーがない

**解決策**:
- `worker.js` に以下が含まれていることを確認：
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
};
```
- すでに実装済みです

---

## 📝 worker.js の場所

このプロジェクトのルートディレクトリにあります：

```
boatrace-project/
├── worker.js          ← これ！
├── index.html
├── js/
│   ├── config.js
│   └── main.js
└── ...
```

---

## 🎯 まとめ

1. Cloudflare ダッシュボードにログイン
2. Workers & Pages → Create Worker
3. `worker.js` のコードを貼り付け
4. URLをコピー
5. `js/config.js` に設定
6. 完成！

**所要時間: 5分**

---

## 🆘 それでも困ったら

以下の情報を教えてください：

1. どのステップで詰まったか
2. 表示されているエラーメッセージ
3. スクリーンショット（可能であれば）

具体的にサポートします！

---

**頑張ってください！簡単ですよ！** 💪
