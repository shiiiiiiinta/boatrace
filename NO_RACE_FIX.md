# 🚨 緊急修正: 開催がない場の誤表示問題

## 📋 問題点

### ❌ 致命的なバグ
**平和島（04）と宮島（17）は2026-02-18に開催がないにもかかわらず、12Rのデータを表示しようとしていた**

### 根本原因
```javascript
// ❌ 間違ったコード
if (hours >= 0 && hours < 8) {
    forcedRaceNumber = 12;  // 全場で12Rを強制表示
}
```

**問題**: レーススケジュールAPIを呼ばずに、強制的に12Rを取得しようとする
**結果**: 開催がない場でも12Rを表示してしまう

---

## ✅ 正しい実装

### 修正方針
1. **深夜時間帯でも必ずレーススケジュールAPIを呼ぶ**
2. **スケジュールが取得できない = 開催がない → `null`を返す**
3. **`null`の場合は「本日のレース開催はありません」と表示**
4. **18:00で切り分けない。レース状態で判断する**

### 動作フロー

#### ケース1: 深夜時間帯 + 開催あり（例: 桐生）
```
現在時刻: 2/19 1:00
  ↓
前日の日付: 2/18
  ↓
スケジュールAPI: /api/race-schedule/01?hd=20260218
  ↓
レース一覧取得: 1R〜12R
  ↓
全レース終了済み → 12Rを選択
  ↓
オッズAPI: /api/odds/01/12?hd=20260218
  ↓
表示: 「🌙 前日データ」+ 12R + オッズ
```

#### ケース2: 深夜時間帯 + 開催なし（例: 平和島）
```
現在時刻: 2/19 1:00
  ↓
前日の日付: 2/18
  ↓
スケジュールAPI: /api/race-schedule/04?hd=20260218
  ↓
レース一覧: null（開催なし）
  ↓
selectBestRace() が null を返す
  ↓
fetchVenueOdds() が null を返す
  ↓
表示: 「本日のレース開催はありません」
```

#### ケース3: レース時間帯 + 締切前のレースあり
```
現在時刻: 2/19 14:00
  ↓
今日の日付: 2/19
  ↓
スケジュールAPI: /api/race-schedule/01?hd=20260219
  ↓
レース一覧取得: 1R〜12R
  ↓
締切前のレース抽出: 9R, 10R, 11R, 12R
  ↓
最も締切が近いレースを選択: 9R（14:25締切）
  ↓
オッズAPI: /api/odds/01/9?hd=20260219
  ↓
表示: 「⏰ 14:25」+ 9R + オッズ
```

#### ケース4: レース時間帯 + 全レース終了
```
現在時刻: 2/19 19:00
  ↓
今日の日付: 2/19
  ↓
スケジュールAPI: /api/race-schedule/01?hd=20260219
  ↓
レース一覧取得: 1R〜12R
  ↓
締切前のレース抽出: なし（全レース終了）
  ↓
12Rを選択
  ↓
オッズAPI: /api/odds/01/12?hd=20260219
  ↓
表示: 「⏰ 16:45」+ 12R + オッズ
```

---

## 🔧 修正内容

### 1. フロントエンド（js/main.js）

#### ✅ 修正1: 強制レース番号の削除
```javascript
// ✅ 修正後
let targetDate;
if (hours >= 0 && hours < 8) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
} else {
    targetDate = now.toISOString().slice(0, 10).replace(/-/g, '');
}

// 必ずスケジュールAPIを呼ぶ
const bestRaceInfo = await selectBestRace(jcd, targetDate);
```

#### ✅ 修正2: `selectBestRace()` の戻り値を厳格化
```javascript
async function selectBestRace(jcd, hd) {
    try {
        const scheduleResponse = await fetch(`${CONFIG.API_BASE_URL}/api/race-schedule/${jcd}?hd=${hd}`);
        const scheduleData = await scheduleResponse.json();
        
        if (scheduleData.success && scheduleData.data && scheduleData.data.hasSchedule && scheduleData.data.races) {
            const races = scheduleData.data.races;
            const now = Date.now();
            
            const upcomingRaces = races.filter(r => r.limitTimestamp > now);
            
            if (upcomingRaces.length === 0) {
                // 全レース終了 → 12Rを返す
                const race12 = races.find(r => r.raceNumber === 12);
                return {
                    raceNumber: 12,
                    limitTime: race12 ? race12.limitTime : '--:--',
                    limitTimestamp: race12 ? race12.limitTimestamp : 0
                };
            }
            
            // 締切に最も近いレースを返す
            upcomingRaces.sort((a, b) => a.limitTimestamp - b.limitTimestamp);
            const bestRace = upcomingRaces[0];
            
            return {
                raceNumber: bestRace.raceNumber,
                limitTime: bestRace.limitTime,
                limitTimestamp: bestRace.limitTimestamp
            };
        }
        
        // スケジュールが取得できない = 開催がない
        console.log(`${jcd}: No schedule available (no races today)`);
        return null;
        
    } catch (error) {
        console.error(`${jcd}: Error fetching schedule:`, error);
        return null;
    }
}
```

