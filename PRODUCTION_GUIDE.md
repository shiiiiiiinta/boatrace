# 本番リリースガイド

## 🚀 本番環境で実際のオッズを表示するために必要なこと

現在はデモモード（モックデータ）で動作していますが、実際の競艇オッズを表示するには以下の対応が必要です。

---

## 📋 必要な対応項目

### 1. バックエンドAPI/プロキシサーバーの構築 ⭐️ **最重要**

#### 問題点
- 競艇公式サイト（`https://www.boatrace.jp`）はCORSヘッダーを返さない
- ブラウザから直接APIを呼び出すとCORSエラーが発生
- セキュリティポリシーによりブラウザ側での回避は不可能

#### 解決策
バックエンドサーバーを構築し、サーバー側で競艇公式APIを呼び出す

#### 実装方法（推奨順）

##### 方法A: Node.js + Express でプロキシサーバー構築

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// オッズ取得エンドポイント
app.get('/api/odds/:jcd/:rno', async (req, res) => {
  try {
    const { jcd, rno } = req.params;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const response = await axios.get(
      `https://www.boatrace.jp/owpc/pc/race/oddstf`,
      {
        params: { jcd, rno, hd: today }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'データ取得失敗' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

**必要なパッケージ:**
```bash
npm install express axios cors
```

##### 方法B: Cloudflare Workers（サーバーレス）

```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const jcd = url.searchParams.get('jcd');
  const rno = url.searchParams.get('rno');
  const hd = url.searchParams.get('hd');
  
  const apiUrl = `https://www.boatrace.jp/owpc/pc/race/oddstf?jcd=${jcd}&rno=${rno}&hd=${hd}`;
  
  const response = await fetch(apiUrl);
  const data = await response.text();
  
  return new Response(data, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
```

**メリット:**
- 無料枠で運用可能
- サーバー管理不要
- 高速・グローバル配信

##### 方法C: AWS Lambda + API Gateway

- サーバーレスでスケーラブル
- 従量課金制
- AWS無料枠利用可能

---

### 2. APIレスポンスのパース処理実装

競艇公式APIの実際のレスポンス形式を調査し、パース処理を実装する必要があります。

#### 現在のコード（仮実装）
```javascript
// js/main.js の parseOddsData 関数
function parseOddsData(data) {
  // ※ 実際のAPIレスポンス形式に応じて実装が必要
  if (!data || !data.odds) {
    return null;
  }
  return {
    raceNumber: data.raceNumber || 1,
    odds: data.odds
  };
}
```

#### 必要な作業
1. 実際のAPIレスポンスを確認
2. HTML/JSONどちらの形式か判別
3. 複勝オッズデータの抽出ロジック実装
4. 投票票数・投票金額の抽出ロジック実装

---

### 3. エンドポイントの変更

`js/main.js` のAPIエンドポイントを本番環境用に変更

#### 変更箇所
```javascript
// 現在（デモモード）
const apiUrl = `https://www.boatrace.jp/owpc/pc/race/oddstf?rno=1&jcd=${jcd}&hd=${hd}`;

// 本番環境（プロキシサーバー経由）
const apiUrl = `https://your-api-server.com/api/odds/${jcd}/${raceNumber}?hd=${hd}`;
```

#### 環境変数での管理（推奨）
```javascript
// config.js
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// main.js
const apiUrl = `${API_BASE_URL}/api/odds/${jcd}/${raceNumber}`;
```

---

### 4. エラーハンドリングの強化

#### 現在の実装
- 基本的なtry-catchのみ

#### 追加すべき処理
- **リトライロジック**: API呼び出し失敗時に再試行
- **タイムアウト処理**: 応答が遅い場合の処理
- **個別エラー表示**: どの競艇場でエラーが発生したか明示
- **部分的な表示**: 一部の競艇場で失敗しても他は表示

```javascript
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

### 5. パフォーマンス最適化

#### キャッシング戦略
```javascript
// Service Workerでのキャッシング
// sw.js
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

#### データ取得の最適化
- 必要なレースのみ取得（全レース取得は避ける）
- 圧縮転送（gzip/brotli）
- CDN経由での配信

---

### 6. セキュリティ対策

#### APIキー/認証（必要に応じて）
```javascript
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};
```

#### レート制限
- APIへの過度なリクエストを防止
- 自動更新間隔の調整（5分 → 状況に応じて調整）

#### HTTPS必須
- 本番環境は必ずHTTPS化

---

### 7. モニタリング・ログ

#### 実装すべき項目
- **エラーログ**: API呼び出し失敗の記録
- **アクセスログ**: 利用状況の把握
- **パフォーマンス監視**: 応答時間の測定

#### ツール例
- Google Analytics
- Sentry（エラートラッキング）
- CloudWatch（AWS使用時）

---

### 8. 利用規約・法的確認 ⚠️ **重要**

#### 確認事項
1. **競艇公式サイトの利用規約確認**
   - スクレイピング・API利用の可否
   - 商用利用の可否
   - データの再配布に関する規定

2. **公式APIの存在確認**
   - 公式に提供されているAPIがあるか
   - 利用申請が必要か

3. **著作権・データ権利**
   - オッズデータの権利関係
   - 競艇場名・ロゴの使用許可

**⚠️ 警告**: 規約違反は法的問題につながる可能性があります。必ず確認してください。

---

## 📝 本番リリースチェックリスト

### 技術面
- [ ] バックエンドAPI/プロキシサーバーの構築
- [ ] 実際のAPIレスポンスパース処理の実装
- [ ] エンドポイントURLの本番環境への変更
- [ ] エラーハンドリングの強化
- [ ] リトライロジックの実装
- [ ] キャッシング戦略の実装
- [ ] HTTPS化
- [ ] レスポンシブデザインの最終確認
- [ ] クロスブラウザテスト（Chrome, Firefox, Safari, Edge）
- [ ] モバイル実機テスト

### データ面
- [ ] 複勝オッズの正確な取得確認
- [ ] 投票票数データの取得実装
- [ ] 投票金額データの取得実装
- [ ] データ更新頻度の最適化
- [ ] レース開催有無の判定ロジック

### セキュリティ面
- [ ] APIキー管理（必要な場合）
- [ ] レート制限の実装
- [ ] XSS対策の確認
- [ ] CORS設定の確認

### 運用面
- [ ] エラーログの実装
- [ ] モニタリングツールの導入
- [ ] バックアップ戦略の策定
- [ ] ドキュメント整備

### 法的面
- [ ] 競艇公式サイト利用規約の確認
- [ ] データ利用許諾の確認
- [ ] プライバシーポリシーの作成（必要な場合）
- [ ] 免責事項の記載

---

## 💰 コスト試算

### パターンA: Cloudflare Workers（推奨）
- **月額**: 0円〜$5
- **無料枠**: 100,000リクエスト/日
- **メリット**: 最もコスパが良い

### パターンB: VPS（さくらVPS等）
- **月額**: 500円〜2,000円
- **メリット**: 自由度が高い

### パターンC: AWS Lambda + API Gateway
- **月額**: 0円〜$10（利用量による）
- **無料枠**: 100万リクエスト/月

---

## 📅 推奨実装スケジュール

### フェーズ1: 調査・準備（1-2日）
- 競艇公式サイト利用規約の確認
- 実際のAPIレスポンス形式の調査
- インフラ選定

### フェーズ2: バックエンド構築（2-3日）
- プロキシサーバー/API構築
- パース処理の実装
- テスト環境での動作確認

### フェーズ3: フロントエンド改修（1-2日）
- エンドポイント変更
- エラーハンドリング強化
- 投票データ表示機能追加

### フェーズ4: テスト（2-3日）
- 統合テスト
- 負荷テスト
- クロスブラウザテスト

### フェーズ5: リリース（1日）
- 本番環境へのデプロイ
- モニタリング設定
- 動作確認

**合計**: 約1-2週間

---

## 🎯 まとめ

本番リリースの最大の課題は **CORS問題の解決**です。

**最短ルート**: Cloudflare Workers でプロキシを構築し、競艇公式APIを中継する方法がおすすめです。

ご不明点があればお気軽にお聞きください！
