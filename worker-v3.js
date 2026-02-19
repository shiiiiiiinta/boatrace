// Cloudflare Worker - BOATRACE オッズAPIプロキシ（完全版）
// バージョン: 3.0.0 - 2026-02-19

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

// エラーレスポンス
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: status,
    headers: corsHeaders
  });
}

// 成功レスポンス
function successResponse(data) {
  return new Response(JSON.stringify({
    success: true,
    data: data
  }), {
    status: 200,
    headers: corsHeaders
  });
}

// メインハンドラー
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS プリフライト
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // GET /api/race-schedule/:jcd?hd=YYYYMMDD
  if (url.pathname.startsWith('/api/race-schedule/')) {
    return await handleRaceSchedule(url);
  }
  
  // GET /api/odds/:jcd/:rno?hd=YYYYMMDD
  if (url.pathname.startsWith('/api/odds/')) {
    return await handleOdds(url);
  }
  
  // GET /api/health
  if (url.pathname === '/api/health') {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '3.0.0'
    });
  }
  
  // ルートパス
  if (url.pathname === '/') {
    return successResponse({
      name: 'BOATRACE Odds Proxy API',
      version: '3.0.0',
      endpoints: {
        raceSchedule: '/api/race-schedule/:jcd?hd=YYYYMMDD',
        odds: '/api/odds/:jcd/:rno?hd=YYYYMMDD',
        health: '/api/health'
      }
    });
  }
  
  return errorResponse('Not Found', 404);
}

