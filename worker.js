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
    
    // レース不成立や開催なしのチェック（終了したレースは除外）
    if (html.includes('レース不成立') || 
        html.includes('本日の開催はございません') ||
        html.includes('データがありません')) {
      console.log(`[${jcd}-${rno}] No race available (cancelled or not held)`);
      return null;
    }
    
    // 「本日のレースは終了しました」が含まれていてもオッズデータがあれば取得を試みる
    const raceEnded = html.includes('本日のレースは終了しました');
    if (raceEnded) {
      console.log(`[${jcd}-${rno}] Race has ended, but will try to parse odds data`);
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
    
    // 投票数を抽出 - 複数のパターンを試行
    const voteNumbers = [];
    
    // パターン1: <td>タグ内のカンマ区切り数値（既存）
    let votePattern = /<td[^>]*(?:class="[^"]*text-right[^"]*")?[^>]*>([\d,]+)<\/td>/gi;
    while ((match = votePattern.exec(html)) !== null) {
      const num = parseInt(match[1].replace(/,/g, ''));
      if (num > 0 && num < 10000000) {
        voteNumbers.push(num);
      }
    }
    
    // パターン2: より広範なHTML内のカンマ区切り数値
    if (voteNumbers.length < 12) { // 6艇×2（票数・金額）= 12個必要
      voteNumbers.length = 0;
      const broadPattern = />([\d,]{2,})</g;
      while ((match = broadPattern.exec(html)) !== null) {
        const num = parseInt(match[1].replace(/,/g, ''));
        if (num > 0 && num < 10000000) {
          voteNumbers.push(num);
        }
      }
    }
    
    console.log(`[${jcd}-${rno}] Found ${voteNumbers.length} vote numbers:`, voteNumbers.slice(0, 20));
    
    // 投票数と金額を割り当て
    // オッズの順番に対応する票数・金額のペアを探す
    if (voteNumbers.length >= 12) {
      // 十分な数値がある場合、最初の12個を使用（6艇×2）
      let voteIndex = 0;
      for (let i = 0; i < odds.length && voteIndex < voteNumbers.length - 1; i++) {
        // 2つずつペアで取得: 票数、金額
        const tickets = voteNumbers[voteIndex];
        const amount = voteNumbers[voteIndex + 1];
        
        // 票数は通常100〜50000程度、金額は票数より大きい
        if (tickets < amount) {
          odds[i].voteTickets = tickets;
          odds[i].voteAmount = amount * 100; // 百円単位を円に変換
        } else {
          // 逆の場合も考慮
          odds[i].voteTickets = amount;
          odds[i].voteAmount = tickets * 100;
        }
        voteIndex += 2;
      }
    } else if (voteNumbers.length >= 6) {
      // 票数のみある場合
      for (let i = 0; i < Math.min(6, voteNumbers.length); i++) {
        odds[i].voteTickets = voteNumbers[i];
        // 金額は票数×1500円（平均）で推定
        odds[i].voteAmount = voteNumbers[i] * 1500;
      }
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

// レーススケジュール（締切時刻）をパース
function parseRaceSchedule(html, jcd, hd) {
  try {
    console.log(`[${jcd}] Parsing race schedule for date ${hd}, HTML length: ${html.length}`);
    
    // 開催がない場合のメッセージをチェック
    if (html.includes('本日の開催はございません') ||
        html.includes('データがありません') ||
        html.includes('レース不成立')) {
      console.log(`[${jcd}] No races held on ${hd}`);
      return null;
    }
    
    const races = [];
    
    // パターン: <td class="is-fs14 is-fBold"><a href="...">1R</a></td><td>08:47</td>
    // レース番号と締切時刻を抽出
    const racePattern = /<td[^>]*class="[^"]*is-fs14[^"]*"[^>]*><a[^>]*>(\d+)R<\/a>\s*<\/td>\s*<td>(\d{2}:\d{2})<\/td>/gi;
    
    // リクエストされた日付（hd: YYYYMMDD）からDateオブジェクトを作成
    const year = parseInt(hd.substring(0, 4));
    const month = parseInt(hd.substring(4, 6)) - 1; // 月は0から始まる
    const day = parseInt(hd.substring(6, 8));
    
    let match;
    while ((match = racePattern.exec(html)) !== null) {
      const raceNumber = parseInt(match[1]);
      const limitTime = match[2]; // "08:47"
      
      // リクエストされた日付で締切時刻のタイムスタンプを作成
      const [hours, minutes] = limitTime.split(':').map(Number);
      const limitDate = new Date(year, month, day, hours, minutes, 0);
      
      races.push({
        raceNumber: raceNumber,
        limitTime: limitTime,
        limitTimestamp: limitDate.getTime()
      });
    }
    
    console.log(`[${jcd}] Found ${races.length} races with limit times`);
    
    if (races.length > 0) {
      console.log(`[${jcd}] Schedule:`, JSON.stringify(races.slice(0, 3))); // 最初の3レースをログ
    }
    
    return races.length > 0 ? races : null;
    
  } catch (error) {
    console.error(`[${jcd}] Schedule parse error:`, error);
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
  
  // GET /api/race-schedule/:jcd?hd=YYYYMMDD - レーススケジュール（締切時刻）取得
  if (url.pathname.startsWith('/api/race-schedule/')) {
    const pathParts = url.pathname.split('/');
    const jcd = pathParts[3]; // 場コード
    const hd = url.searchParams.get('hd') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    if (!jcd || !/^\d{2}$/.test(jcd)) {
      return errorResponse('Invalid venue code (jcd)', 400);
    }
    
    try {
      // BOATRACE レース一覧ページにリクエスト
      const raceindexUrl = `https://www.boatrace.jp/owpc/pc/race/raceindex?jcd=${jcd}&hd=${hd}`;
      
      console.log(`[${jcd}] Fetching schedule:`, raceindexUrl);
      
      const response = await fetch(raceindexUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        }
      });
      
      console.log(`[${jcd}] Schedule response status: ${response.status}`);
      
      if (!response.ok) {
        return successResponse({
          jcd: jcd,
          date: hd,
          hasSchedule: false,
          races: null,
          timestamp: new Date().toISOString()
        });
      }
      
      const html = await response.text();
      const schedule = parseRaceSchedule(html, jcd, hd);
      
      if (!schedule) {
        return successResponse({
          jcd: jcd,
          date: hd,
          hasSchedule: false,
          races: null,
          timestamp: new Date().toISOString()
        });
      }
      
      return successResponse({
        jcd: jcd,
        date: hd,
        hasSchedule: true,
        races: schedule,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`[${jcd}] Schedule fetch error:`, error);
      return errorResponse('Failed to fetch race schedule: ' + error.message, 500);
    }
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
  
  // POST /api/send-alert - 高オッズアラートメール送信
  if (url.pathname === '/api/send-alert' && request.method === 'POST') {
    try {
      const body = await request.json();
      
      // Google Apps Script Webhook URL
      const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxha5zinYQ94p3FbEYVbS6EZJr4CRV1MFpKg4vcQyfcq_LDXkfNOACIV_evicx36y7n/exec';
      
      console.log('[ALERT] Sending email alert for:', body.alerts);
      
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
      
      console.log('[ALERT] Webhook response:', webhookResult);
      
      return successResponse({
        emailSent: webhookResult.success,
        message: webhookResult.message || 'Email alert sent',
        alertCount: body.alerts.length
      });
      
    } catch (error) {
      console.error('[ALERT] Failed to send alert:', error);
      return errorResponse('Failed to send email alert: ' + error.message, 500);
    }
  }
  
  // ルートパス
  if (url.pathname === '/') {
    return new Response(JSON.stringify({
      name: 'BOATRACE Odds Proxy API',
      version: '2.2.0-with-schedule',
      deployed: '2026-02-18T23:00:00Z',
      features: [
        'No mock data',
        'Improved HTML parsing',
        'Multiple pattern matching',
        'Real BOATRACE data only',
        'High odds email alert via Google Apps Script',
        'Race schedule with limit times'
      ],
      endpoints: {
        odds: '/api/odds/:jcd/:rno?hd=YYYYMMDD',
        schedule: '/api/race-schedule/:jcd?hd=YYYYMMDD',
        health: '/api/health',
        sendAlert: 'POST /api/send-alert'
      },
      example: '/api/odds/01/1?hd=20260218',
      scheduleExample: '/api/race-schedule/10?hd=20260218'
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
