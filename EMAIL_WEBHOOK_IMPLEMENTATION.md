# 📧 メール送信機能 - Worker & フロントエンド実装

## ステップ2: Cloudflare Worker にメール送信エンドポイントを追加

### worker.js に追加するコード

Google Apps Script の Webhook URL を取得したら、以下のコードを `worker.js` に追加します。

#### 追加場所: `handleRequest` 関数内、既存エンドポイントの後

```javascript
// POST /api/send-alert - 高オッズアラートメール送信
if (url.pathname === '/api/send-alert' && request.method === 'POST') {
  try {
    const body = await request.json();
    
    // Google Apps Script Webhook URL（環境変数から取得、または直接設定）
    const WEBHOOK_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEBHOOK_URL_HERE';
    
    // Webhook に POST リクエスト
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

### 完全な worker.js の該当部分

以下は、既存のエンドポイントの後に追加する形です：

```javascript
  // GET /api/health - ヘルスチェック
  if (url.pathname === '/api/health') {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
  
  // POST /api/send-alert - 高オッズアラートメール送信 ★ 新規追加
  if (url.pathname === '/api/send-alert' && request.method === 'POST') {
    try {
      const body = await request.json();
      
      // Google Apps Script Webhook URL
      const WEBHOOK_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEBHOOK_URL_HERE'; // ★ ここを変更
      
      // Webhook に POST リクエスト
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
  
  // ルートパス
  if (url.pathname === '/') {
    return new Response(JSON.stringify({
      name: 'BOATRACE Odds Proxy API',
      version: '2.0.0-production',
      deployed: '2026-02-18T21:30:00Z',
      features: [
        'No mock data',
        'Improved HTML parsing',
        'Multiple pattern matching',
        'Real BOATRACE data only',
        'High odds email alert' // ★ 追加
      ],
      endpoints: {
        odds: '/api/odds/:jcd/:rno?hd=YYYYMMDD',
        health: '/api/health',
        sendAlert: 'POST /api/send-alert' // ★ 追加
      },
      example: '/api/odds/01/1?hd=20260218'
    }), {
      headers: corsHeaders
    });
  }
```

---

## ステップ3: フロントエンドからメール送信を呼び出す

### js/main.js の修正

既存の `showHighOddsAlert` 関数を修正して、メール送信も行うようにします。

#### 修正箇所: `showHighOddsAlert` 関数

```javascript
// 1号艇高オッズアラート表示（メール送信機能付き）
async function showHighOddsAlert(venues) {
    // 既存のアラートを削除
    const existingAlert = document.getElementById('highOddsAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // メール送信
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
    
    // アラート作成（既存のコード）
    const alert = document.createElement('div');
    alert.id = 'highOddsAlert';
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    let html = '<div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">🚨 1号艇高オッズアラート</div>';
    html += '<div style="font-size: 14px; margin-bottom: 15px;">1号艇のオッズが5.0倍を超えています！<br>📧 メールを送信しました</div>'; // ★ 追加
    html += '<div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px; margin-bottom: 15px;">';
    
    venues.forEach(v => {
        html += `<div style="margin: 5px 0;"><strong>${v.venue} ${v.race}R</strong>: ${v.odds}</div>`;
    });
    
    html += '</div>';
    html += '<button onclick="document.getElementById(\'highOddsAlert\').remove()" style="background: white; color: #ff6b6b; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: bold;">閉じる</button>';
    
    alert.innerHTML = html;
    document.body.appendChild(alert);
    
    // CSS アニメーションを追加
    if (!document.getElementById('alertAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'alertAnimationStyle';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(500px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('🚨 1号艇高オッズ検出:', venues);
}
```

---

## 📋 実装チェックリスト

### ステップ2: Worker
- [ ] Google Apps Script の Webhook URL を取得
- [ ] `worker.js` に `/api/send-alert` エンドポイントを追加
- [ ] `WEBHOOK_URL` を実際のURLに置き換え
- [ ] Worker を再デプロイ

### ステップ3: フロントエンド
- [ ] `js/main.js` の `showHighOddsAlert` 関数を修正
- [ ] メール送信ログの確認

---

## 🧪 テスト方法

### 手動テスト

テスト用のHTMLを作成して、メール送信をテストできます：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>メール送信テスト</title>
</head>
<body>
    <h1>メール送信テスト</h1>
    <button onclick="testEmailSend()">テストメール送信</button>
    <pre id="result"></pre>

    <script>
        async function testEmailSend() {
            const result = document.getElementById('result');
            result.textContent = '送信中...';
            
            try {
                const response = await fetch('https://boatrace.shinta7023.workers.dev/api/send-alert', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        alerts: [
                            { venue: '桐生', jcd: '01', race: 8, odds: '5.2-6.8' },
                            { venue: '蒲郡', jcd: '07', race: 10, odds: '6.1-7.5' }
                        ]
                    })
                });
                
                const data = await response.json();
                result.textContent = JSON.stringify(data, null, 2);
                
                if (data.success && data.data.emailSent) {
                    alert('✅ メール送信成功！メールボックスを確認してください');
                } else {
                    alert('❌ メール送信失敗');
                }
            } catch (error) {
                result.textContent = `エラー: ${error.message}`;
            }
        }
    </script>
</body>
</html>
```

---

## 🎯 次のステップ

1. **Google Apps Script でテストメール送信を確認**
2. **Webhook URL を取得**
3. **Worker に URL を設定して再デプロイ**
4. **フロントエンドを修正**
5. **テスト実行**

準備ができたら「Webhook URL: https://...」と報告してください！
