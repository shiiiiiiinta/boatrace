# 更新内容 v1.4.0 - 自動更新間隔変更 & オッズレンジ表示対応

## 📝 変更サマリー

**更新日**: 2026年2月18日  
**バージョン**: v1.3.0 → v1.4.0

### 主な変更点
1. ✅ **自動更新間隔を5分から1時間に変更** - サーバー負荷軽減
2. ✅ **オッズ表示をレンジ形式に対応** - 実際のオッズ形式（例: 1.2〜2.3）に合わせた表示

---

## 📋 詳細な変更内容

### 1. 自動更新間隔の変更

#### 変更前
- 5分ごとに自動更新
- カウントダウン: 「X分Y秒後」

#### 変更後
- **1時間ごと**に自動更新
- カウントダウン: 「X時間Y分Z秒後」（1時間未満の場合は「Y分Z秒後」）

#### 影響するファイル
- `js/main.js`
  - `startAutoUpdate()` 関数: 更新間隔を60分に変更
  - `updateCountdown()` 関数: 時間表示を追加
- `index.html`
  - フッターの説明文を「1時間ごと」に変更

#### コード変更例
```javascript
// 変更前: 5分 (5 * 60 * 1000)
nextUpdateTime = new Date(Date.now() + 5 * 60 * 1000);

// 変更後: 1時間 (60 * 60 * 1000)
nextUpdateTime = new Date(Date.now() + 60 * 60 * 1000);
```

---

### 2. オッズ表示のレンジ対応

#### 変更前
- 単一値のオッズ表示（例: `1.5`）
- データ構造: `{ boatNumber: 1, odds: 1.5 }`

#### 変更後
- **レンジ形式のオッズ表示**（例: `1.2〜2.3`）
- データ構造: `{ boatNumber: 1, oddsMin: 1.2, oddsMax: 2.3 }`
- 単一値のオッズも後方互換性を保持

#### 影響するファイル

**フロントエンド:**
- `js/main.js`
  - `generateOddsRows()` 関数: レンジ形式と単一値の両方に対応
  - モックデータ: レンジ形式で生成

**CSS:**
- `css/style.css`
  - `.odds-value`: レンジ表示用にスタイル調整
  - `white-space: nowrap` で改行を防止
  - `min-width: 100px` でレイアウト崩れを防止

**バックエンド (Cloudflare Worker):**
- `worker.js`
  - `parseOddsHtml()` 関数: レンジ形式のオッズを優先的に抽出
  - 正規表現パターン追加: `/([\d.]+)\s*[-〜～]\s*([\d.]+)/g`
  - `generateMockOdds()` 関数: レンジ形式のモックデータ生成

#### データ構造の例

**レンジ形式（新）:**
```javascript
{
  boatNumber: 1,
  oddsMin: 1.2,
  oddsMax: 2.3,
  voteTickets: 12450,
  voteAmount: 18675000
}
```

**単一値（旧・後方互換）:**
```javascript
{
  boatNumber: 1,
  odds: 1.5,
  voteTickets: 12450,
  voteAmount: 18675000
}
```

#### UI表示ロジック

```javascript
// レンジまたは単一値を判定して表示
if (item.oddsMin !== undefined && item.oddsMax !== undefined) {
    oddsDisplay = `${item.oddsMin.toFixed(1)}〜${item.oddsMax.toFixed(1)}`;
    avgOdds = (item.oddsMin + item.oddsMax) / 2;
} else if (item.odds !== undefined) {
    oddsDisplay = item.odds.toFixed(1);
    avgOdds = item.odds;
}
```

---

## 🔄 後方互換性

### 既存データへの影響
- ✅ 単一値のオッズデータも引き続き表示可能
- ✅ APIレスポンスの形式が変わってもフォールバック機能で対応
- ✅ モックデータはレンジ形式で生成

---

## 📊 パフォーマンスへの影響

