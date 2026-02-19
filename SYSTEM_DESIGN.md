# システム設計書 - 競艇オッズアプリ

**バージョン**: v3.2.1  
**最終更新**: 2026-02-19 06:45

---

## 📋 目次

1. [全体フロー](#全体フロー)
2. [時間帯別の動作ルール](#時間帯別の動作ルール)
3. [APIリクエスト詳細](#apiリクエスト詳細)
4. [データ表示ロジック](#データ表示ロジック)
5. [レース選択ロジック](#レース選択ロジック)
6. [タイムスタンプ処理](#タイムスタンプ処理)

---

## 🔄 全体フロー

```
【ユーザーがページを開く / 更新ボタンを押す】
         ↓
【1. 日時判定】getDateInfo()
   - 現在時刻をJSTで取得
   - 時間帯に応じて targetDate と showOnlyRace12 を決定
         ↓
【2. スケジュール一括取得】fetchScheduleForVenue() × 24場
   - API: GET /api/race-schedule/{jcd}?hd={targetDate}
   - 各場のレース一覧（1R-12R）と締切時刻を取得
         ↓
【3. レース選択】selectBestRaceFromSchedule()
   - showOnlyRace12=true → 12Rを選択
   - showOnlyRace12=false → 締切未到来の最も近いレースを選択
   - すべて終了している場合 → 12Rにフォールバック
         ↓
【4. オッズ取得】fetchVenueOdds() × 24場
   - API: GET /api/odds/{jcd}/{raceNumber}?hd={targetDate}
   - 選択されたレースのオッズデータを取得
         ↓
【5. ソート】
   - 締切時刻が近い順に並び替え
   - 開催なしの場は最後尾
         ↓
【6. 画面表示】renderVenueCard()
   - オッズテーブルを描画
   - 締切時刻/前日データラベルを表示
```

---

## ⏰ 時間帯別の動作ルール

### 📅 現在時刻の判定方法

```javascript
const now = new Date();
const jstOffset = 9 * 60 * 60 * 1000;
const jstTime = new Date(now.getTime() + jstOffset);
const hours = jstTime.getUTCHours(); // JST の時刻
```

### ⏱️ 時間帯別ルール

| 時間帯 | targetDate | showOnlyRace12 | 表示内容 | ラベル |
|--------|-----------|----------------|---------|--------|
| **0:00-7:59** | 前日 | `true` | 前日の12R | 🌙 前日データ |
| **8:00-22:59** | 当日 | `false` | 締切未到来の最も近いレース<br>（全終了なら12R） | ⏰ HH:MM<br>（締切時刻） |
| **23:00-23:59** | 当日 | `true` | 当日の12R | ✅ 本日データ |

### 🎯 具体例

**現在時刻: 2026-02-19 01:30 (JST)**
```javascript
hours = 1
targetDate = "20260218"  // 前日
showOnlyRace12 = true    // 12R固定
表示: 2/18の12R（結果表示）
ラベル: "🌙 前日データ"
```

**現在時刻: 2026-02-19 14:30 (JST)**
```javascript
hours = 14
targetDate = "20260219"  // 当日
showOnlyRace12 false    // 締切に最も近いレース
表示: 例えば5R（締切15:10）
ラベル: "⏰ 15:10"
```

**現在時刻: 2026-02-19 23:15 (JST)**
```javascript
hours = 23
targetDate = "20260219"  // 当日
showOnlyRace12 = true    // 12R固定
表示: 2/19の12R（結果表示）
ラベル: "✅ 本日データ"
```

---

## 📡 APIリクエスト詳細

### 1回の更新で呼ばれるAPI

| API | 回数 | 目的 |
|-----|------|------|
| `/api/race-schedule/{jcd}?hd={targetDate}` | 24回 | 各場のレース一覧取得 |
| `/api/odds/{jcd}/{raceNumber}?hd={targetDate}` | 24回 | 各場の選択されたレースのオッズ取得 |
| **合計** | **48回** | |

### API #1: レーススケジュール取得

**エンドポイント**:
```
GET /api/race-schedule/{jcd}?hd={targetDate}
```

**例**:
```
GET /api/race-schedule/01?hd=20260219
```

**レスポンス（成功時）**:
```json
{
  "success": true,
  "data": {
    "jcd": "01",
    "date": "20260219",
    "hasSchedule": true,
    "races": [
      {
        "raceNumber": 1,
        "limitTime": "08:47",
        "limitTimestamp": 1739926020000
      },
      {
        "raceNumber": 2,
        "limitTime": "09:17",
        "limitTimestamp": 1739927820000
      },
      // ... 3R-11R
      {
        "raceNumber": 12,
        "limitTime": "16:32",
        "limitTimestamp": 1739954420000
      }
    ]
  }
}
```

**レスポンス（開催なし）**:
```json
{
  "success": true,
  "data": {
    "jcd": "04",
    "date": "20260218",
    "hasSchedule": false,
    "races": null
  }
}
```

### API #2: オッズ取得

**エンドポイント**:
```
GET /api/odds/{jcd}/{raceNumber}?hd={targetDate}
```

**例**:
```
GET /api/odds/01/5?hd=20260219
```

**レスポンス（成功時）**:
```json
{
  "success": true,
  "data": {
    "jcd": "01",
    "raceNumber": 5,
    "hasRace": true,
    "odds": [
      {
        "boatNumber": 1,
        "oddsMin": 1.0,
        "oddsMax": 1.5,
        "voteTickets": 15000,
        "voteAmount": 22500000
      },
      {
        "boatNumber": 2,
        "oddsMin": 2.5,
        "oddsMax": 8.4,
        "voteTickets": 5000,
        "voteAmount": 7500000
      },
      // ... 3-6号艇
    ]
  }
}
```

**レスポンス（レースなし）**:
```json
{
  "success": true,
  "data": {
    "jcd": "04",
    "raceNumber": 12,
    "hasRace": false,
    "odds": null
  }
}
```

---

## 🎯 レース選択ロジック

### フローチャート

```
┌─────────────────────────────┐
│  selectBestRaceFromSchedule  │
└───────────┬─────────────────┘
            │
      showOnlyRace12?
       ┌────┴────┐
      YES        NO
       │          │
       ▼          ▼
   【12Rを返す】  【締切判定】
                   │
              現在時刻 < 締切時刻?
                ┌──┴──┐
               YES     NO
                │       │
                ▼       ▼
          【最も近い  【全レース終了】
           レースを    →12Rを返す
           返す】
```

### コード実装

```javascript
function selectBestRaceFromSchedule(races, showOnlyRace12) {
    // ケース1: 12R固定モード（深夜・夜間）
    if (showOnlyRace12) {
        const race12 = races.find(r => r.raceNumber === 12);
        return {
            raceNumber: 12,
            limitTime: race12 ? race12.limitTime : '--:--',
            limitTimestamp: race12 ? race12.limitTimestamp : 0
        };
    }
    
    // ケース2: 通常モード（日中）
    const now = Date.now(); // 現在時刻を毎回取得（重要！）
    
    // 締切未到来のレースをフィルタ
    const upcomingRaces = races.filter(r => r.limitTimestamp > now);
    
    // ケース2-1: 締切未到来のレースがない → 全レース終了
    if (upcomingRaces.length === 0) {
        const race12 = races.find(r => r.raceNumber === 12);
        return {
            raceNumber: 12,
            limitTime: race12 ? race12.limitTime : '--:--',
            limitTimestamp: race12 ? race12.limitTimestamp : 0
        };
    }
    
    // ケース2-2: 締切未到来のレースがある → 最も近いものを選択
    upcomingRaces.sort((a, b) => a.limitTimestamp - b.limitTimestamp);
    const bestRace = upcomingRaces[0];
    
    return {
        raceNumber: bestRace.raceNumber,
        limitTime: bestRace.limitTime,
        limitTimestamp: bestRace.limitTimestamp
    };
}
```

### 具体例

**シナリオ1: 14:30、桐生競艇場**

```javascript
races = [
  { raceNumber: 1, limitTime: "08:47", limitTimestamp: 1739926020000 }, // 終了
  { raceNumber: 2, limitTime: "09:17", limitTimestamp: 1739927820000 }, // 終了
  { raceNumber: 3, limitTime: "10:02", limitTimestamp: 1739930520000 }, // 終了
  { raceNumber: 4, limitTime: "10:35", limitTimestamp: 1739932500000 }, // 終了
  { raceNumber: 5, limitTime: "11:10", limitTimestamp: 1739934600000 }, // 終了
  { raceNumber: 6, limitTime: "11:45", limitTimestamp: 1739936700000 }, // 終了
  { raceNumber: 7, limitTime: "12:25", limitTimestamp: 1739939100000 }, // 終了
  { raceNumber: 8, limitTime: "13:05", limitTimestamp: 1739941500000 }, // 終了
  { raceNumber: 9, limitTime: "13:45", limitTimestamp: 1739943900000 }, // 終了
  { raceNumber: 10, limitTime: "14:27", limitTimestamp: 1739946420000 }, // 終了
  { raceNumber: 11, limitTime: "15:10", limitTimestamp: 1739949000000 }, // 未到来 ← これが選ばれる
  { raceNumber: 12, limitTime: "16:00", limitTimestamp: 1739952000000 }  // 未到来
]

now = 1739946600000 // 14:30
upcomingRaces = [11R, 12R]
bestRace = 11R (15:10)

→ 11Rのオッズを表示、ラベル: "⏰ 15:10"
```

**シナリオ2: 16:30、すべて終了**

```javascript
now = 1739954000000 // 16:30
upcomingRaces = []  // 全レース終了

→ 12Rにフォールバック
→ 12Rのオッズを表示、ラベル: "⏰ 16:00"（過去の時刻）
```

---

## 🕐 タイムスタンプ処理

### 重要な修正（v3.2.1）

**❌ 修正前の問題**:
```javascript
// getDateInfo() でタイムスタンプをキャッシュ
cachedDateInfo = { targetDate, showOnlyRace12, now: Date.now() };

// selectBestRaceFromSchedule() で古いキャッシュを使用
const { now } = getDateInfo(); // ← 古いタイムスタンプ！
const upcomingRaces = races.filter(r => r.limitTimestamp > now);
```

**問題点**:
- 初回取得時のタイムスタンプが固定される
- 例: 14:30に取得 → 14:35になっても14:30のままで比較
- 結果: 締切が過ぎたレースが「未到来」と判定される

**✅ 修正後**:
```javascript
// getDateInfo() ではタイムスタンプをキャッシュしない
cachedDateInfo = { targetDate, showOnlyRace12 }; // nowを削除

// selectBestRaceFromSchedule() で毎回取得
const now = Date.now(); // ← 常に最新！
const upcomingRaces = races.filter(r => r.limitTimestamp > now);
```

### Worker側のタイムスタンプ生成

```javascript
// parseRaceSchedule() in worker-v3.js
function parseRaceSchedule(html, jcd, hd) {
    // hdは "20260219" 形式
    const year = parseInt(hd.substring(0, 4));
    const month = parseInt(hd.substring(4, 6)) - 1; // 0-11
    const day = parseInt(hd.substring(6, 8));
    
    // limitTime は "15:10" 形式
    const [hours, minutes] = limitTime.split(':');
    
    // Date オブジェクトを作成（ローカルタイムゾーン）
    const limitDate = new Date(year, month, day, parseInt(hours), parseInt(minutes));
    
    // Unix タイムスタンプ（ミリ秒）
    const limitTimestamp = limitDate.getTime();
    
    return {
        raceNumber,
        limitTime,
        limitTimestamp // 例: 1739949000000
    };
}
```

---

## 📊 データ表示ロジック

### ソート順

```javascript
venuesWithData.sort((a, b) => {
    // データがない場合は最後尾
    if (!a.data && !b.data) return 0;
    if (!a.data) return 1;
    if (!b.data) return -1;
    
    // limitTimestampで比較（締切が近い順）
    const timeA = a.data.limitTimestamp || Infinity;
    const timeB = b.data.limitTimestamp || Infinity;
    
    return timeA - timeB;
});
```

### カード表示

```javascript
function renderVenueCard(jcd, oddsData) {
    // ケース1: データなし（開催なし）
    if (!oddsData) {
        card.innerHTML = `
            <div class="venue-header">
                <div class="venue-name">${venueName}</div>
            </div>
            <div class="no-race">
                <i class="fas fa-info-circle"></i>
                本日のレース開催はありません
            </div>
        `;
        return;
    }
    
    // ケース2: データあり
    const now = new Date();
    const hours = now.getHours();
    const isResultDisplay = (hours >= 0 && hours < 8) || (hours >= 23);
    
    let limitTimeDisplay = '';
    
    // 結果表示モード（0-7時、23時台）
    if (isResultDisplay && oddsData.limitTimestamp && oddsData.limitTimestamp < Date.now()) {
        if (hours >= 0 && hours < 8) {
            limitTimeDisplay = `<div class="limit-time">🌙 前日データ</div>`;
        } else {
            limitTimeDisplay = `<div class="limit-time">✅ 本日データ</div>`;
        }
    }
    // 通常モード（締切時刻を表示）
    else if (oddsData.limitTime && oddsData.limitTime !== '--:--') {
        limitTimeDisplay = `<div class="limit-time">⏰ ${oddsData.limitTime}</div>`;
    }
    
    card.innerHTML = `
        <div class="venue-header">
            <div class="venue-name">${venueName}</div>
            ${limitTimeDisplay}
            <div class="race-number">${oddsData.raceNumber}R</div>
        </div>
        <div class="odds-table">
            ${oddsRows}
        </div>
    `;
}
```

---

## 🐛 トラブルシューティング

### 問題: 締切が過ぎたレースが表示される

**原因**: タイムスタンプのキャッシュ問題

**確認方法**:
```javascript
// ブラウザのコンソールで実行
console.log('現在時刻:', Date.now());
console.log('キャッシュ:', cachedDateInfo);
```

**解決策**: v3.2.1 で修正済み（`cachedDateInfo` から `now` を削除）

### 問題: すべて12Rが表示される

**原因**: `showOnlyRace12 = true` になっている

**確認方法**:
```javascript
// 現在の時刻を確認
const now = new Date();
console.log('JST時刻:', now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
```

**解決策**: 
- 0-7時 → 正常動作
- 8-22時 → バグの可能性、コード確認
- 23時 → 正常動作

### 問題: 開催なしの場に12Rが表示される

**原因**: Worker のレスポンスが `hasSchedule: false` を返していない

**確認方法**:
```javascript
// APIを直接確認
fetch('https://boatrace.shinta7023.workers.dev/api/race-schedule/04?hd=20260218')
  .then(r => r.json())
  .then(console.log);
```

**解決策**: Worker の `parseRaceSchedule()` で「本日の開催はございません」を正しく検出

---

## 📝 まとめ

### 重要なポイント

1. **時間判定はJST基準**（UTC+9時間オフセット）
2. **タイムスタンプは毎回取得**（キャッシュしない）
3. **レース選択は締切時刻で判定**（現在時刻 vs limitTimestamp）
4. **API呼び出しは48回**（スケジュール24 + オッズ24）
5. **開催なしは明確に判定**（hasSchedule: false → カード最下部）

### データフロー要約

```
時刻判定 → targetDate決定 → スケジュール取得 → レース選択 → オッズ取得 → ソート → 表示
```

---

**バージョン**: v3.2.1  
**完了日時**: 2026-02-19 06:45
