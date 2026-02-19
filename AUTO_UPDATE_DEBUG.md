# 自動更新が動かない問題の診断ガイド

**問題**: Cloudflareログで5分おき更新が走っていない  
**作成日**: 2026-02-19 07:30

---

## 🔍 確認手順

### 1. ブラウザコンソールでの確認

ブラウザで `index.html` を開き、開発者ツール（F12）のコンソールで以下を実行：

```javascript
// 現在時刻の確認
const now = new Date();
console.log('ブラウザのローカル時刻:', now.toLocaleString('ja-JP'));
console.log('getHours()の値:', now.getHours());
console.log('JST時刻:', now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));

// 自動更新の状態を確認
console.log('updateTimer:', updateTimer);
console.log('nextUpdateTime:', nextUpdateTime);
console.log('countdownInterval:', countdownInterval);

// タイマーが設定されているか確認
if (updateTimer) {
    console.log('✅ 自動更新タイマーは動作中');
} else {
    console.log('❌ 自動更新タイマーが停止している');
}
```

### 2. 期待される出力（8:00-18:00の間）

```
ブラウザのローカル時刻: 2026/2/19 14:30:00
getHours()の値: 14
JST時刻: 2026/2/19 14:30:00
updateTimer: 123 (数値)
nextUpdateTime: Wed Feb 19 2026 14:35:00 GMT+0900 (日本標準時)
countdownInterval: 124 (数値)
✅ 自動更新タイマーは動作中
```

### 3. カウントダウン表示の確認

画面右上の「次回更新」の表示を確認：
- ✅ **正常**: 「4分59秒後」→「4分58秒後」と減っていく
- ❌ **異常**: 「自動更新停止中（手動更新のみ）」と表示される

---

## 🐛 問題の原因

### 原因1: タイムゾーンの問題 ⚠️ **最も可能性が高い**

**問題箇所**:
```javascript
// js/main.js 64行目
const now = new Date();
const jstHours = now.getHours(); // ← これはブラウザのローカルタイムゾーン
```

**問題点**:
- `getHours()` はブラウザのローカルタイムゾーンを返す
- ユーザーのPCが日本以外のタイムゾーンだと誤動作
- 例: UTCタイムゾーンで14:00 JST → `getHours()` は 5 を返す → 自動更新停止

**確認方法**:
```javascript
console.log('システムのタイムゾーン:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('getHours():', new Date().getHours());
console.log('JST getHours():', new Date().toLocaleString('ja-JP', { 
    timeZone: 'Asia/Tokyo', 
    hour: 'numeric', 
    hour12: false 
}));
```

---

## ✅ 修正方法

### 修正1: JST時刻を正しく取得

**js/main.js の `startAutoUpdate()` 関数を修正:**

```javascript
// 自動更新タイマー開始
function startAutoUpdate() {
    // 既存のタイマーをクリア
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    // ✅ JST時刻を正しく取得（修正版）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000; // 9時間
    const jstTime = new Date(now.getTime() + jstOffset);
    const jstHours = jstTime.getUTCHours(); // UTCHours を使う
    
    console.log(`🕐 現在のJST時刻: ${jstHours}時`); // デバッグログ
    
    // 8:00-18:00の間は5分おき、それ以外は自動更新停止
    const isRacingHours = jstHours >= 8 && jstHours < 18;
    
    console.log(`⏰ レース時間帯: ${isRacingHours ? 'YES' : 'NO'}`); // デバッグログ
    
    if (isRacingHours) {
        // レース時間帯：5分おきに自動更新
        const updateInterval = 5 * 60 * 1000; // 5分
        nextUpdateTime = new Date(Date.now() + updateInterval);
        
        console.log('✅ 自動更新を開始しました（5分おき）'); // デバッグログ
        
        // カウントダウン表示更新
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);

        // 5分ごとにデータ更新
        updateTimer = setInterval(() => {
            // ✅ ここでもJST時刻を使う
            const checkNow = new Date();
            const checkJstTime = new Date(checkNow.getTime() + jstOffset);
            const currentHour = checkJstTime.getUTCHours();
            
            console.log(`🔄 自動更新実行 (JST ${currentHour}時)`); // デバッグログ
            
            if (currentHour >= 8 && currentHour < 18) {
                fetchAllOdds();
                nextUpdateTime = new Date(Date.now() + updateInterval);
            } else {
                console.log('⏹️ レース時間外のため自動更新を停止'); // デバッグログ
                stopAutoUpdate();
            }
        }, updateInterval);
        
    } else {
        // レース時間外：自動更新停止
        console.log('⏹️ レース時間外のため自動更新は停止中'); // デバッグログ
        nextUpdateTime = null;
        document.getElementById('nextUpdate').textContent = '自動更新停止中（手動更新のみ）';
    }
}
```

---

## 🧪 デバッグ用テストコード

ブラウザコンソールで以下を実行して動作確認：

