// 競艇場のマスターデータ（場コード: 場名）
const VENUES = {
    '01': '桐生',
    '02': '戸田',
    '03': '江戸川',
    '04': '平和島',
    '05': '多摩川',
    '06': '浜名湖',
    '07': '蒲郡',
    '08': '常滑',
    '09': '津',
    '10': '三国',
    '11': 'びわこ',
    '12': '住之江',
    '13': '尼崎',
    '14': '鳴門',
    '15': '丸亀',
    '16': '児島',
    '17': '宮島',
    '18': '徳山',
    '19': '下関',
    '20': '若松',
    '21': '芦屋',
    '22': '福岡',
    '23': '唐津',
    '24': '大村'
};

// グローバル変数
let updateTimer = null;
let countdownInterval = null;
let nextUpdateTime = null;

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// アプリケーション初期化
function initializeApp() {
    // 今すぐ更新ボタンのイベントリスナー
    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchAllOdds();
    });

    // 初回データ取得
    fetchAllOdds();

    // 1時間ごとの自動更新タイマー設定
    startAutoUpdate();
}

// 自動更新タイマー開始
function startAutoUpdate() {
    // 既存のタイマーをクリア
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    // JST時刻を正しく取得
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstTime = new Date(now.getTime() + jstOffset);
    const jstHours = jstTime.getUTCHours();
    
    // 8:00-18:00の間は5分おき、それ以外は自動更新停止
    const isRacingHours = jstHours >= 8 && jstHours < 18;
    
    if (isRacingHours) {
        // レース時間帯：5分おきに自動更新
        const updateInterval = 5 * 60 * 1000; // 5分
        nextUpdateTime = new Date(Date.now() + updateInterval);
        
        // カウントダウン表示更新
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);

        // 5分ごとにデータ更新
        updateTimer = setInterval(() => {
            // JST時刻で判定
            const checkNow = new Date();
            const checkJstTime = new Date(checkNow.getTime() + jstOffset);
            const currentHour = checkJstTime.getUTCHours();
            
            if (currentHour >= 8 && currentHour < 18) {
                fetchAllOdds();
                nextUpdateTime = new Date(Date.now() + updateInterval);
            } else {
                // レース時間外になったら自動更新を停止
                stopAutoUpdate();
            }
        }, updateInterval);
        
    } else {
        // レース時間外：自動更新停止
        nextUpdateTime = null;
        document.getElementById('nextUpdate').textContent = '自動更新停止中（手動更新のみ）';
    }
}

// 自動更新を停止
function stopAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    nextUpdateTime = null;
    document.getElementById('nextUpdate').textContent = '自動更新停止中（手動更新のみ）';
}

// カウントダウン表示更新
function updateCountdown() {
    if (!nextUpdateTime) {
        document.getElementById('nextUpdate').textContent = '自動更新停止中（手動更新のみ）';
        return;
    }

    const now = new Date();
    const diff = nextUpdateTime - now;

    if (diff <= 0) {
        document.getElementById('nextUpdate').textContent = '更新中...';
        return;
    }

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
        document.getElementById('nextUpdate').textContent = `${hours}時間${minutes}分${seconds}秒後`;
    } else {
        document.getElementById('nextUpdate').textContent = `${minutes}分${seconds}秒後`;
    }
}

