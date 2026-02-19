# 深夜時間帯のデータ表示修正

## 問題点

現在時刻: **2026年2月19日 1:00 AM**

### 発生していた問題
1. **福岡**: 16:32の4Rで更新が止まっている
2. **児島、桐生、若松**: 12Rではなく途中のレースで止まっている
3. **三国**: データが取れていない
4. **日付の扱い**: 深夜時間帯（0:00〜7:59）に当日（2/19）のデータをリクエストし、前日（2/18）のデータが取得できていない

### 根本原因

#### 1. 日付の問題
- **0:00〜7:59の間**: フロントエンドが「今日の日付（2/19）」でAPIリクエストを送信
- **結果**: 2/19のレースはまだ開催されておらず、データが取得できない
- **期待動作**: 前日（2/18）の12Rのデータを表示すべき

#### 2. タイムスタンプの問題
- Worker側の`parseRaceSchedule`関数が「今日の日付」で締切時刻を計算
- 深夜に前日のデータをリクエストした場合、締切時刻が「今日の日付 + 締切時刻」となり、未来のタイムスタンプになる
- **結果**: 「締切前のレース」として判定され、12Rではなく1Rが選択されてしまう

#### 3. フォールバックロジックの問題
- スケジュール取得失敗時、現在時刻（1:00）から`estimatedRace = 1`を返す
- 1Rのデータがない場合、`null`が返され、画面に何も表示されない

## 解決策

### 1. フロントエンド（js/main.js）の修正

#### ✅ 深夜時間帯の日付処理
```javascript
// 日付とレース番号の決定（深夜0:00-7:59は前日の12Rを表示）
const now = new Date();
const hours = now.getHours();

let targetDate, forcedRaceNumber;
if (hours >= 0 && hours < 8) {
    // 深夜〜早朝は前日の12Rを強制表示
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
    forcedRaceNumber = 12;
    console.log(`${jcd}: Early morning (${hours}:00), showing yesterday's 12R (date: ${targetDate})`);
} else {
    // レース時間帯は今日の日付でレーススケジュールから選択
    targetDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    forcedRaceNumber = null;
}
```

#### ✅ ソート処理の改善
```javascript
// 締切時刻でソート（締切が近い順）
venuesWithData.sort((a, b) => {
    // データがない場合は最後尾
    if (!a.data && !b.data) return 0;
    if (!a.data) return 1;
    if (!b.data) return -1;
    
    // limitTimestampがない場合（深夜の前日12R表示）は-Infinityとして扱い、先頭にする
    const timeA = a.data.limitTimestamp === 0 ? -Infinity : (a.data.limitTimestamp || Infinity);
    const timeB = b.data.limitTimestamp === 0 ? -Infinity : (b.data.limitTimestamp || Infinity);
    
    // 両方とも0の場合は場コード順
    if (timeA === -Infinity && timeB === -Infinity) {
        return a.jcd.localeCompare(b.jcd);
    }
    
    return timeA - timeB;
});
```

#### ✅ 締切時刻の表示改善
```javascript
// 締切時刻の表示（深夜時間帯は「前日データ」と表示）
const now = new Date();
const hours = now.getHours();
const isEarlyMorning = hours >= 0 && hours < 8;