### サーバー負荷
- **変更前**: 24場 × 12リクエスト/時間 = 288リクエスト/時間
- **変更後**: 24場 × 1リクエスト/時間 = 24リクエスト/時間
- **削減率**: 約92%削減 ✅

### ユーザー体験
- オッズ更新頻度は減少するが、競艇のオッズ変動は緩やか
- 手動更新ボタンでいつでも最新情報を取得可能
- より正確なオッズ表示（レンジ形式）

---

## 🧪 テスト確認事項

### 動作確認済み
- ✅ 1時間自動更新タイマーの動作
- ✅ カウントダウン表示（時:分:秒）
- ✅ レンジ形式オッズの表示
- ✅ 単一値オッズの表示（後方互換）
- ✅ モックデータのレンジ生成
- ✅ UI レイアウトの崩れなし

### 要確認事項
- ⏳ 実際のBOATRACE公式サイトからのレンジ抽出（Worker再デプロイ後）
- ⏳ 投票数・投票金額の正確性（公式HTML構造による）

---

## 🔧 Workerの再デプロイが必要

レンジ形式のオッズ抽出機能を有効にするため、Cloudflare Workerの再デプロイが必要です。

### 手順
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** → `boatrace` を選択
3. **Edit code** をクリック
4. `WORKER_CODE_FOR_DASHBOARD.md` の全コードをコピー
5. エディタに貼り付け
6. **Save and Deploy** をクリック

### 確認方法
```bash
# ヘルスチェック
curl https://boatrace.shinta7023.workers.dev/api/health

# 桐生1Rのオッズ取得
curl https://boatrace.shinta7023.workers.dev/api/odds/01/1
```

レスポンス例:
```json
{
  "success": true,
  "data": {
    "jcd": "01",
    "raceNumber": 1,
    "hasRace": true,
    "odds": [
      {
        "boatNumber": 1,
        "oddsMin": 1.2,
        "oddsMax": 2.3,
        "voteTickets": 12450,
        "voteAmount": 18675000
      }
    ]
  }
}
```

---

## 📚 更新されたドキュメント

- `README.md` - 機能説明を更新
- `UPDATE_v1.4.0.md` - このファイル
- `worker.js` - レンジ抽出ロジック追加
- `js/main.js` - レンジ表示ロジック追加
- `css/style.css` - オッズ表示スタイル調整

---

## 🐛 既知の問題

### Issue 1: モックデータが返される
**状態**: 既知  
**原因**: Worker のHTML パース処理が実際の構造と合っていない可能性  
**解決策**: Worker ログで HTML を確認し、パース処理を調整  
**優先度**: 高

### Issue 2: 一部の場でデータ取得失敗
**状態**: 想定内  
**原因**: レース未開催または終了済み  
**解決策**: 正常な動作（開催していない場は「本日のレース開催はありません」と表示）  
**優先度**: なし

---

## 🎯 次のステップ

### 優先度: 高
1. Cloudflare Worker の再デプロイ
2. Worker ログでレンジ抽出の動作確認
3. レース開催時間（10:00〜16:00）に実データテスト

### 優先度: 中
4. オッズレンジ幅の統計分析
5. 投票データの正確性検証

### 優先度: 低
6. UI/UXの微調整
7. エラーハンドリングの強化

---

## ✅ チェックリスト

### 実装完了
- [x] 自動更新間隔を1時間に変更
- [x] カウントダウン表示を時:分:秒に対応
- [x] オッズレンジ形式のデータ構造定義
- [x] フロントエンドでレンジ表示対応
- [x] CSSスタイル調整
- [x] Worker でレンジ抽出ロジック追加
- [x] モックデータをレンジ形式に更新
- [x] 後方互換性の確保
- [x] ドキュメント更新

### ユーザー実施が必要
- [ ] Cloudflare Worker の再デプロイ
- [ ] Worker ログでの動作確認
- [ ] 実データテスト（レース開催時間）

---

**実装者**: AI Assistant  
**レビュー**: 必要  
**テスト**: 部分的に完了（Worker 再デプロイ後に完全テスト）