// 全場のオッズデータを取得
async function fetchAllOdds() {
    cachedDateInfo = null; // キャッシュクリア
    showLoading(true);
    hideError();

    const venueGrid = document.getElementById('venueGrid');
    // 前回のデータを残す（innerHTML = '' を削除）

    try {
        const { targetDate, showOnlyRace12 } = getDateInfo();
        
        // 全24場のスケジュールを一括取得（高速化）
        const schedulePromises = Object.keys(VENUES).map(jcd => 
            fetchScheduleForVenue(jcd, targetDate, showOnlyRace12)
        );
        const schedules = await Promise.allSettled(schedulePromises);
        
        // スケジュール情報をマップに格納
        const scheduleMap = {};
        schedules.forEach((result, index) => {
            const jcd = Object.keys(VENUES)[index];
            scheduleMap[jcd] = result.status === 'fulfilled' ? result.value : null;
        });
        
        // オッズデータを並行取得（スケジュール情報を利用）
        const promises = Object.keys(VENUES).map(jcd => 
            fetchVenueOdds(jcd, scheduleMap[jcd])
        );
        const results = await Promise.allSettled(promises);

        // 結果を会場コードと一緒に配列に格納
        const venuesWithData = results.map((result, index) => {
            const jcd = Object.keys(VENUES)[index];
            return {
                jcd: jcd,
                data: result.status === 'fulfilled' ? result.value : null
            };
        });

        // 締切時刻でソート（締切が近い順）
        venuesWithData.sort((a, b) => {
            // データがない場合は最後尾
            if (!a.data && !b.data) return 0;
            if (!a.data) return 1;
            if (!b.data) return -1;
            
            // limitTimestampで比較（締切が近い順）
            const timeA = a.data.limitTimestamp || Infinity;
            const timeB = b.data.limitTimestamp || Infinity;
            
            return timeA - timeB;
        });

        // ソート済みの順番で画面に表示（新データで置き換え）
        venueGrid.innerHTML = ''; // 一旦クリア
        venuesWithData.forEach(venue => {
            renderVenueCard(venue.jcd, venue.data);
        });

        // 最終更新時刻を更新
        updateLastUpdateTime();
        
        // 1号艇オッズ5倍超えをチェック
        checkBoat1HighOdds(results);

    } catch (error) {
        console.error('Error fetching odds:', error);
        showError('データの取得に失敗しました。しばらくしてから再度お試しください。');
    } finally {
        showLoading(false);
    }
}

// グローバルキャッシュ（日付計算を1回だけ実行）
let cachedDateInfo = null;

function getDateInfo() {
    if (cachedDateInfo) return cachedDateInfo;
    
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstTime = new Date(now.getTime() + jstOffset);
    const hours = jstTime.getUTCHours();
    const jstDate = jstTime.toISOString().slice(0, 10).replace(/-/g, '');
    
    let targetDate, showOnlyRace12;
    
    if (hours >= 0 && hours < 8) {
        const yesterday = new Date(jstTime);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        targetDate = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
        showOnlyRace12 = true;
    } else if (hours >= 23) {
        targetDate = jstDate;
        showOnlyRace12 = true;
    } else {
        targetDate = jstDate;
        showOnlyRace12 = false;
    }
    
    cachedDateInfo = { targetDate, showOnlyRace12 };
    return cachedDateInfo;
}

// スケジュール情報を取得（一括化用）
async function fetchScheduleForVenue(jcd, targetDate, showOnlyRace12) {
    try {
        const scheduleResponse = await fetch(`${CONFIG.API_BASE_URL}/api/race-schedule/${jcd}?hd=${targetDate}`);
        const scheduleData = await scheduleResponse.json();
        
        if (scheduleData.success && scheduleData.data && scheduleData.data.hasSchedule && scheduleData.data.races) {
            return selectBestRaceFromSchedule(scheduleData.data.races, showOnlyRace12);
        }
        return null;
    } catch (error) {
        return null;
    }
}

// スケジュールから最適なレースを選択
function selectBestRaceFromSchedule(races, showOnlyRace12) {
    if (showOnlyRace12) {
        const race12 = races.find(r => r.raceNumber === 12);
        return {
            raceNumber: 12,
            limitTime: race12 ? race12.limitTime : '--:--',
            limitTimestamp: race12 ? race12.limitTimestamp : 0
        };
    }
    
    // 現在時刻を毎回取得（キャッシュを使わない）
    const now = Date.now();
    const upcomingRaces = races.filter(r => r.limitTimestamp > now);
    
    if (upcomingRaces.length === 0) {
        const race12 = races.find(r => r.raceNumber === 12);
        return {
            raceNumber: 12,
            limitTime: race12 ? race12.limitTime : '--:--',
            limitTimestamp: race12 ? race12.limitTimestamp : 0
        };
    }
    
    upcomingRaces.sort((a, b) => a.limitTimestamp - b.limitTimestamp);
    const bestRace = upcomingRaces[0];
    
    return {
        raceNumber: bestRace.raceNumber,
        limitTime: bestRace.limitTime,
        limitTimestamp: bestRace.limitTimestamp
    };
}

