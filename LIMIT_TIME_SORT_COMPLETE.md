# ✅ 締切時刻表示とソート機能 実装完了

## 実装内容

### 1. 締切時刻の表示
**場所**: 会場名とレース番号の間

**表示形式**: `⏰ 14:55`

**スタイル**:
- 赤色（`#ff6b6b`）で目立たせる
- フォントサイズ: 0.95rem
- 太字（font-weight: 600）

---

### 2. 締切時刻が近い順にソート

**ソートロジック**:
```javascript
// 締切時刻の昇順でソート（締切が近い順）
venuesWithData.sort((a, b) => {
    const timeA = a.data.limitTimestamp || Infinity;
    const timeB = b.data.limitTimestamp || Infinity;
    return timeA - timeB;
});
```

**表示順**:
1. 最も締切が近い競艇場（例: 14:25）
2. 次に締切が近い競艇場（例: 14:55）
3. ...
4. 締切時刻が取得できない競艇場（最後尾）

---

### 3. データ構造の変更

#### fetchVenueOdds の戻り値
```javascript
return {
    raceNumber: 9,
    odds: [...],
    limitTime: "14:55",           // 追加
    limitTimestamp: 1739847300000  // 追加
};
```

#### selectBestRace の戻り値
```javascript
return {
    raceNumber: 9,
    limitTime: "14:55",
    limitTimestamp: 1739847300000
};
```

---

## 📋 更新ファイル

- ✅ `js/main.js` - fetchVenueOdds, selectBestRace, fetchAllOdds, renderVenueCard を修正
- ✅ `css/style.css` - .limit-time スタイル追加、.venue-header のレイアウト調整

---

## 🎨 表示例

### カードヘッダー
```
┌─────────────────────────────────┐
│ 三国    ⏰ 14:55    9R          │
└─────────────────────────────────┘
```

- **三国**: 会場名（青色）
- **⏰ 14:55**: 締切時刻（赤色）
- **9R**: レース番号（紫のバッジ）

---

## 🧪 動作確認

### 確認ポイント

1. **締切時刻が表示される**
   - 各カードに「⏰ HH:MM」形式で表示
   - 赤色で目立つ

2. **締切が近い順に並ぶ**
   - 一番上のカード = 最も締切が近い
   - 下に行くほど締切が遠い

3. **全レース終了の場合**
   - 12Rの締切時刻が表示される
   - 全レース終了の場合は全て同じ扱い

---

## 🔄 Cloudflare Pages に再デプロイ

ファイルを更新したので、Cloudflare Pages に再デプロイしてください：

### 手順

1. Cloudflare Dashboard にログイン
   - https://dash.cloudflare.com/

2. Workers & Pages → `boatraceodds` → Deployments

3. **「Create deployment」**をクリック

4. 更新したファイルをアップロード：
   ```
   js/main.js (更新)
   css/style.css (更新)
   index.html (変更なし)
   ```

5. **「Save and Deploy」**

6. 数秒で完了
   - https://boatraceodds.pages.dev で確認

---

## 📱 ブラウザで確認

再デプロイ後、以下を確認してください：

1. **締切時刻が表示されている**
2. **締切が近い順に並んでいる**
3. **レイアウトが崩れていない**

---

## 🎉 完了！

締切時刻の表示とソート機能が実装されました。

ブラウザをリフレッシュ（または再デプロイ）して確認してください！
