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
        html.includes('本日の開催はございません') ||
        html.includes('データがありません')) {
      console.log(`[${jcd}-${rno}] No race today`);
      return null;
    }
    
    // すべての数値パターンを抽出（オッズと票数）
    const allNumbers = [];
    
    // パターン1: <td>内の数値（オッズ範囲）
    const tdPattern = /<td[^>]*>([\d.]+)\s*<br[^>]*>\s*-\s*<br[^>]*>\s*([\d.]+)<\/td>/gi;
    let match;
    while ((match = tdPattern.exec(html)) !== null) {
      allNumbers.push({
        type: 'odds',
        min: parseFloat(match[1]),
        max: parseFloat(match[2])
      });
    }
    
    console.log(`[${jcd}-${rno}] Found ${allNumbers.length} odds ranges in HTML`);
    
    // オッズが6個未満の場合は別のパターンを試す
    if (allNumbers.length < 6) {
      // パターン2: 数値-数値のシンプルなパターン
      const simplePattern = /([\d.]+)\s*-\s*([\d.]+)/g;
      const temp = [];
      while ((match = simplePattern.exec(html)) !== null) {
        const min = parseFloat(match[1]);
        const max = parseFloat(match[2]);
        if (min >= 1.0 && min <= 999.9 && max >= min && max <= 999.9) {
          temp.push({ type: 'odds', min, max });
        }
      }
      if (temp.length >= 6) {
        allNumbers.length = 0;
        allNumbers.push(...temp.slice(0, 6));
        console.log(`[${jcd}-${rno}] Used simple pattern, found ${allNumbers.length} odds`);
      }
    }
    
    if (allNumbers.length < 6) {
      console.log(`[${jcd}-${rno}] Not enough odds found: ${allNumbers.length}`);
      return null;
    }
    
    // 最初の6個をオッズとして使用
    const odds = [];
    for (let i = 0; i < Math.min(6, allNumbers.length); i++) {
      odds.push({
        boatNumber: i + 1,
        oddsMin: allNumbers[i].min,
        oddsMax: allNumbers[i].max,
        voteTickets: 0,
        voteAmount: 0
      });
    }
    
    console.log(`[${jcd}-${rno}] Created ${odds.length} boat odds`);
    
    // 投票数を抽出 (カンマ区切りの数値)
    const voteNumbers = [];
    const votePattern = /<td[^>]*(?:class="[^"]*text-right[^"]*")?[^>]*>([\d,]+)<\/td>/gi;
    while ((match = votePattern.exec(html)) !== null) {
      const num = parseInt(match[1].replace(/,/g, ''));
      if (num > 0 && num < 1000000) { // 妥当な範囲の数値のみ
        voteNumbers.push(num);
      }
    }
    
    console.log(`[${jcd}-${rno}] Found ${voteNumbers.length} vote numbers`);
    
    // 投票数と金額を割り当て（2つずつ: 票数、金額）
    let voteIndex = 0;
    for (let i = 0; i < odds.length && voteIndex < voteNumbers.length - 1; i++) {
      odds[i].voteTickets = voteNumbers[voteIndex];
      odds[i].voteAmount = voteNumbers[voteIndex + 1] * 100; // 百円単位
      voteIndex += 2;
    }
    
    console.log(`[${jcd}-${rno}] Successfully parsed ${odds.length} boats with odds and votes`);
    console.log(`[${jcd}-${rno}] Data:`, JSON.stringify(odds));
    
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
        oddsData = parseOddsHtml(html, jcd, rno);
      }
      
      // データが取得できなかった場合はレース開催なしとして返す
      if (!oddsData || oddsData.length === 0) {
        console.log(`[${jcd}-${rno}] No odds data extracted, race not available`);
        return successResponse({
          jcd: jcd,
          raceNumber: parseInt(rno),
          hasRace: false,
          odds: null,
          timestamp: new Date().toISOString()
        });
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
      
      // エラー時はレース開催なしとして返す
      return successResponse({
        jcd: jcd,
        raceNumber: parseInt(rno),
        hasRace: false,
        odds: null,
        timestamp: new Date().toISOString(),
        error: error.message || 'Fetch failed'
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

// イベントリスナー
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
