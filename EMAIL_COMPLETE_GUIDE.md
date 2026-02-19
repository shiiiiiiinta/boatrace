# 📧 メール配信機能 完全実装ガイド

## 🎯 概要

1号艇のオッズが5.0倍を超えたとき、自動的に `shinta7023@gmail.com` にメールを送信します。

**仕組み**:
```
フロントエンド → Cloudflare Worker → Google Apps Script → Gmail
```

---

## 📝 実装手順（全3ステップ）

### ステップ1: Google Apps Script でWebhookを作成 ⏱️ 10分

#### 1. Google Apps Script にアクセス
https://script.google.com/ を開く

#### 2. 新しいプロジェクトを作成
「新しいプロジェクト」をクリック

#### 3. コードを貼り付け
`EMAIL_WEBHOOK_SETUP_GUIDE.md` に記載されているコード全体をコピーして、エディタに貼り付け

#### 4. プロジェクト名を設定
- 左上の「無題のプロジェクト」→ 名前を入力（例: `BoatraceAlert`）
- 保存（Ctrl+S）

#### 5. テストメール送信
1. 関数選択ドロップダウンから「`testSendEmail`」を選択
2. 「▶ 実行」をクリック
3. 初回は承認が必要：
   - 「権限を確認」
   - Googleアカウント選択
   - 「詳細」→「（安全ではないページ）に移動」
   - 「許可」
4. `shinta7023@gmail.com` にメールが届くか確認

#### 6. Webhookとしてデプロイ
1. 「デプロイ」→「新しいデプロイ」
2. 「種類の選択」→「⚙️ ウェブアプリ」
3. 設定：
   - **次のユーザーとして実行**: `自分`
   - **アクセスできるユーザー**: `全員`
4. 「デプロイ」
5. **Webhook URL** をコピー
   - 形式: `https://script.google.com/macros/s/XXXXX.../exec`

✅ **ステップ1完了**: Webhook URL を取得したら次へ

---

### ステップ2: Cloudflare Worker に送信エンドポイント追加 ⏱️ 5分

#### 1. worker.js にエンドポイントを追加

`worker.js` の約318行目、`GET /api/health` の直後に以下を追加：

```javascript
  // POST /api/send-alert - 高オッズアラートメール送信
  if (url.pathname === '/api/send-alert' && request.method === 'POST') {
    try {
      const body = await request.json();
      
      // Google Apps Script Webhook URL
      const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE'; // ★ ここにWebhook URLを貼り付け
      
      const webhookResponse = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alerts: body.alerts,
          timestamp: new Date().toISOString()
        })
      });
      
      const webhookResult = await webhookResponse.json();
      
      console.log('Webhook response:', webhookResult);
      
      return successResponse({
        emailSent: webhookResult.success,
        message: webhookResult.message || 'Email alert sent'
      });
      
    } catch (error) {
      console.error('Failed to send alert:', error);
      return errorResponse('Failed to send email alert', 500);
    }
  }
```

#### 2. version情報を更新（オプション）

`worker.js` の約327行目あたり：

```javascript
  if (url.pathname === '/') {
    return new Response(JSON.stringify({
      name: 'BOATRACE Odds Proxy API',
      version: '2.1.0-with-email-alert', // バージョンアップ
      deployed: '2026-02-18T22:00:00Z',
      features: [
        'No mock data',
        'Improved HTML parsing',
        'Multiple pattern matching',
        'Real BOATRACE data only',
        'High odds email alert via webhook' // 追加
      ],
      endpoints: {
        odds: '/api/odds/:jcd/:rno?hd=YYYYMMDD',
        health: '/api/health',
        sendAlert: 'POST /api/send-alert' // 追加
      },
      example: '/api/odds/01/1?hd=20260218'
    }), {
      headers: corsHeaders
    });
  }
```

#### 3. Worker を再デプロイ

1. Cloudflare Dashboard → Workers & Pages → `boatrace`
2. Edit code
3. 既存コード全削除
4. 更新した `worker.js` を貼り付け
5. **Save and Deploy**

✅ **ステップ2完了**: Worker再デプロイが完了したら次へ

---

### ステップ3: フロントエンドの修正 ⏱️ 3分

#### js/main.js の `showHighOddsAlert` 関数を修正

約505行目の `showHighOddsAlert` 関数の先頭に、メール送信処理を追加：

```javascript
// 1号艇高オッズアラート表示（メール送信機能付き）
async function showHighOddsAlert(venues) {
    // 既存のアラートを削除
    const existingAlert = document.getElementById('highOddsAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // ★★★ メール送信処理を追加 ★★★
    try {
        console.log('📧 高オッズアラートメールを送信中...', venues);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/send-alert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                alerts: venues
            })
        });
        
        const result = await response.json();
        console.log('📧 メール送信結果:', result);
        
        if (result.success && result.data.emailSent) {
            console.log('✅ メール送信成功');
        } else {
            console.log('⚠️ メール送信失敗:', result);
        }
    } catch (error) {
        console.error('❌ メール送信エラー:', error);
    }
    // ★★★ ここまで追加 ★★★
    
    // アラート作成（既存のコード、そのまま）
    const alert = document.createElement('div');
    alert.id = 'highOddsAlert';
    // ... 以下既存のコード ...
```