// 個別の競艇場のオッズを取得（スケジュール情報を受け取る）
async function fetchVenueOdds(jcd, scheduleInfo) {
    if (CONFIG.USE_DEMO_MODE) {
        return fetchVenueOddsDemo(jcd);
    }

    try {
        if (!scheduleInfo) return null;
        
        const { targetDate } = getDateInfo();
        const { raceNumber: bestRaceNumber, limitTime, limitTimestamp } = scheduleInfo;
        
        // 選択されたレースのオッズを取得
        const apiUrl = `${CONFIG.API_BASE_URL}/api/odds/${jcd}/${bestRaceNumber}?hd=${targetDate}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) return null;

        const result = await response.json();

        if (result.success && result.data && result.data.hasRace && result.data.odds) {
            return {
                raceNumber: result.data.raceNumber,
                odds: result.data.odds,
                limitTime,
                limitTimestamp
            };
        }
        
        return null;

    } catch (error) {
        return null;
    }
}





// オッズデータをパース（Cloudflare Worker APIのレスポンス用）
function parseOddsData(data) {
    if (!data || !data.odds) {
        return null;
    }

    return {
        raceNumber: data.raceNumber || 1,
        odds: data.odds
    };
}

// 競艇場カードを描画
function renderVenueCard(jcd, oddsData) {
    const venueGrid = document.getElementById('venueGrid');
    const venueName = VENUES[jcd];

    const card = document.createElement('div');
    card.className = 'venue-card';

    if (!oddsData) {
        // レース開催なしの場合
        card.innerHTML = `
            <div class="venue-header">
                <div class="venue-name">${venueName}</div>
            </div>
            <div class="no-race">
                <i class="fas fa-info-circle"></i>
                本日のレース開催はありません
            </div>
        `;
    } else {
        // オッズ情報を表示
        const oddsRows = generateOddsRows(oddsData.odds);
        
        // 締切時刻の表示
        const now = new Date();
        const hours = now.getHours();
        const isResultDisplay = (hours >= 0 && hours < 8) || (hours >= 23);
        
        let limitTimeDisplay = '';
        
        // 結果表示モード（0-7時、23時台）
        if (isResultDisplay && oddsData.limitTimestamp && oddsData.limitTimestamp < Date.now()) {
            if (hours >= 0 && hours < 8) {
                limitTimeDisplay = `<div class="limit-time" style="color: #888;">🌙 前日データ</div>`;
            } else {
                limitTimeDisplay = `<div class="limit-time" style="color: #888;">✅ 本日データ</div>`;
            }
        } else if (oddsData.limitTime && oddsData.limitTime !== '--:--') {
            limitTimeDisplay = `<div class="limit-time">⏰ ${oddsData.limitTime}</div>`;
        }
        
        card.innerHTML = `
            <div class="venue-header">
                <div class="venue-name">${venueName}</div>
                ${limitTimeDisplay}
                <div class="race-number">${oddsData.raceNumber}R</div>
            </div>
            <div class="odds-table">
                ${oddsRows}
            </div>
        `;
    }

    venueGrid.appendChild(card);
}

// オッズ行のHTML生成
function generateOddsRows(odds) {
    if (!odds || odds.length === 0) {
        // モックデータを使用（デモ用）
        odds = [
            { boatNumber: 1, oddsMin: 1.2, oddsMax: 2.3, voteTickets: 12450, voteAmount: 18675000 },
            { boatNumber: 2, oddsMin: 2.8, oddsMax: 4.5, voteTickets: 5820, voteAmount: 8730000 },
            { boatNumber: 3, oddsMin: 4.2, oddsMax: 6.8, voteTickets: 3240, voteAmount: 4860000 },
            { boatNumber: 4, oddsMin: 10.5, oddsMax: 15.2, voteTickets: 1530, voteAmount: 2295000 },
            { boatNumber: 5, oddsMin: 15.8, oddsMax: 22.5, voteTickets: 1005, voteAmount: 1507500 },
            { boatNumber: 6, oddsMin: 20.3, oddsMax: 28.9, voteTickets: 742, voteAmount: 1113000 }
        ];
    }

    return odds.map(item => {
        // オッズ値の取得（レンジまたは単一値）
        let oddsDisplay = '';
        let avgOdds = 0;
        
        if (item.oddsMin !== undefined && item.oddsMax !== undefined) {
            // レンジ形式のオッズ
            oddsDisplay = `${item.oddsMin.toFixed(1)}〜${item.oddsMax.toFixed(1)}`;
            avgOdds = (item.oddsMin + item.oddsMax) / 2;
        } else if (item.odds !== undefined) {
            // 単一値のオッズ（後方互換性）
            oddsDisplay = item.odds.toFixed(1);
            avgOdds = item.odds;
        } else {
            oddsDisplay = '-';
            avgOdds = 0;
        }
        
        const oddsClass = avgOdds < 3.0 ? 'low-odds' : (avgOdds > 10.0 ? 'high-odds' : '');
        
        // 投票票数のフォーマット（3桁カンマ区切り）
        const formattedTickets = (item.voteTickets || 0).toLocaleString('ja-JP');
        
        // 投票金額のフォーマット（万円単位）
        const amountInManYen = Math.floor((item.voteAmount || 0) / 10000);
        const formattedAmount = amountInManYen.toLocaleString('ja-JP');
        
        return `
            <div class="odds-row">
                <div class="boat-number">
                    <div class="boat-icon boat-${item.boatNumber}">${item.boatNumber}</div>
                    <span>${item.boatNumber}号艇</span>
                </div>
                <div class="vote-info">
                    <div class="vote-tickets">
                        <i class="fas fa-ticket-alt"></i>
                        <span>${formattedTickets}票</span>
                    </div>
                    <div class="vote-amount">
                        <i class="fas fa-yen-sign"></i>
                        <span>${formattedAmount}万円</span>
                    </div>
                </div>
                <div class="odds-info">
                    <div class="odds-value ${oddsClass}">${oddsDisplay}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ローディング表示の切り替え（上部バナー形式）
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (show) {
        loadingOverlay.style.display = 'block';
    } else {
        // フェードアウトしてから非表示
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// エラーメッセージ表示
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    errorDiv.style.display = 'flex';
}

// エラーメッセージ非表示
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.style.display = 'none';
}

// 最終更新時刻を更新
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = timeString;
}