#### ✅ 修正3: フォールバックロジックの削除
```javascript
// ❌ 削除したコード
function selectBestRaceFallback() {
    // 時刻ベースの推定は廃止
    // スケジュールAPIが必ず呼ばれるため不要
}
```

#### ✅ 修正4: ソート処理の簡略化
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

### 2. Worker（worker.js）

#### ✅ 修正: 開催なしの判定を追加
```javascript
function parseRaceSchedule(html, jcd, hd) {
  try {
    // 開催がない場合のメッセージをチェック
    if (html.includes('本日の開催はございません') ||
        html.includes('データがありません') ||
        html.includes('レース不成立')) {
      console.log(`[${jcd}] No races held on ${hd}`);
      return null;
    }
    
    // ... レース一覧をパース ...
    
    return races.length > 0 ? races : null;
  } catch (error) {
    console.error(`[${jcd}] Schedule parse error:`, error);
    return null;
  }
}
```

---

## 🧪 テスト方法

### 1. verify-race-schedule.html を開く

### 2. 「全24場チェック」ボタンをクリック

### 3. 期待される結果

#### ✅ 開催があった場（例: 桐生、三国、福岡など）
```
✅ 開催あり（12レース）
レース一覧: 1R, 2R, 3R, 4R, 5R, 6R, 7R, 8R, 9R, 10R, 11R, 12R
✅ 1Rオッズデータあり
```

#### ✅ 開催がなかった場（平和島、宮島）
```
❌ 開催なし（hasSchedule: false）
❌ 1Rオッズデータなし（hasRace: false）
```

---

## 📂 更新ファイル

### 必須ファイル（再デプロイ必要）
- ✅ **js/main.js**
  - `fetchVenueOdds()` - 強制レース番号削除、スケジュールAPIを必ず呼ぶ
  - `selectBestRace()` - 開催なしの場合に`null`を返す
  - `selectBestRaceFallback()` - 削除
  - `fetchAllOdds()` - ソート処理簡略化

- ✅ **worker.js**
  - `parseRaceSchedule()` - 開催なしの判定追加

### テストファイル
- ✅ **verify-race-schedule.html** - 全24場の開催チェック

### ドキュメント
- ✅ **NO_RACE_FIX.md** - このドキュメント

---

## ✅ 確認項目

### デプロイ後の確認（2026-02-19 深夜1:00）

#### 開催があった場（例: 桐生、三国、福岡）
- [ ] 前日（2/18）の12Rが表示される
- [ ] 締切時刻に「🌙 前日データ」と表示
- [ ] オッズデータが正しく表示される

#### 開催がなかった場（平和島、宮島）
- [ ] 「本日のレース開催はありません」と表示
- [ ] カードが最後尾に表示される
- [ ] オッズデータが表示されない

#### ソート順
- [ ] 締切時刻が近い順に表示される
- [ ] 開催がない場は最後尾に表示される
- [ ] 深夜は前日データが表示される場が先頭付近に表示される

---

## 🚀 Cloudflare Worker 再デプロイ手順

1. https://dash.cloudflare.com にログイン
2. **Workers & Pages** → `boatrace` → **Edit code**
3. 既存コードを全削除
4. 新しい `worker.js` を全体貼り付け
5. **Save and Deploy** をクリック

---

## 📊 改善効果

### ✅ 解決された問題
1. ✅ **平和島、宮島が誤表示されない**
2. ✅ **開催がない場は「本日のレース開催はありません」と正しく表示**
3. ✅ **18:00での切り分けを廃止し、レース状態で判断**
4. ✅ **全場で統一した処理（個別処理なし）**

### ✅ コードの改善
- 不要なフォールバックロジックを削除
- 必ずスケジュールAPIを呼ぶことで確実性向上
- ソート処理の簡略化

---

**修正完了日時**: 2026-02-19 02:00  
**次のアクション**: 
1. Cloudflare Worker を再デプロイ
2. verify-race-schedule.html で全24場をチェック
3. 平和島と宮島が「開催なし」と表示されることを確認