#### アラート表示テキストも更新（オプション）

約513行目あたり：

```javascript
let html = '<div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">🚨 1号艇高オッズアラート</div>';
html += '<div style="font-size: 14px; margin-bottom: 15px;">1号艇のオッズが5.0倍を超えています！<br>📧 メールを送信しました</div>'; // ← 変更
```

✅ **ステップ3完了**: ファイル保存

---

## 🧪 テスト方法

### テスト1: Google Apps Script 単体テスト

`EMAIL_WEBHOOK_SETUP_GUIDE.md` のステップ1-5で既に完了

### テスト2: Worker エンドポイントテスト

以下のHTMLファイルを作成してテスト：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>メール送信テスト</title>
</head>
<body>
    <h1>📧 メール送信テスト</h1>
    <button onclick="testEmail()">テストメール送信</button>
    <pre id="result"></pre>

    <script>
        async function testEmail() {
            const result = document.getElementById('result');
            result.textContent = '送信中...\n';
            
            try {
                const response = await fetch('https://boatrace.shinta7023.workers.dev/api/send-alert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        alerts: [
                            { venue: 'テスト会場A', jcd: '01', race: 8, odds: '5.2-6.8' },
                            { venue: 'テスト会場B', jcd: '07', race: 10, odds: '7.1-8.5' }
                        ]
                    })
                });
                
                const data = await response.json();
                result.textContent += JSON.stringify(data, null, 2);
                
                if (data.success && data.data.emailSent) {
                    alert('✅ メール送信成功！shinta7023@gmail.com を確認してください');
                } else {
                    alert('❌ メール送信失敗');
                }
            } catch (error) {
                result.textContent += `\nエラー: ${error.message}`;
            }
        }
    </script>
</body>
</html>
```

このファイルを `test-email-send.html` として保存し、ブラウザで開いてボタンをクリック。

### テスト3: 実際の高オッズ検出テスト

1. `index.html` を開く
2. ブラウザのコンソールを開く（F12）
3. 以下を実行：

```javascript
// 手動で高オッズアラートをトリガー
showHighOddsAlert([
    { venue: '桐生', jcd: '01', race: 8, odds: '5.2-6.8' },
    { venue: '蒲郡', jcd: '07', race: 10, odds: '6.1-7.5' }
]);
```

4. 画面右上にアラートが表示され、メールも送信されるはず

---

## ✅ 確認ポイント

### Google Apps Script
- [ ] テストメール送信成功
- [ ] Webhook URL 取得完了
- [ ] デプロイ完了

### Cloudflare Worker
- [ ] `/api/send-alert` エンドポイント追加
- [ ] `WEBHOOK_URL` を実際のURLに設定
- [ ] 再デプロイ完了
- [ ] `https://boatrace.shinta7023.workers.dev/` で version 確認

### フロントエンド
- [ ] `showHighOddsAlert` にメール送信処理追加
- [ ] ファイル保存完了

### 動作確認
- [ ] テストメール送信成功
- [ ] メールの内容が正しい（HTML形式、競艇場名、オッズ表示）
- [ ] 実際の高オッズ検出時にメールが送信される

---

## 📧 送信されるメールの内容

**件名**: 🚨 競艇1号艇高オッズアラート

**本文**（HTML形式）:
```
🚨 1号艇高オッズアラート
1号艇のオッズが5.0倍を超えています！

検出時刻: 2026年2月18日 22:15:30
該当競艇場: 2場

---

桐生
レース番号: 8R
1号艇オッズ: 5.2-6.8

蒲郡
レース番号: 10R
1号艇オッズ: 6.1-7.5

---

競艇複勝オッズ リアルタイム表示アプリ
このメールは自動送信されています
```

---

## 🎊 完了！

全てのステップが完了したら、以下をテストしてください：

1. **手動テスト**: `test-email-send.html` でメール送信
2. **自動テスト**: 実際に1号艇が5倍超えになったとき、自動でメールが送信される

問題があれば、ブラウザのコンソール（F12）でエラーを確認してください。

---

## 🔧 トラブルシューティング

### メールが届かない場合

1. **Google Apps Script のログ確認**
   - Apps Script エディタ → 「実行」→ 「実行数」
   - エラーログを確認

2. **Worker のログ確認**
   - Cloudflare Dashboard → Workers → `boatrace` → Logs
   - `Webhook response:` のログを確認

3. **Gmail の迷惑メールフォルダを確認**

4. **Webhook URL が正しいか確認**
   - `worker.js` の `WEBHOOK_URL` が正しく設定されているか

---

準備ができたら、以下を報告してください：
1. **Webhook URL**: `https://script.google.com/macros/s/...`
2. **テストメール送信結果**: 成功 or 失敗

その後、実装を完成させます！🚀