```javascript
// テスト1: 現在のJST時刻を確認
function getJSTHours() {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstTime = new Date(now.getTime() + jstOffset);
    return jstTime.getUTCHours();
}

console.log('現在のJST時刻:', getJSTHours() + '時');

// テスト2: 自動更新が有効か確認
const jstHours = getJSTHours();
const isRacingHours = jstHours >= 8 && jstHours < 18;
console.log('レース時間帯:', isRacingHours ? 'YES (自動更新有効)' : 'NO (自動更新停止)');

// テスト3: タイマーの状態を確認
console.log('updateTimer:', typeof updateTimer === 'number' ? '動作中' : '停止中');
console.log('countdownInterval:', typeof countdownInterval === 'number' ? '動作中' : '停止中');

// テスト4: 次回更新時刻を確認
if (nextUpdateTime) {
    const diff = nextUpdateTime - Date.now();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    console.log(`次回更新まで: ${minutes}分${seconds}秒`);
} else {
    console.log('次回更新時刻: 未設定（自動更新停止中）');
}
```

---

## 📊 Cloudflareログでの確認

### ログの見方

1. **Cloudflare Dashboard** にアクセス
2. **Workers & Pages** → `boatrace`
3. **Logs** タブを開く

### 期待されるログパターン（5分おき更新が動いている場合）

```
14:00:00 - GET /api/race-schedule/01?hd=20260219 - 200 OK
14:00:01 - GET /api/race-schedule/02?hd=20260219 - 200 OK
14:00:01 - GET /api/race-schedule/03?hd=20260219 - 200 OK
... (24回)
14:00:05 - GET /api/odds/01/5?hd=20260219 - 200 OK
14:00:05 - GET /api/odds/02/6?hd=20260219 - 200 OK
... (24回)

--- 5分後 ---

14:05:00 - GET /api/race-schedule/01?hd=20260219 - 200 OK
14:05:01 - GET /api/race-schedule/02?hd=20260219 - 200 OK
... (繰り返し)
```

### ログが出ない場合のチェックポイント

1. **初回読み込みのログはあるか？**
   - ✅ ある → タイマーが動いていない
   - ❌ ない → ページ自体が開かれていない

2. **手動更新（ボタンクリック）のログは出るか？**
   - ✅ 出る → Worker正常、タイマー問題
   - ❌ 出ない → Worker・ネットワーク問題

3. **ログのタイムスタンプは5分間隔か？**
   - ✅ はい → 正常動作
   - ❌ いいえ → タイマー問題

---

## 🔧 その他の原因

### 原因2: ブラウザがスリープ状態

**問題**:
- ブラウザのタブが非アクティブになると `setInterval` が遅延する
- ブラウザによっては1分に1回しか実行されない

**確認方法**:
```javascript
let lastExecutionTime = Date.now();

setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastExecutionTime) / 1000;
    console.log(`実際の経過時間: ${elapsed}秒`);
    lastExecutionTime = now;
}, 5000); // 5秒ごとに実行
```

**対策**:
- タブをアクティブに保つ
- または `requestAnimationFrame` を併用

### 原因3: ページが開かれていない

**問題**:
- ユーザーがページを閉じている
- ブラウザが再起動された

**確認方法**:
```javascript
// ページの可視性を監視
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('⏸️ ページが非アクティブになりました');
    } else {
        console.log('▶️ ページがアクティブになりました');
        // 必要なら手動で更新を実行
        fetchAllOdds();
    }
});
```

### 原因4: エラーで処理が止まっている

**確認方法**:
```javascript
// ブラウザコンソールで確認
console.log('エラーをチェック');
// コンソールに赤いエラーメッセージが出ていないか確認
```

**デバッグログ追加**:
```javascript
async function fetchAllOdds() {
    console.log('📡 fetchAllOdds() 開始');
    
    try {
        // ... 既存コード ...
        console.log('✅ fetchAllOdds() 完了');
    } catch (error) {
        console.error('❌ fetchAllOdds() エラー:', error);
        throw error;
    }
}
```

---

## 📝 診断チェックリスト

```
□ 1. ブラウザで index.html が開かれている
□ 2. 現在の時刻が 8:00-18:00（JST）の間である
□ 3. 「次回更新」にカウントダウンが表示されている
□ 4. updateTimer が null でない（コンソールで確認）
□ 5. エラーメッセージが出ていない
□ 6. 初回読み込み時のログがCloudflareに出ている
□ 7. ブラウザのタブがアクティブである
□ 8. システムのタイムゾーンが正しい
```

---

## 🚀 推奨対応

### ステップ1: 修正コードを適用

上記の「修正1: JST時刻を正しく取得」を `js/main.js` に適用

### ステップ2: ブラウザで確認

```
1. Ctrl+Shift+R で強制リロード
2. コンソールにデバッグログが出ることを確認
3. 「次回更新」のカウントダウンを確認
```

### ステップ3: 5分待つ

```
1. 5分後に自動更新が実行されるか確認
2. コンソールに「🔄 自動更新実行」ログが出るか確認
3. Cloudflareログに新しいリクエストが出るか確認
```

---

## 📂 修正ファイル

- `js/main.js` - `startAutoUpdate()` 関数を修正

---

**診断完了日時**: 2026-02-19 07:30  
**ステータス**: 診断ガイド作成完了