// レーススケジュール取得
async function handleRaceSchedule(url) {
  const pathParts = url.pathname.split('/');
  const jcd = pathParts[3];
  const hd = url.searchParams.get('hd') || getTodayDate();
  
  if (!jcd || !/^\d{2}$/.test(jcd)) {
    return errorResponse('Invalid venue code', 400);
  }
  
  try {
    const raceindexUrl = `https://www.boatrace.jp/owpc/pc/race/raceindex?jcd=${jcd}&hd=${hd}`;
    
    const response = await fetch(raceindexUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    if (!response.ok) {
      return successResponse({
        jcd,
        date: hd,
        hasSchedule: false,
        races: null
      });
    }
    
    const html = await response.text();
    const races = parseRaceSchedule(html, jcd, hd);
    
    if (!races || races.length === 0) {
      return successResponse({
        jcd,
        date: hd,
        hasSchedule: false,
        races: null
      });
    }
    
    return successResponse({
      jcd,
      date: hd,
      hasSchedule: true,
      races
    });
    
  } catch (error) {
    console.error(`[${jcd}] Schedule error:`, error);
    return errorResponse(error.message, 500);
  }
}

// オッズ取得
async function handleOdds(url) {
  const pathParts = url.pathname.split('/');
  const jcd = pathParts[3];
  const rno = pathParts[4] || '1';
  const hd = url.searchParams.get('hd') || getTodayDate();
  
  if (!jcd || !/^\d{2}$/.test(jcd)) {
    return errorResponse('Invalid venue code', 400);
  }
  
  try {
    const oddstfUrl = `https://www.boatrace.jp/owpc/pc/race/oddstf?jcd=${jcd}&rno=${rno}&hd=${hd}`;
    
    const response = await fetch(oddstfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    if (!response.ok) {
      return successResponse({
        jcd,
        raceNumber: parseInt(rno),
        hasRace: false,
        odds: null
      });
    }
    
    const html = await response.text();
    const odds = parseOddsHtml(html, jcd, rno);
    
    if (!odds) {
      return successResponse({
        jcd,
        raceNumber: parseInt(rno),
        hasRace: false,
        odds: null
      });
    }
    
    return successResponse({
      jcd,
      raceNumber: parseInt(rno),
      hasRace: true,
      odds
    });
    
  } catch (error) {
    console.error(`[${jcd}-${rno}] Odds error:`, error);
    return errorResponse(error.message, 500);
  }
}

// レーススケジュールパース
function parseRaceSchedule(html, jcd, hd) {
  try {
    // 開催なしチェック
    if (html.includes('本日の開催はございません') ||
        html.includes('データがありません') ||
        html.includes('開催なし')) {
      console.log(`[${jcd}] No races held on ${hd}`);
      return null;
    }
    
    const races = [];
    // パターン: <td class="is-fs14 is-fBold"><a ...>1R</a></td><td>08:47</td>
    const pattern = /<td[^>]*class="[^"]*is-fs14[^"]*"[^>]*><a[^>]*>(\d+)R<\/a>\s*<\/td>\s*<td>(\d{2}:\d{2})<\/td>/gi;
    
    const year = parseInt(hd.substring(0, 4));
    const month = parseInt(hd.substring(4, 6)) - 1;
    const day = parseInt(hd.substring(6, 8));
    
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const raceNumber = parseInt(match[1]);
      const limitTime = match[2];
      
      const [hours, minutes] = limitTime.split(':').map(Number);
      const limitDate = new Date(year, month, day, hours, minutes, 0);
      
      races.push({
        raceNumber,
        limitTime,
        limitTimestamp: limitDate.getTime()
      });
    }
    
    return races.length > 0 ? races : null;
  } catch (error) {
    console.error(`[${jcd}] Schedule parse error:`, error);
    return null;
  }
}

// オッズHTMLパース
function parseOddsHtml(html, jcd, rno) {
  try {
    // 開催なし・データなしチェック（厳格化）
    if (html.includes('本日の開催はございません')) {
      console.log(`[${jcd}-${rno}] No race held today`);
      return null;
    }
    
    if (html.includes('レース不成立')) {
      console.log(`[${jcd}-${rno}] Race cancelled`);
      return null;
    }
    
    const oddsMatches = [];
    let match;
    
    // パターン1: <td class="oddsPoint">1.0-1.5</td> 形式（最新）
    const pattern1 = /<td[^>]*class="[^"]*oddsPoint[^"]*"[^>]*>([\d.]+)-([\d.]+)<\/td>/gi;
    while ((match = pattern1.exec(html)) !== null) {
      const min = parseFloat(match[1]);
      const max = parseFloat(match[2]);
      // 0.0-0.0は欠場を意味するが、6艇分必要なので含める
      if (max >= min && max <= 999.9) {
        oddsMatches.push({ min, max });
      }
    }
    
    console.log(`[${jcd}-${rno}] Pattern1 (oddsPoint) found ${oddsMatches.length} odds`);
    
    // パターン2: <td>1.0<br>-<br>1.5</td> 形式（旧形式）
    if (oddsMatches.length < 6) {
      oddsMatches.length = 0;
      const pattern2 = /<td[^>]*>([\d.]+)\s*<br[^>]*>\s*-\s*<br[^>]*>\s*([\d.]+)<\/td>/gi;
      while ((match = pattern2.exec(html)) !== null) {
        const min = parseFloat(match[1]);
        const max = parseFloat(match[2]);
        if (min >= 0.0 && max >= min && max <= 999.9) {
          oddsMatches.push({ min, max });
        }
      }
      console.log(`[${jcd}-${rno}] Pattern2 (br) found ${oddsMatches.length} odds`);
    }
    
    // パターン3: 1.0 - 1.5 形式（スペース区切り）
    if (oddsMatches.length < 6) {
      oddsMatches.length = 0;
      const pattern3 = /([\d.]+)\s*-\s*([\d.]+)/g;
      while ((match = pattern3.exec(html)) !== null) {
        const min = parseFloat(match[1]);
        const max = parseFloat(match[2]);
        if (min >= 0.0 && max >= min && max <= 999.9) {
          oddsMatches.push({ min, max });
        }
      }
      console.log(`[${jcd}-${rno}] Pattern3 (simple) found ${oddsMatches.length} odds`);
    }
    
    if (oddsMatches.length < 6) {
      console.log(`[${jcd}-${rno}] Not enough odds (need 6, got ${oddsMatches.length})`);
      console.log(`[${jcd}-${rno}] HTML sample: ${html.substring(html.indexOf('oddsPoint') - 100, html.indexOf('oddsPoint') + 200)}`);
      return null;
    }
    
    // 最初の6個をオッズとして使用
    const odds = [];
    for (let i = 0; i < 6; i++) {
      odds.push({
        boatNumber: i + 1,
        oddsMin: oddsMatches[i].min,
        oddsMax: oddsMatches[i].max,
        voteTickets: 0,
        voteAmount: 0
      });
    }
    
    // 投票データ抽出（オプション）
    const votePattern = /<td[^>]*>([\d,]+)<\/td>/gi;
    const voteMatches = [];
    
    while ((match = votePattern.exec(html)) !== null) {
      const num = parseInt(match[1].replace(/,/g, ''));
      if (num > 0 && num < 10000000) {
        voteMatches.push(num);
      }
    }
    
    // 投票データを割り当て（6艇×2 = 12個必要）
    if (voteMatches.length >= 12) {
      for (let i = 0; i < 6; i++) {
        odds[i].voteTickets = voteMatches[i * 2];
        odds[i].voteAmount = voteMatches[i * 2 + 1] * 100;
      }
    }
    
    console.log(`[${jcd}-${rno}] Successfully parsed ${odds.length} boats`);
    return odds;
    
  } catch (error) {
    console.error(`[${jcd}-${rno}] Parse error:`, error);
    return null;
  }
}

// 今日の日付取得（YYYYMMDD形式）
function getTodayDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

// イベントリスナー
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
