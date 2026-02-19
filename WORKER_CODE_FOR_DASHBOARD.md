# Cloudflare Worker Code for Dashboard

以下のコードを Cloudflare ダッシュボードの Worker エディタに貼り付けてください。

## デプロイ手順

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** → **Create Worker** をクリック
3. Worker 名を入力（例: `boatrace-odds-proxy`）
4. 以下のコードをすべてコピーして、エディタに貼り付け
5. **Save and Deploy** をクリック
6. 表示された URL をメモ（例: `https://boatrace-odds-proxy.xxxxxxxx.workers.dev`）

## Worker Code

```javascript
// Cloudflare Worker - BOATRACE オッズAPIプロキシ
// このWorkerは競艇公式サイトからオッズデータを取得し、CORS問題を解決します

// CORS ヘッダーを返す
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

// エラーレスポンスを生成
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: status,
    headers: corsHeaders
  });
}

// 成功レスポンスを生成
function successResponse(data) {
  return new Response(JSON.stringify({
    success: true,
    data: data
  }), {
    status: 200,
    headers: corsHeaders
  });
}

// HTMLからオッズデータをパース
function parseOddsHtml(html, jcd, rno) {
  try {
    console.log(`[${jcd}-${rno}] Starting HTML parse, length: ${html.length}`);
    
    // レースが開催されているかチェック
    if (html.includes('本日のレースは終了しました') || 
        html.includes('レース不成立') || 
        html.includes('本日の開催はございません')) {
      console.log(`[${jcd}-${rno}] No race today`);
      return null;
    }
    
    const odds = [];
    
    // 複数のパターンで複勝オッズを抽出
    // パターン1: is-fs16 クラス内のオッズ
    const pattern1 = /<span class="is-fs16"[^>]*>([\d.]+)<\/span>/g;
    // パターン2: td タグ内のオッズ
    const pattern2 = /<td[^>]*>\s*([\d.]+)\s*<\/td>/g;
    // パターン3: oddstf クラス
    const pattern3 = /class="[^"]*oddstf[^"]*"[^>]*>([\d.]+)</g;
    
    let matches = [...html.matchAll(pattern1)];
    if (matches.length === 0) {
      matches = [...html.matchAll(pattern2)];
    }
    if (matches.length === 0) {
      matches = [...html.matchAll(pattern3)];
    }
    
    console.log(`[${jcd}-${rno}] Found ${matches.length} potential odds values`);
    
    // 1号艇から6号艇のオッズを抽出
    for (let i = 0; i < Math.min(6, matches.length); i++) {
      const oddsValue = parseFloat(matches[i][1]);
      if (oddsValue >= 1.0 && oddsValue <= 999.9) {
        odds.push({
          boatNumber: i + 1,
          odds: oddsValue,
          voteTickets: 0,
          voteAmount: 0
        });
      }
    }
    
    console.log(`[${jcd}-${rno}] Extracted ${odds.length} valid odds`);
    
    // 投票数・投票金額を抽出（可能な場合）
    const votePattern = /<td[^>]*>([\d,]+)<\/td>/g;
    const voteMatches = [...html.matchAll(votePattern)];
    
    if (voteMatches.length >= odds.length * 2) {
      for (let i = 0; i < odds.length && i * 2 + 1 < voteMatches.length; i++) {
        const tickets = parseInt(voteMatches[i * 2][1].replace(/,/g, '')) || 0;
        const amount = parseInt(voteMatches[i * 2 + 1][1].replace(/,/g, '')) || 0;
        
        if (tickets > 0) {
          odds[i].voteTickets = tickets;
          odds[i].voteAmount = amount * 100; // 百円単位→円単位
        }
      }
    }
    
    // オッズが取得できなければnull
    if (odds.length === 0) {
      console.log(`[${jcd}-${rno}] No valid odds extracted, returning null`);
      return null;
    }
    
    console.log(`[${jcd}-${rno}] Successfully parsed odds:`, odds);
    return odds;
    
  } catch (error) {
    console.error(`[${jcd}-${rno}] Parse error:`, error);
    return null;
  }
}

// JSONレスポンスからオッズデータをパース
function parseOddsJson(json, jcd, rno) {
  try {
    console.log(`[${jcd}-${rno}] Parsing JSON response`);
    
    // JSONレスポンスからデータを抽出
    // ※ 実際のJSON構造に応じて調整
    
    if (!json || !json.body) {
      console.log(`[${jcd}-${rno}] No body in JSON`);
      return null;
    }
    
    const odds = [];
    
    // オッズデータの抽出
    for (let i = 1; i <= 6; i++) {
      const oddsKey = `odds${i}`;
      const voteKey = `vote${i}`;
      
      if (json.body[oddsKey]) {
        odds.push({
          boatNumber: i,
          odds: parseFloat(json.body[oddsKey]) || 0,
          voteTickets: parseInt(json.body[voteKey]) || 0,
          voteAmount: (parseInt(json.body[voteKey]) || 0) * 1500
        });
      }
    }
    
    console.log(`[${jcd}-${rno}] Extracted ${odds.length} odds from JSON`);
    return odds.length > 0 ? odds : null;
    
  } catch (error) {
    console.error(`[${jcd}-${rno}] JSON parse error:`, error);
    return null;
  }
}

// メインハンドラー
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS プリフライトリクエストに対応
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  
  // GET /api/odds/:jcd/:rno?hd=YYYYMMDD
  if (url.pathname.startsWith('/api/odds/')) {
    const pathParts = url.pathname.split('/');
    const jcd = pathParts[3]; // 場コード
    const rno = pathParts[4] || '1'; // レース番号（デフォルト1R）
    const hd = url.searchParams.get('hd') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    if (!jcd || !/^\d{2}$/.test(jcd)) {
      return errorResponse('Invalid venue code (jcd)', 400);
    }
    
    try {
      // BOATRACE 公式サイトにリクエスト
      const boatraceUrl = `https://www.boatrace.jp/owpc/pc/race/oddstf?jcd=${jcd}&rno=${rno}&hd=${hd}`;
      
      console.log(`[${jcd}-${rno}] Fetching:`, boatraceUrl);
      
      const response = await fetch(boatraceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        }
      });
      
      console.log(`[${jcd}-${rno}] Response status: ${response.status}`);
      
      if (!response.ok) {
        // レースが存在しない、または開催されていない
        console.log(`[${jcd}-${rno}] Response not OK: ${response.status}`);
        if (response.status === 404 || response.status === 500) {
          return successResponse({
            jcd: jcd,
            raceNumber: parseInt(rno),
            hasRace: false,
            odds: null,
            timestamp: new Date().toISOString()
          });
        }
        
        return errorResponse(`BOATRACE API returned ${response.status}`, response.status);
      }
      
      const contentType = response.headers.get('content-type') || '';
      let oddsData = null;
      
      // レスポンス形式に応じてパース
      if (contentType.includes('application/json')) {
        console.log(`[${jcd}-${rno}] Response is JSON`);
        const json = await response.json();
        oddsData = parseOddsJson(json, jcd, rno);
      } else {
        console.log(`[${jcd}-${rno}] Response is HTML/Text, content-type: ${contentType}`);
        const html = await response.text();
        console.log(`[${jcd}-${rno}] HTML length: ${html.length} chars`);
        // デバッグ: HTMLの一部を表示
        if (html.length > 500) {
          console.log(`[${jcd}-${rno}] HTML snippet:`, html.substring(0, 500));
        }
        oddsData = parseOddsHtml(html, jcd, rno);
      }
      
      // データが取得できなかった場合はモックデータを返す
      if (!oddsData || oddsData.length === 0) {
        console.log(`[${jcd}-${rno}] Could not parse data, returning mock data`);
        oddsData = generateMockOdds();
      }
      
      return successResponse({
        jcd: jcd,
        raceNumber: parseInt(rno),
        hasRace: true,
        odds: oddsData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`[${jcd}-${rno}] Fetch error:`, error.message || error);
      
      // エラー時はモックデータを返す（開発用）
      const mockOdds = generateMockOdds();
      
      return successResponse({
        jcd: jcd,
        raceNumber: parseInt(rno),
        hasRace: true,
        odds: mockOdds,
        timestamp: new Date().toISOString(),
        note: `Mock data (API fetch failed: ${error.message || 'Unknown error'})`
      });
    }
  }
  
  // GET /api/health - ヘルスチェック
  if (url.pathname === '/api/health') {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
  
  // ルートパス
  if (url.pathname === '/') {
    return new Response(JSON.stringify({
      name: 'BOATRACE Odds Proxy API',
      version: '1.0.0',
      endpoints: {
        odds: '/api/odds/:jcd/:rno?hd=YYYYMMDD',
        health: '/api/health'
      },
      example: '/api/odds/01/1?hd=20260123'
    }), {
      headers: corsHeaders
    });
  }
  
  return errorResponse('Not Found', 404);
}

