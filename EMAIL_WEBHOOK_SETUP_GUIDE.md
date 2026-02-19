# 📧 メール配信機能実装ガイド（Webhook → Gmail App Script）

## 🎯 実装手順

### ステップ1: Google Apps Script でWebhookを作成

#### 1-1. Google Apps Script にアクセス
1. https://script.google.com/ にアクセス
2. 「新しいプロジェクト」をクリック

#### 1-2. スクリプトコードを貼り付け

以下のコードをコピーして、エディタに貼り付けてください：

```javascript
/**
 * 競艇1号艇高オッズアラートメール送信
 * Webhook経由で呼び出されるGoogle Apps Scriptです
 */

function doPost(e) {
  try {
    // POSTデータを解析
    const data = JSON.parse(e.postData.contents);
    
    Logger.log('Received data: ' + JSON.stringify(data));
    
    // データ検証
    if (!data || !data.alerts || !Array.isArray(data.alerts)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid data format'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // メール送信
    const result = sendHighOddsAlert(data.alerts, data.timestamp);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: result,
      message: result ? 'Email sent successfully' : 'Failed to send email'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 高オッズアラートメールを送信
 */
function sendHighOddsAlert(alerts, timestamp) {
  try {
    // メール送信先
    const recipient = 'shinta7023@gmail.com';
    
    // メール件名
    const subject = '🚨 競艇1号艇高オッズアラート';
    
    // メール本文（HTML）
    let htmlBody = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .content { padding: 20px; background: #f9f9f9; }
            .alert-item { background: white; margin: 10px 0; padding: 15px; border-left: 5px solid #ff6b6b; border-radius: 5px; }
            .venue-name { font-size: 18px; font-weight: bold; color: #333; }
            .race-info { color: #666; margin-top: 5px; }
            .odds-value { font-size: 24px; font-weight: bold; color: #ff6b6b; margin-top: 10px; }
            .footer { padding: 20px; background: #333; color: white; text-align: center; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚨 1号艇高オッズアラート</h1>
            <p>1号艇のオッズが5.0倍を超えています！</p>
          </div>
          
          <div class="content">
            <p><strong>検出時刻:</strong> ${new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
            <p><strong>該当競艇場:</strong> ${alerts.length}場</p>
            <hr>
    `;
    
    // 各アラートを追加
    alerts.forEach(alert => {
      htmlBody += `
        <div class="alert-item">
          <div class="venue-name">${alert.venue}</div>
          <div class="race-info">レース番号: ${alert.race}R</div>
          <div class="odds-value">1号艇オッズ: ${alert.odds}</div>
        </div>
      `;
    });
    
    htmlBody += `
          </div>
          
          <div class="footer">
            <p>競艇複勝オッズ リアルタイム表示アプリ</p>
            <p style="font-size: 12px; margin-top: 10px;">このメールは自動送信されています</p>
          </div>
        </body>
      </html>
    `;
    
    // テキスト本文（HTMLが表示できない場合用）
    let plainBody = '🚨 競艇1号艇高オッズアラート\n\n';
    plainBody += '1号艇のオッズが5.0倍を超えています！\n\n';
    plainBody += `検出時刻: ${new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n`;
    plainBody += `該当競艇場: ${alerts.length}場\n\n`;
    plainBody += '--- 詳細 ---\n\n';
    
    alerts.forEach(alert => {
      plainBody += `${alert.venue} ${alert.race}R\n`;
      plainBody += `1号艇オッズ: ${alert.odds}\n\n`;
    });
    
    plainBody += '---\n';
    plainBody += '競艇複勝オッズ リアルタイム表示アプリ\n';
    plainBody += 'このメールは自動送信されています';
    
    // メール送信
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody
    });
    
    Logger.log('Email sent successfully to: ' + recipient);
    return true;
    
  } catch (error) {
    Logger.log('Failed to send email: ' + error.toString());
    return false;
  }
}

/**
 * GETリクエスト対応（テスト用）
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Boatrace High Odds Alert Webhook',
    endpoint: 'POST only',
    example: {
      alerts: [
        { venue: '桐生', jcd: '01', race: 8, odds: '5.2-6.8' },
        { venue: '蒲郡', jcd: '07', race: 10, odds: '6.1-7.5' }
      ],
      timestamp: new Date().toISOString()
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * テスト実行用関数（手動実行可能）
 */
function testSendEmail() {
  const testAlerts = [
    { venue: '桐生', jcd: '01', race: 8, odds: '5.2-6.8' },
    { venue: '蒲郡', jcd: '07', race: 10, odds: '6.1-7.5' }
  ];
  
  const result = sendHighOddsAlert(testAlerts, new Date().toISOString());
  
  if (result) {
    Logger.log('✅ テストメール送信成功！');
  } else {
    Logger.log('❌ テストメール送信失敗');
  }
}
```

#### 1-3. プロジェクト名を設定
- 画面左上の「無題のプロジェクト」をクリック
- 名前を入力（例: `BoatraceHighOddsAlert`）

#### 1-4. スクリプトを保存
- 「💾 保存」ボタンをクリック（Ctrl+S / Cmd+S）

#### 1-5. テストメールを送信
1. エディタ上部の関数選択ドロップダウンから「`testSendEmail`」を選択
2. 「▶ 実行」ボタンをクリック
3. 初回実行時に承認を求められます：
   - 「権限を確認」をクリック
   - Googleアカウントを選択
   - 「詳細」→「（安全ではないページ）に移動」をクリック
   - 「許可」をクリック
4. 実行が完了したら、`shinta7023@gmail.com` にメールが届いているか確認

#### 1-6. Webhookとしてデプロイ
1. 画面右上の「デプロイ」→「新しいデプロイ」をクリック
2. 「種類の選択」で「⚙️ ウェブアプリ」を選択
3. 設定：
   - **説明**: `High Odds Alert Webhook`
   - **次のユーザーとして実行**: `自分`
   - **アクセスできるユーザー**: `全員`
4. 「デプロイ」をクリック
5. **Webhook URL** が表示されるのでコピーして保存
   - 形式: `https://script.google.com/macros/s/XXXXX.../exec`

---

## ステップ2: Worker にメール送信エンドポイントを追加

次のステップで、Cloudflare Worker にメール送信エンドポイントを追加します。

---

## 📝 メモ

### Webhook URL の例
```
https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXXX/exec
```

このURLを次のステップで使用します。

### テストメールの内容
テストメールが正しく送信されたか確認してください：
- ✅ 件名: `🚨 競艇1号艇高オッズアラート`
- ✅ 送信元: あなたのGmailアドレス
- ✅ 送信先: `shinta7023@gmail.com`
- ✅ 本文: HTMLフォーマット（色付き、整形済み）

---

## 次のステップ

1. **テストメール送信を確認**
2. **Webhook URL を取得**
3. 次に進む準備ができたら「Webhook URL を取得しました」と報告してください

その後、Worker とフロントエンドの実装に進みます！
