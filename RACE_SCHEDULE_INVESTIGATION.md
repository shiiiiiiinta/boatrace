# 🔍 締切時刻取得の実装調査

## 📋 調査目的

各競艇場の各レースの締切時刻をBOATRACE公式サイトから取得し、「締切前かつ締切に最も近いレース」を表示する。

---

## 🎯 実装方針

### ステップ1: 締切時刻データの取得元を特定

以下のBOATRACE公式ページから締切時刻を取得できる可能性があります：

#### 候補1: レース一覧ページ（racelist）
```
https://www.boatrace.jp/owpc/pc/race/racelist?jcd=10&hd=20260218
```
- **特徴**: 1日の全レース（1R〜12R）が一覧表示される
- **期待されるデータ**: 各レースの締切時刻（例: 10:45, 11:15, ...）

#### 候補2: レース前情報ページ（beforeinfo）
```
https://www.boatrace.jp/owpc/pc/race/beforeinfo?jcd=10&rno=1&hd=20260218
```
- **特徴**: 個別レースの詳細情報
- **期待されるデータ**: そのレースの締切時刻

#### 候補3: 出走表ページ（raceindex）
```
https://www.boatrace.jp/owpc/pc/race/raceindex?jcd=10&hd=20260218
```
- **特徴**: その日のレーススケジュール全体
- **期待されるデータ**: 全レースの発走時刻・締切時刻

---

## 📝 調査手順

### 手動調査（必須）

以下のURLをブラウザで開いて、HTMLソースを確認してください：

```
https://www.boatrace.jp/owpc/pc/race/racelist?jcd=10&hd=20260218
```

#### 確認ポイント

1. **締切時刻の表示**
   - ページ内に「締切」「発売締切」などのテキストがあるか
   - 時刻が「10:45」のような形式で表示されているか

2. **HTMLの構造**
   - `<td>`, `<span>`, `<div>` などのタグで囲まれているか
   - `class` や `id` 属性があるか（例: `class="time"`, `class="limit"`）

3. **データ形式**
   - HTML内に埋め込まれているか
   - JavaScript変数として定義されているか
   - JSON形式で別途読み込まれているか

#### HTMLサンプルの例（予想）

```html
<!-- パターン1: テーブル形式 -->
<table>
  <tr>
    <td>1R</td>
    <td class="limit-time">10:45</td>
  </tr>
  <tr>
    <td>2R</td>
    <td class="limit-time">11:15</td>
  </tr>
</table>

<!-- パターン2: JavaScript変数 -->
<script>
  var raceTimes = [
    { race: 1, limit: "10:45" },
    { race: 2, limit: "11:15" }
  ];
</script>

<!-- パターン3: data属性 -->
<div data-race="1" data-limit="10:45">1R</div>
<div data-race="2" data-limit="11:15">2R</div>
```

---

## 🛠️ 実装案

### 案1: Worker で締切時刻を取得

#### Worker に新しいエンドポイントを追加

```javascript
// GET /api/race-schedule/:jcd?hd=YYYYMMDD
// 指定された競艇場の全レースの締切時刻を返す

if (url.pathname.startsWith('/api/race-schedule/')) {
  const jcd = url.pathname.split('/')[3];
  const hd = url.searchParams.get('hd') || getTodayDate();
  
  // BOATRACE公式サイトから取得
  const racelistUrl = `https://www.boatrace.jp/owpc/pc/race/racelist?jcd=${jcd}&hd=${hd}`;
  const response = await fetch(racelistUrl);
  const html = await response.text();
  
  // HTMLから締切時刻をパース
  const schedule = parseRaceSchedule(html, jcd);
  
  return successResponse({
    jcd: jcd,
    date: hd,
    races: schedule
  });
}
```

#### パース関数

```javascript
function parseRaceSchedule(html, jcd) {
  const races = [];
  
  // 正規表現で締切時刻を抽出
  // 例: <td class="time">10:45</td> のようなパターン
  const timePattern = /<td[^>]*class="[^"]*time[^"]*"[^>]*>(\d{1,2}:\d{2})<\/td>/gi;
  
  let match;
  let raceNumber = 1;
  
  while ((match = timePattern.exec(html)) !== null && raceNumber <= 12) {
    races.push({
      raceNumber: raceNumber,
      limitTime: match[1], // "10:45"
      limitTimestamp: parseTimeToTimestamp(match[1])
    });
    raceNumber++;
  }
  
  return races;
}

function parseTimeToTimestamp(timeStr) {
  // "10:45" → 今日の10:45のタイムスタンプに変換
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  return limit.getTime();
}
```

### フロントエンドの実装

```javascript
async function selectBestRace(jcd) {
  // 締切時刻データを取得
  const scheduleResponse = await fetch(`${CONFIG.API_BASE_URL}/api/race-schedule/${jcd}?hd=${hd}`);
  const scheduleData = await scheduleResponse.json();
  
  if (!scheduleData.success || !scheduleData.data.races) {
    // 締切時刻が取得できない場合は従来のロジック
    return estimateRaceNumber();
  }
  
  const races = scheduleData.data.races;
  const now = Date.now();
  
  // 締切前のレースを抽出
  const upcomingRaces = races.filter(r => r.limitTimestamp > now);
  
  if (upcomingRaces.length === 0) {
    // 全レース終了 → 12Rを返す
    return 12;
  }
  
  // 締切に最も近いレースを選択
  upcomingRaces.sort((a, b) => a.limitTimestamp - b.limitTimestamp);
  return upcomingRaces[0].raceNumber;
}
```

---

## ✅ 次のステップ

### 1. 手動調査（あなたにお願い）

以下のURLをブラウザで開いてください：
```
https://www.boatrace.jp/owpc/pc/race/racelist?jcd=10&hd=20260218
```

そして、以下を確認して報告してください：

1. **締切時刻が表示されていますか？**
   - YES / NO

2. **表示されている場合、どのような形式ですか？**
   - 例: 「締切 10:45」「発売締切: 10:45」など

3. **HTMLソースを確認**
   - 右クリック → 「ページのソースを表示」
   - 締切時刻の部分のHTMLを教えてください（コピペ）

### 2. 実装（私が実施）

あなたからの情報を元に、以下を実装します：

1. Worker に `/api/race-schedule/:jcd` エンドポイントを追加
2. HTMLパース処理を実装
3. フロントエンドのレース選択ロジックを修正

---

## 📝 代替案

もし公式サイトから締切時刻を取得できない場合：

### 代替案A: 標準的な時刻を使用

```javascript
// 標準的なレーススケジュール（多くの競艇場で共通）
const STANDARD_SCHEDULE = [
  { race: 1, limit: "10:30" },
  { race: 2, limit: "11:00" },
  { race: 3, limit: "11:30" },
  { race: 4, limit: "12:00" },
  { race: 5, limit: "12:30" },
  { race: 6, limit: "13:00" },
  { race: 7, limit: "13:30" },
  { race: 8, limit: "14:00" },
  { race: 9, limit: "14:30" },
  { race: 10, limit: "15:00" },
  { race: 11, limit: "15:30" },
  { race: 12, limit: "16:00" }
];
```

### 代替案B: 推定ロジックの改善

現在時刻から「このレースが締切直前」を精度高く推定する。

---

**まず、手動調査をお願いします！**

上記URLを開いて、締切時刻の表示とHTMLの構造を教えてください。