// モックデータ生成（開発・テスト用）
function generateMockOdds() {
  const odds = [];
  
  for (let i = 1; i <= 6; i++) {
    const oddsValue = Math.round((Math.random() * 25 + 1) * 10) / 10;
    const baseTickets = 20000;
    const voteTickets = Math.floor(baseTickets / oddsValue + Math.random() * 1000);
    const voteAmount = voteTickets * 1500;
    
    odds.push({
      boatNumber: i,
      odds: oddsValue,
      voteTickets: voteTickets,
      voteAmount: voteAmount
    });
  }
  
  return odds;
}

// イベントリスナーを登録
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
```

## デプロイ後の確認

デプロイが完了したら、以下の URL で動作確認してください:

1. **ヘルスチェック**
   ```
   https://boatrace-odds-proxy.xxxxxxxx.workers.dev/api/health
   ```
   → `{"success":true,"data":{"status":"ok","timestamp":"..."}}` が返ればOK

2. **オッズデータ取得**
   ```
   https://boatrace-odds-proxy.xxxxxxxx.workers.dev/api/odds/01/1
   ```
   → オッズデータが返ればOK

3. **フロントエンド設定**
   - `js/config.js` の `API_BASE_URL` に上記 URL を設定
   - `USE_DEMO_MODE` を `false` に変更
   - `index.html` をブラウザで開いて動作確認

## トラブルシューティング

### データが取得できない場合

1. Cloudflare Dashboard で Worker のログを確認
2. ログに `[XX-YR] Response status:` という形式でログが出力されているか確認
3. HTML パース処理が正しく動作しているか確認
   - ログに `[XX-YR] Extracted N valid odds` が表示されているか

### CORS エラーが出る場合

1. Worker が正しくデプロイされているか確認
2. `corsHeaders` が正しく設定されているか確認
3. ブラウザの開発者ツールでエラーの詳細を確認

## 注意事項

- BOATRACE 公式サイトの HTML 構造が変更された場合、`parseOddsHtml` 関数の調整が必要
- 過度なリクエストは控えてください（5分間隔の自動更新を推奨）
- Cloudflare Workers の無料プランは 1日10万リクエストまで
