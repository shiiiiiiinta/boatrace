# Cloudflare Worker に HTML 配信機能を追加する手順

## 📋 現在の状況

- `https://boatrace.shinta7023.workers.dev/` → API情報のJSONを返すだけ
- `index.html` → ローカルファイルとして開く必要がある

## 🎯 目標

`https://boatrace.shinta7023.workers.dev/` でWebアプリ全体を表示できるようにする

---

## ⚠️ 重要な注意点

Worker に HTML を埋め込むと、コードが長くなり管理が難しくなります。

**推奨方法**:
1. **Cloudflare Pages** を使用（Worker と分離）
2. **GitHub Pages** を使用
3. **別のホスティングサービス**を使用

ただし、すぐにWorker上で動かしたい場合は、以下の方法で対応できます。

---

## 🔧 方法1: 簡易版（HTMLを直接埋め込む）

`worker.js` の最後に以下を追加：

```javascript
// ルートパスでHTMLを返す
if (url.pathname === '/' || url.pathname === '/index.html') {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>競艇複勝オッズ - 全場リアルタイム表示</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <style>
      /* ここに css/style.css の内容を貼り付け */
    </style>
</head>
<body>
    <!-- ここに index.html のbody内容を貼り付け -->
    <script>
      // ここに js/config.js の内容
      // ここに js/main.js の内容
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
```

**デメリット**:
- コードが非常に長くなる
- 編集が大変
- Workerのサイズ制限に引っかかる可能性

---

## 🔧 方法2: 推奨（Cloudflare Pages を使用）

### ステップ1: GitHub にプロジェクトをプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/boatrace-app.git
git push -u origin main
```

### ステップ2: Cloudflare Pages で公開

1. Cloudflare ダッシュボード → **Workers & Pages**
2. **Create application** → **Pages** → **Connect to Git**
3. GitHubリポジトリを選択
4. **Begin setup**
5. **Save and Deploy**

数分で `https://boatrace-app.pages.dev` のようなURLが発行されます。

### ステップ3: カスタムドメイン設定（オプション）

Cloudflare Pages で独自ドメインを設定できます。

---

## 🔧 方法3: 現実的な折衷案

Workerでは API のみ提供し、HTMLは別途ホスティングする。

### 構成:
- **API**: `https://boatrace.shinta7023.workers.dev/api/*`
- **Web App**: `https://your-site.pages.dev/`

### メリット:
- ✅ 管理しやすい
- ✅ Workerのサイズ制限を気にしなくて良い
- ✅ 静的ファイル配信が高速

---

## 💡 どれを選ぶ？

| 方法 | 難易度 | 推奨度 | メリット |
|------|--------|--------|---------|
| Worker埋め込み | 中 | ⭐ | すぐできる |
| Cloudflare Pages | 易 | ⭐⭐⭐⭐⭐ | 本格的、管理しやすい |
| GitHub Pages | 易 | ⭐⭐⭐⭐ | 無料、簡単 |

---

## 🚀 次のステップ

どの方法を選びますか？

1. **Workerに埋め込む** → すぐに動くが管理が大変
2. **Cloudflare Pages** → 推奨、本格的
3. **GitHub Pages** → 簡単、無料

教えていただければ、具体的な手順をサポートします！
