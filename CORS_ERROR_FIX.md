# ❌ CORS エラー解決ガイド

## 🔴 発生しているエラー

```
Access to fetch at 'https://boatrace.shinta7023.workers.dev/...' 
from origin 'https://www.genspark.ai' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

---

## 🔍 原因

Cloudflare Worker側でCORSヘッダーが返されていません。以下のいずれかの理由が考えられます：

1. **Workerがデプロイされていない**
2. **worker.jsのコードが正しく貼り付けられていない**
3. **CORSヘッダーのコードが欠けている**

---

## ✅ 解決手順

### ステップ1: Workerが動作しているか確認

ブラウザで以下のURLを開いてください：

```
https://boatrace.shinta7023.workers.dev/api/health
```

#### ✅ 正常な場合

以下のようなJSONが表示されます：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-02-18T..."
  }
}
```

→ **Workerは動作しています！** ステップ2へ進んでください。

#### ❌ エラーが出る場合

- "Worker not found" または404エラー
- "Syntax error"
- 何も表示されない

→ **Workerが正しくデプロイされていません！** 以下の手順でWorkerを再デプロイしてください。

---

### ステップ2: Workerコードを確認・再デプロイ

#### 2-1. Cloudflare ダッシュボードにアクセス

```
https://dash.cloudflare.com
```

#### 2-2. Workerを開く

1. 左サイドバー → **Workers & Pages**
2. `boatrace`（または作成したWorker名）をクリック
3. **Edit code** をクリック

#### 2-3. コードを全て削除

エディタ内の既存コードを **全て選択** して削除：
- Windows: `Ctrl + A` → `Delete`
- Mac: `Cmd + A` → `Delete`

#### 2-4. 正しいコードを貼り付け

**`WORKER_CODE_FOR_DASHBOARD.md`** を開き、コードを **全てコピー** してエディタに貼り付けます。

**重要:** コードの最初の行から最後の行まで、**漏れなく全て**コピーしてください。

#### 2-5. Save and Deploy

右上の **Save and Deploy** ボタンをクリック。

#### 2-6. 動作確認

再度、ブラウザで確認：

```
https://boatrace.shinta7023.workers.dev/api/health
```

正常なJSONレスポンスが返ってくればOK！

---

### ステップ3: フロントエンドで再テスト

`index.html` をブラウザで開き、「今すぐ更新」ボタンをクリックして、エラーが消えているか確認してください。

---

## 🐛 それでも解決しない場合

### 確認事項

1. **Workerのコードに以下が含まれているか:**

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};
```

2. **OPTIONS リクエストに対応しているか:**

```javascript
if (request.method === 'OPTIONS') {
  return new Response(null, {
    headers: corsHeaders
  });
}
```

3. **全てのレスポンスにCORSヘッダーが含まれているか:**

```javascript
return new Response(JSON.stringify({...}), {
  headers: corsHeaders  // ← これが必須
});
```

---

## 💡 別の方法: デモモードに戻す

Workerの設定がうまくいかない場合、一時的にデモモードに戻すことができます。

`js/config.js` を編集：

```javascript
const CONFIG = {
  API_BASE_URL: 'https://boatrace.shinta7023.workers.dev',
  USE_DEMO_MODE: true  // ← これをtrueに変更
};
```

これでモックデータが表示され、アプリの動作確認ができます。

---

## 📞 サポートが必要な場合

以下の情報を教えてください：

1. **https://boatrace.shinta7023.workers.dev/api/health にアクセスした結果**
   - 表示された内容をそのまま教えてください

2. **Cloudflare Workerのエディタ画面のスクリーンショット**
   - コードが正しく貼り付けられているか確認します

3. **ブラウザのコンソールエラーの詳細**
   - F12キーでコンソールを開き、エラーメッセージをコピーしてください

具体的にサポートします！