// デモモード用のモックデータ生成
function generateMockOdds() {
    return Array.from({ length: 6 }, (_, i) => {
        const baseOdds = Math.round((Math.random() * 25 + 1) * 10) / 10;
        const oddsMin = Math.round(baseOdds * 10) / 10;
        const oddsMax = Math.round((baseOdds + Math.random() * 2 + 0.5) * 10) / 10;
        
        // オッズに応じて投票数を逆算（低オッズ = 高投票数）
        const baseTickets = 20000;
        const voteTickets = Math.floor(baseTickets / baseOdds + Math.random() * 1000);
        const voteAmount = voteTickets * 1500; // 1票あたり平均1500円
        
        return {
            boatNumber: i + 1,
            oddsMin: oddsMin,
            oddsMax: oddsMax,
            voteTickets: voteTickets,
            voteAmount: voteAmount
        };
    });
}

// デモモード用: 全場のオッズデータを取得（モック）
// この関数は USE_DEMO_MODE が true の時に使用されます
async function fetchVenueOddsDemo(jcd) {
    // ランダムでレース開催の有無を決定
    const hasRace = Math.random() > 0.2; // 80%の確率で開催
    
    if (!hasRace) {
        return null;
    }

    // 模擬的な遅延
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

    return {
        raceNumber: Math.floor(Math.random() * 12) + 1,
        odds: generateMockOdds()
    };
}

// 1号艇オッズ5倍超えチェック
function checkBoat1HighOdds(results) {
    const highOddsVenues = [];
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.odds) {
            const jcd = Object.keys(VENUES)[index];
            const venueName = VENUES[jcd];
            const odds = result.value.odds;
            const raceNumber = result.value.raceNumber;
            
            // 1号艇を探す
            const boat1 = odds.find(b => b.boatNumber === 1);
            if (boat1) {
                // oddsMin が5.0を超えているかチェック
                const minOdds = boat1.oddsMin || boat1.odds || 0;
                if (minOdds > 5.0) {
                    highOddsVenues.push({
                        venue: venueName,
                        jcd: jcd,
                        race: raceNumber,
                        odds: `${boat1.oddsMin || boat1.odds}-${boat1.oddsMax || boat1.odds}`
                    });
                }
            }
        }
    });
    
    // 5倍超えがあればアラート表示
    if (highOddsVenues.length > 0) {
        showHighOddsAlert(highOddsVenues);
    }
}

// 1号艇高オッズアラート表示（メール送信機能付き）
async function showHighOddsAlert(venues) {
    // 既存のアラートを削除
    const existingAlert = document.getElementById('highOddsAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // メール送信処理
    let emailSent = false;
    try {

        
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
        
        if (result.success && result.data.emailSent) {
            emailSent = true;
        }
    } catch (error) {
    }
    
    // アラート作成
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
    html += `<div style="font-size: 14px; margin-bottom: 15px;">1号艇のオッズが5.0倍を超えています！<br>${emailSent ? '📧 メールを送信しました' : '⚠️ メール送信に失敗しました'}</div>`;
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
    

}
