# 🚀 Worker 再デプロイ手順（レース終了後対応版）

## 📝 変更内容

### 修正箇所
**レース終了後もオッズデータを取得できるように改修**

従来：「本日のレースは終了しました」というメッセージがあると `null` を返していた
改修後：レース終了メッセージがあってもオッズデータの抽出を試みる

これにより、三国12Rのような終了したレースでも最新のオッズが表示されます。

---

## 🔧 デプロイ手順

### 1. Cloudflare Dashboard にアクセス
https://dash.cloudflare.com/

### 2. Workers & Pages に移動
左メニューから「Workers & Pages」を選択

### 3. boatrace Worker を開く
`boatrace` という名前の Worker をクリック

### 4. Edit code をクリック
右上の「Edit code」ボタンをクリック

### 5. 既存コードを全削除
エディタ内のコードを全て選択して削除（Ctrl+A → Delete）

### 6. 新しいコードを貼り付け
プロジェクトフォルダの `worker.js` ファイルの内容を全てコピーして貼り付け

### 7. Save and Deploy
右上の「Save and Deploy」ボタンをクリック

### 8. デプロイ完了確認
デプロイが完了したら、以下のURLにアクセスして確認：
```
https://boatrace.shinta7023.workers.dev/
```

レスポンスに `"version": "2.0.0-production"` が含まれていればOK

---

## ✅ デプロイ後の確認

以下のコマンドで三国12Rのデータが取得できることを確認：

```bash
curl "https://boatrace.shinta7023.workers.dev/api/odds/10/12?hd=20260218"
```

期待される結果：
- `hasRace: true`
- `odds` に6艇分のデータ
- 1号艇のオッズが `1.0 - 1.5`
- 総投票数が180票

---

## 🔍 トラブルシューティング

### デプロイ後もデータが取得できない場合

1. **ブラウザキャッシュをクリア**
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Cmd+Option+E

2. **Worker のログを確認**
   - Dashboard → Workers & Pages → boatrace → Logs
   - エラーメッセージや警告を確認

3. **HTMLパースログを確認**
   - ログに `[10-12] Race has ended, but will try to parse odds data` が表示されていればOK
   - `Found X odds ranges in HTML` でオッズの抽出数を確認

---

## 📌 重要な変更点まとめ

```javascript
// 修正前
if (html.includes('本日のレースは終了しました') || 
    html.includes('レース不成立') || 
    html.includes('本日の開催はございません')) {
  return null; // ❌ 終了レースは全てnullを返していた
}

// 修正後
if (html.includes('レース不成立') || 
    html.includes('本日の開催はございません')) {
  return null; // ✅ 不成立・開催なしのみnullを返す
}

const raceEnded = html.includes('本日のレースは終了しました');
if (raceEnded) {
  console.log('Race has ended, but will try to parse odds data');
  // ✅ 終了していてもオッズ抽出を試みる
}
```

---

## 完了報告

デプロイ完了後、以下のように報告してください：

```
Worker を再デプロイしました。
バージョン: 2.0.0-production を確認しました。
```

その後、3条件の最終検証を実施します。