let limitTimeDisplay = '';
if (isEarlyMorning && (!oddsData.limitTime || oddsData.limitTime === '--:--')) {
    limitTimeDisplay = `<div class="limit-time" style="color: #888;">🌙 前日データ</div>`;
} else if (oddsData.limitTime && oddsData.limitTime !== '--:--') {
    limitTimeDisplay = `<div class="limit-time">⏰ ${oddsData.limitTime}</div>`;
}
```

#### ✅ フォールバックロジックの改善
```javascript
function selectBestRaceFallback() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    let estimatedRace = 1;
    
    // 簡易的な時刻からレース番号の推定
    if (hours >= 0 && hours < 8) {
        // 深夜〜早朝: 前日の12Rを表示（これは上位関数で処理済み）
        estimatedRace = 12;
    } else if (hours >= 8 && hours < 10) {
        estimatedRace = 1; // 開始前
    } else if (hours >= 10 && hours < 12) {
        estimatedRace = Math.floor((hours - 10) * 4 + minutes / 15) + 1;
    } else if (hours >= 12 && hours < 15) {
        estimatedRace = Math.floor((hours - 12) * 4 + minutes / 15) + 6;
    } else if (hours >= 15) {
        estimatedRace = 12; // 終了間近または終了
    }
    
    estimatedRace = Math.max(1, Math.min(12, estimatedRace));
    
    console.log(`Fallback: hour ${hours}:${minutes} → estimated race ${estimatedRace}R`);
    
    return estimatedRace;
}
```

### 2. Worker（worker.js）の修正

#### ✅ レーススケジュールのタイムスタンプ計算を修正
```javascript
function parseRaceSchedule(html, jcd, hd) {
  try {
    console.log(`[${jcd}] Parsing race schedule for date ${hd}, HTML length: ${html.length}`);
    
    const races = [];
    
    // パターン: <td class="is-fs14 is-fBold"><a href="...">1R</a></td><td>08:47</td>
    // レース番号と締切時刻を抽出
    const racePattern = /<td[^>]*class="[^"]*is-fs14[^"]*"[^>]*><a[^>]*>(\d+)R<\/a>\s*<\/td>\s*<td>(\d{2}:\d{2})<\/td>/gi;
    
    // リクエストされた日付（hd: YYYYMMDD）からDateオブジェクトを作成
    const year = parseInt(hd.substring(0, 4));
    const month = parseInt(hd.substring(4, 6)) - 1; // 月は0から始まる
    const day = parseInt(hd.substring(6, 8));
    
    let match;
    while ((match = racePattern.exec(html)) !== null) {
      const raceNumber = parseInt(match[1]);
      const limitTime = match[2]; // "08:47"
      
      // リクエストされた日付で締切時刻のタイムスタンプを作成
      const [hours, minutes] = limitTime.split(':').map(Number);
      const limitDate = new Date(year, month, day, hours, minutes, 0);
      
      races.push({
        raceNumber: raceNumber,
        limitTime: limitTime,
        limitTimestamp: limitDate.getTime()
      });
    }
    
    console.log(`[${jcd}] Found ${races.length} races with limit times`);
    
    if (races.length > 0) {
      console.log(`[${jcd}] Schedule:`, JSON.stringify(races.slice(0, 3))); // 最初の3レースをログ
    }
    
    return races.length > 0 ? races : null;
    
  } catch (error) {
    console.error(`[${jcd}] Schedule parse error:`, error);
    return null;
  }
}
```

#### ✅ 関数呼び出しの修正
```javascript
const html = await response.text();
const schedule = parseRaceSchedule(html, jcd, hd);
```

## 動作フロー（修正後）

### ケース1: 深夜時間帯（0:00〜7:59）
1. **フロントエンド**: 現在時刻が0:00〜7:59を検知
2. **日付決定**: 前日の日付（20260218）を計算
3. **レース番号決定**: 強制的に12Rを選択
4. **APIリクエスト**: `/api/odds/01/12?hd=20260218`（前日の12R）
5. **Worker**: 前日のデータを取得してレスポンス
6. **フロントエンド**: 「🌙 前日データ」ラベル付きで表示

### ケース2: レース時間帯（8:00〜17:59）
1. **フロントエンド**: 今日の日付（20260219）でスケジュール取得
2. **Worker**: `/api/race-schedule/01?hd=20260219`からレース一覧と締切時刻を取得
3. **フロントエンド**: 締切前かつ最も近いレースを選択（例: 9R）
4. **APIリクエスト**: `/api/odds/01/9?hd=20260219`
5. **Worker**: 9Rのオッズデータを返す
6. **フロントエンド**: 「⏰ 14:25」（締切時刻）付きで表示

### ケース3: 全レース終了後（18:00〜23:59）
1. **フロントエンド**: 今日の日付（20260219）でスケジュール取得
2. **Worker**: レース一覧を返す（全レース終了）
3. **フロントエンド**: `upcomingRaces.length === 0` のため12Rを選択
4. **APIリクエスト**: `/api/odds/01/12?hd=20260219`
5. **Worker**: 12Rのオッズデータを返す（レース終了後でもデータ取得可能）
6. **フロントエンド**: 「⏰ 16:45」（12Rの締切時刻）付きで表示

## 検証項目

### ✅ 修正により解決される問題
1. ✅ **福岡**: 深夜1:00に前日（2/18）の12Rデータが正しく表示される
2. ✅ **児島、桐生、若松**: 同様に前日の12Rが表示される
3. ✅ **三国**: 前日のデータが正しく取得される
4. ✅ **日付の扱い**: 0:00〜7:59は前日のデータを取得

### 🔍 テスト方法

#### 1. 深夜時間帯のテスト（現在: 2/19 1:00）
```bash
# ブラウザのコンソールで確認
console.log(new Date().getHours()); // 0〜7の間か確認
```
- **期待結果**: 全24場が前日（2/18）の12Rを表示
- **締切時刻**: 「🌙 前日データ」と表示

#### 2. レース時間帯のテスト（8:00〜18:00）
```bash
# システム時刻を変更してテスト、またはコードを一時的に修正
```
- **期待結果**: 締切前かつ最も近いレースを表示
- **締切時刻**: 「⏰ HH:MM」形式で表示

#### 3. 全レース終了後のテスト（18:00〜23:59）
- **期待結果**: 今日の12Rを表示
- **締切時刻**: 「⏰ HH:MM」形式で表示

## Cloudflare Workerの再デプロイ手順

1. https://dash.cloudflare.com にログイン
2. **Workers & Pages** → プロジェクト `boatrace` を選択
3. **Edit code** をクリック
4. 既存コードを全削除
5. 新しい `worker.js` の内容を貼り付け
6. **Save and Deploy** をクリック

## デプロイ後の確認

### ブラウザのコンソールでログ確認
```javascript
// 期待されるログ
"01: Early morning (1:00), showing yesterday's 12R (date: 20260218)"
"01: Selected race 12R (limit: --:--, date: 20260218)"
"[01] Fetching: https://www.boatrace.jp/owpc/pc/race/oddstf?jcd=01&rno=12&hd=20260218"
"01: Found race 12R with 6 boats"
```

### 画面表示の確認
- **桐生、戸田、江戸川...（全24場）**: 各場の12Rが表示される
- **締切時刻**: 「🌙 前日データ」または「⏰ HH:MM」
- **レース番号**: 12R
- **オッズ**: 前日の12Rの実際のオッズデータ

## 更新ファイル
- ✅ `js/main.js` - 日付処理、ソート処理、表示ロジックの改善
- ✅ `worker.js` - レーススケジュールのタイムスタンプ計算修正
- ✅ `EARLY_MORNING_FIX.md` - このドキュメント
- ✅ `README.md` - 機能説明の更新（必要に応じて）

---

**修正日**: 2026-02-19  
**対応時間**: 深夜1:00  
**修正者**: AI Assistant
