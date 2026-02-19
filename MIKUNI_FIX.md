# 🔧 三国（10）表示修正 - Worker更新

## 📋 問題

**三国（10）が表示されない**
- スケジュール取得: ✅ 成功（`hasSchedule: true`）
- 12Rオッズ取得: ❌ 失敗（`hasRace: false`）
- 公式サイト: ✅ データあり

**結論**: Worker側のオッズパース処理が三国のHTMLを正しく解析できていない

---

## ✅ 修正内容

### 1. 開催なしチェックの緩和
```javascript
// ❌ 修正前（厳しすぎる）
if (html.includes('本日の開催はございません') ||
    html.includes('データがありません') ||  // ← これが誤検知
    html.includes('レース不成立')) {
  return null;
}

// ✅ 修正後（適切）
if (html.includes('本日の開催はございません')) {
  return null;
}
if (html.includes('レース不成立')) {
  return null;
}
// 「データがありません」は除外（誤検知の可能性）
```

### 2. 複数パターンのマッチング追加
```javascript
// パターン1: <td>1.0<br>-<br>1.5</td> 形式
// パターン2: 1.0 - 1.5 形式（改行なし）
// パターン3: <td>内の数値ペア
```

### 3. デバッグログの充実
```javascript
console.log(`[${jcd}-${rno}] Pattern1 found ${oddsMatches.length} odds`);
console.log(`[${jcd}-${rno}] HTML length: ${html.length}, first 500 chars: ${html.substring(0, 500)}`);
```

---

## 🚀 デプロイ手順

### Step 1: Cloudflare Worker 更新

1. https://dash.cloudflare.com にアクセス
2. **Workers & Pages** → `boatrace` → **Edit code**
3. **既存コードを全削除**
4. **worker-v3.js の内容を全体貼り付け**
5. **Save and Deploy**

### Step 2: デプロイ確認

デプロイ完了後（約30秒）、以下のURLにアクセス：
```
https://boatrace.shinta7023.workers.dev/api/health
```

**期待レスポンス**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "3.0.0"
  }
}
```

### Step 3: 三国のオッズ確認

```
https://boatrace.shinta7023.workers.dev/api/odds/10/12?hd=20260218
```

**期待レスポンス**:
```json
{
  "success": true,
  "data": {
    "jcd": "10",
    "raceNumber": 12,
    "hasRace": true,  // ← これが true になるべき
    "odds": [ ... ]
  }
}
```

---

## 🧪 テスト方法

### 1. debug-mikuni.html で再確認

```
debug-mikuni.html を開く
→ 「12Rオッズ取得」ボタンをクリック
```

**期待結果**:
- `success: true`
- `hasRace: true` ← これが `true` になるべき
- オッズデータが表示される

### 2. index.html で確認

```
index.html を開く（Ctrl + Shift + R でキャッシュクリア）
```

**期待結果**:
- 三国（10）が表示される
- 12R（🌙 前日データ）+ オッズが表示される

---

## 📊 その他の場の確認

三国以外にも同じ問題が発生している可能性があるため、全24場を確認：

```
final-test-v2.html を開く
→ 「全24場を一括テスト」をクリック
```

**確認項目**:
- 開催があった場が全て表示されるか
- `hasRace: false` になっている場がないか

---

## 🐛 トラブルシューティング

### 問題: Worker更新後も三国が表示されない

#### 確認1: Workerが正しくデプロイされているか
```
https://boatrace.shinta7023.workers.dev/api/odds/10/12?hd=20260218
```
→ `hasRace: true` になっているか確認

#### 確認2: Cloudflare Workerのログを確認
1. Cloudflare Dashboard → Workers & Pages → `boatrace` → **Logs**
2. `/api/odds/10/12` のリクエストを探す
3. ログに以下が表示されるか確認：
   ```
   [10-12] Pattern1 found X odds
   [10-12] Successfully parsed 6 boats
   ```

#### 確認3: ブラウザキャッシュをクリア
```
Ctrl + Shift + R（Windows）
Cmd + Shift + R（Mac）
```

---

## ✅ 期待される結果

### debug-mikuni.html
- ✅ スケジュール: `hasSchedule: true`
- ✅ 12Rオッズ: `hasRace: true`
- ✅ オッズ数: 6艇
- ✅ 1号艇オッズ: 例えば 1.0〜1.5

### index.html
- ✅ 三国（10）が表示される
- ✅ 12R（🌙 前日データ）
- ✅ オッズが正しく表示される

---

## 📝 変更ファイル

### 更新済み
- ✅ **worker-v3.js** - オッズパース処理改善

### 新規作成
- ✅ **debug-mikuni.html** - 三国デバッグツール
- ✅ **MIKUNI_FIX.md** - このドキュメント

---

## 🎯 次のアクション

1. **Cloudflare Worker を更新**（worker-v3.js）
2. **debug-mikuni.html で「12Rオッズ取得」テスト**
3. **index.html で三国が表示されるか確認**
4. **問題があれば Cloudflare Worker のログを確認**

---

**修正日時**: 2026-02-19 05:00  
**修正内容**: オッズパース処理を改善、複数パターン対応  
**次のステップ**: Worker再デプロイ → 三国表示確認
