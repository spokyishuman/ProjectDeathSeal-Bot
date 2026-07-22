"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const express_1 = __importDefault(require("express"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const onlinefix_1 = require("./onlinefix");
const fares_1 = require("./fares");
const steam_1 = require("./steam");
const gamescraper_1 = require("./gamescraper");
// ==========================================
// CONFIG
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const GUILD_ID = process.env.GUILD_ID || '';
const OWNER_ID = process.env.OWNER_ID || '963080092899242054';
const ADSENSE_PUB_ID = process.env.ADSENSE_PUB_ID || '';
const ADSENSE_SLOT_ID = process.env.ADSENSE_SLOT_ID || '';
const AD_REWARD = parseInt(process.env.AD_REWARD || '1', 10); // bonus rolls per ad watch
const DAILY_ROLL_CAP = 10;
const REPO_OWNER = 'spokyishuman';
const REPO_NAME = 'SpokysProjectLightning';
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const COOKIES_FILE = path.join(DATA_DIR, 'cookies.json');
const INDEX_FILE = path.join(DATA_DIR, 'onlinefix-index.json');
const BALANCES_FILE = path.join(ROOT, 'balances.json');
const DAILY_FILE = path.join(ROOT, 'daily.json');
const ROLL_CONFIG_FILE = path.join(ROOT, 'roll-config.json');
const REPO_ALERTS_FILE = path.join(ROOT, 'repo-alerts.json');
const GIVEAWAYS_FILE = path.join(ROOT, 'giveaways.json');
const BOOSTS_FILE = path.join(ROOT, 'boosts.json');
const DAILY_ROLLS_FILE = path.join(ROOT, 'daily-rolls.json');
const BONUS_ROLLS_FILE = path.join(ROOT, 'bonus-rolls.json');
const PAID_GAMES = ['1091500', '1245620', '1174180', '2358720', '739630', '1817070', '3892270', '1272080', '1222680', '813780', '570', '730'];
if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error('Missing env: BOT_TOKEN, CLIENT_ID, GUILD_ID');
    process.exit(1);
}
if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true });
// ==========================================
// PERSISTENCE
// ==========================================
let balancesCache = {};
let dailyCache = {};
let rollConfig = { cost: 50 };
let repoAlerts = { channelId: null, lastTag: null };
let giveaways = {};
let boosts = {};
let dailyRolls = {};
let bonusRolls = {};
const adTokens = new Map(); // in-memory only, no persistence needed
function loadAll() {
    const load = (file, def) => {
        try {
            if (fs.existsSync(file))
                return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        catch { }
        return def;
    };
    balancesCache = load(BALANCES_FILE, {});
    dailyCache = load(DAILY_FILE, {});
    rollConfig = load(ROLL_CONFIG_FILE, { cost: 50 });
    repoAlerts = load(REPO_ALERTS_FILE, { channelId: null, lastTag: null });
    giveaways = load(GIVEAWAYS_FILE, {});
    boosts = load(BOOSTS_FILE, {});
    dailyRolls = load(DAILY_ROLLS_FILE, {});
    bonusRolls = load(BONUS_ROLLS_FILE, {});
}
loadAll();
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const saveBalances = () => save(BALANCES_FILE, balancesCache);
const saveDaily = () => save(DAILY_FILE, dailyCache);
const saveRollCfg = () => save(ROLL_CONFIG_FILE, rollConfig);
const saveRepoAlerts = () => save(REPO_ALERTS_FILE, repoAlerts);
const saveGiveaways = () => save(GIVEAWAYS_FILE, giveaways);
const saveBoosts = () => save(BOOSTS_FILE, boosts);
const saveDailyRolls = () => save(DAILY_ROLLS_FILE, dailyRolls);
const saveBonusRolls = () => save(BONUS_ROLLS_FILE, bonusRolls);
function loadCookies() {
    try {
        if (fs.existsSync(COOKIES_FILE))
            return JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8')).cookies || '';
    }
    catch { }
    return '';
}
function saveCookies(cookies, by) {
    fs.writeFileSync(COOKIES_FILE, JSON.stringify({ cookies, updatedAt: new Date().toISOString(), updatedBy: by }, null, 2));
}
onlinefix_1.OnlineFixEngine.configure(INDEX_FILE, loadCookies);
// ==========================================
// ECONOMY
// ==========================================
const isOwner = (userId) => userId === OWNER_ID;
function getBalance(userId) {
    if (isOwner(userId))
        return 999_999_999_999;
    if (!(userId in balancesCache)) {
        balancesCache[userId] = 10;
        saveBalances();
    }
    return balancesCache[userId];
}
function updateBalance(userId, amount) {
    if (isOwner(userId))
        return 999_999_999_999;
    balancesCache[userId] = (balancesCache[userId] || 0) + amount;
    saveBalances();
    return balancesCache[userId];
}
// ==========================================
// DAILY ROLL TRACKING
// ==========================================
const todayStr = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
function getRollsUsedToday(userId) {
    if (isOwner(userId))
        return 0;
    const rec = dailyRolls[userId];
    if (!rec || rec.date !== todayStr())
        return 0;
    return rec.count;
}
function incrementDailyRolls(userId) {
    if (isOwner(userId))
        return 0;
    const today = todayStr();
    if (!dailyRolls[userId] || dailyRolls[userId].date !== today)
        dailyRolls[userId] = { date: today, count: 0 };
    dailyRolls[userId].count++;
    saveDailyRolls();
    return dailyRolls[userId].count;
}
function getBonusRolls(userId) {
    if (isOwner(userId))
        return 999;
    return bonusRolls[userId] || 0;
}
function addBonusRolls(userId, amount) {
    bonusRolls[userId] = (bonusRolls[userId] || 0) + amount;
    saveBonusRolls();
}
function consumeBonusRoll(userId) {
    if (isOwner(userId))
        return true;
    if ((bonusRolls[userId] || 0) <= 0)
        return false;
    bonusRolls[userId]--;
    saveBonusRolls();
    return true;
}
// ==========================================
// AD TOKENS
// ==========================================
function getBaseUrl() {
    return process.env.BASE_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:3000');
}
function createAdToken(userId) {
    // Invalidate any previous unclaimed token for this user
    for (const [tok, entry] of adTokens) {
        if (entry.userId === userId && !entry.claimed)
            adTokens.delete(tok);
    }
    const token = crypto.randomBytes(24).toString('hex');
    adTokens.set(token, {
        userId,
        expiresAt: Date.now() + 15 * 60_000, // 15 minutes
        claimed: false,
        createdAt: Date.now()
    });
    return token;
}
function adWatchUrl(userId) {
    const token = createAdToken(userId);
    return `${getBaseUrl()}/ad?token=${token}`;
}
// Clean up expired tokens every 5 minutes
setInterval(() => {
    for (const [tok, entry] of adTokens) {
        if (Date.now() > entry.expiresAt)
            adTokens.delete(tok);
    }
}, 5 * 60_000);
// ==========================================
// BOOSTS
// ==========================================
function getActiveBoosts(userId) {
    const now = Date.now();
    boosts[userId] = (boosts[userId] || []).filter(b => new Date(b.expiresAt).getTime() > now);
    return boosts[userId];
}
function addBoost(userId, type, hours = 24) {
    const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    boosts[userId] = [...(boosts[userId] || []), { type, expiresAt }];
    saveBoosts();
}
function consumeBoost(userId, type) {
    const list = getActiveBoosts(userId);
    const idx = list.findIndex(b => b.type === type);
    if (idx === -1)
        return false;
    list.splice(idx, 1);
    boosts[userId] = list;
    saveBoosts();
    return true;
}
// ==========================================
// SHOP
// ==========================================
const SHOP_ITEMS = [
    { id: 'luck_boost', name: '🍀 Luck Boost', desc: '2× roll luck for 24h', price: 200 },
    { id: 'daily_boost', name: '⚡ Daily Boost', desc: 'Double your next /daily', price: 100 },
    { id: 'extra_rolls', name: '🎲 +5 Bonus Rolls', desc: '5 extra rolls beyond daily cap', price: 150 },
    { id: 'jackpot_key', name: '💎 Jackpot Key', desc: '2× luck for next 2 hours', price: 500 },
];
// ==========================================
// ROLL ADS
// ==========================================
const ROLL_ADS = [
    '📢 **ProjectDeathSeal** is out! Download with `/download`',
    '🎮 Grab Steam manifests free with `/gen <game>`',
    '🔥 Weekend? Roll Sat/Sun for a 2× luck multiplier!',
    '💰 Free Gen every day — use `/daily` to claim yours!',
    '🛒 Spend your Gen in `/shop` on boosts & power-ups!',
    '🎰 `/roulette` — 100 Gen for 10 random paid game manifests!',
    '🏆 Check the rich list with `/leaderboard`!',
    '⚡ Running low? Watch an ad with `/watchad` for a free roll!',
];
const randomAd = () => ROLL_ADS[Math.floor(Math.random() * ROLL_ADS.length)];
// ==========================================
// HELPERS
// ==========================================
const COLORS = { green: 0x00ff88, blue: 0x5865F2, cyan: 0x00aaff, yellow: 0xffaa00, red: 0xff4444, purple: 0x9b59b6, gold: 0xffd700, orange: 0xff8800 };
const embed = (title, color) => new discord_js_1.EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
const isAdmin = (i) => i.memberPermissions?.has(discord_js_1.PermissionFlagsBits.Administrator) ?? false;
const isWeekend = () => { const d = new Date().getDay(); return d === 0 || d === 6; };
async function fetchSteam(appId) {
    const r = await axios_1.default.get(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`, { timeout: 5000 });
    if (!r.data[appId]?.success)
        throw new Error(`Steam App ID \`${appId}\` not found`);
    return r.data[appId].data;
}
const autoCache = new Map();
async function cachedAuto(key, fetcher, ttl = 30000) {
    const cached = autoCache.get(key);
    if (cached && Date.now() - cached.time < ttl)
        return cached.data;
    const data = await fetcher();
    autoCache.set(key, { data, time: Date.now() });
    return data;
}
async function genAutocomplete(focused) {
    const choices = [];
    const seen = new Set();
    const add = (id, name) => { if (!seen.has(id) && choices.length < 25) {
        seen.add(id);
        choices.push({ name: `${name} (${id})`.slice(0, 100), value: id });
    } };
    try {
        const data = await cachedAuto(`gen_${focused}`, async () => { await fares_1.FaresEngine.loadCatalog(); return { fares: fares_1.FaresEngine.searchCatalog(focused, 15), steam: await (0, steam_1.searchSteamGames)(focused, 15) }; });
        data.fares.forEach((g) => add(g.id, g.name));
        data.steam.forEach((g) => add(g.id, g.name));
    }
    catch { }
    if (!choices.length)
        for (const g of (0, steam_1.popularGames)())
            add(g.id, g.name);
    return choices;
}
async function gameAutocomplete(focused) {
    const choices = [];
    const seen = new Set();
    const add = (n) => { if (!seen.has(n.toLowerCase()) && choices.length < 25) {
        seen.add(n.toLowerCase());
        choices.push({ name: n.slice(0, 100), value: n });
    } };
    if (focused) {
        try {
            (await cachedAuto(`game_${focused}`, async () => await (0, steam_1.searchSteamGames)(focused, 25))).forEach((g) => add(g.name));
        }
        catch { }
    }
    else
        for (const g of (0, steam_1.popularGames)())
            add(g.name);
    return choices;
}
// ==========================================
// HTML PAGES
// ==========================================
function adPageHtml(token, valid, alreadyClaimed = false) {
    const hasAdSense = ADSENSE_PUB_ID && !ADSENSE_PUB_ID.includes('REPLACE');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Watch Ad – Spoky's Bot</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:32px;max-width:520px;width:100%;text-align:center}
  h1{font-size:1.6rem;margin-bottom:8px;color:#58a6ff}
  p{color:#8b949e;margin-bottom:20px;line-height:1.5}
  .reward{background:#1f2e1f;border:1px solid #2ea043;border-radius:8px;padding:12px 20px;color:#3fb950;font-size:1.1rem;font-weight:600;margin-bottom:24px}
  .ad-zone{background:#21262d;border:2px dashed #30363d;border-radius:8px;padding:20px;min-height:120px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;color:#8b949e;font-size:.9rem}
  #timer-bar{background:#21262d;border-radius:8px;height:8px;overflow:hidden;margin-bottom:20px}
  #timer-fill{background:#58a6ff;height:100%;width:100%;transition:width 1s linear}
  #timer-text{color:#8b949e;font-size:.9rem;margin-bottom:16px}
  #claim-btn{display:none;background:#238636;color:#fff;border:none;border-radius:8px;padding:14px 32px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;transition:background .2s}
  #claim-btn:hover{background:#2ea043}
  #claim-btn:disabled{background:#21262d;color:#8b949e;cursor:not-allowed}
  .error{color:#f85149}
  .success{color:#3fb950}
  .logo{font-size:2rem;margin-bottom:12px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🎲</div>
  <h1>Spoky's Bot</h1>
  ${!valid ? `<p class="error">❌ This link has expired or is invalid.<br>Use <strong>/watchad</strong> in Discord to get a new one.</p>` :
        alreadyClaimed ? `<p class="success">✅ You already claimed this reward!<br>Head back to Discord.</p>` : `
  <div class="reward">🎲 Reward: +${AD_REWARD} Bonus Roll${AD_REWARD !== 1 ? 's' : ''}</div>
  <p>Watch the ad below, then claim your free roll.<br>You can earn extra rolls beyond your 10-per-day limit this way!</p>
  <div class="ad-zone" id="ad-zone">
    ${hasAdSense ? `
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>
    <ins class="adsbygoogle" style="display:block;width:100%;min-height:100px" data-ad-client="${ADSENSE_PUB_ID}" data-ad-slot="${ADSENSE_SLOT_ID}" data-ad-format="rectangle" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    ` : `<div style="text-align:center"><div style="font-size:2rem">📺</div><div style="color:#58a6ff;font-weight:600;margin-top:8px">Ad Space</div><div style="font-size:.8rem;margin-top:4px">AdSense will appear here once configured</div></div>`}
  </div>
  <div id="timer-bar"><div id="timer-fill"></div></div>
  <div id="timer-text">Please wait <span id="secs">15</span>s…</div>
  <button id="claim-btn" onclick="claim()">🎲 Claim Your Free Roll</button>
  <p id="msg" style="margin-top:16px;font-size:.9rem"></p>
  <script>
    let secs = 15;
    const fill = document.getElementById('timer-fill');
    const text = document.getElementById('secs');
    const btn  = document.getElementById('claim-btn');
    const interval = setInterval(() => {
      secs--;
      if (fill) fill.style.width = (secs / 15 * 100) + '%';
      if (text) text.textContent = secs;
      if (secs <= 0) {
        clearInterval(interval);
        document.getElementById('timer-text').textContent = 'Ad complete! Claim your reward:';
        btn.style.display = 'block';
      }
    }, 1000);
    async function claim() {
      btn.disabled = true;
      btn.textContent = 'Claiming…';
      const res = await fetch('/ad/claim', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: '${token}' }) });
      const data = await res.json();
      const msg = document.getElementById('msg');
      if (data.ok) {
        btn.textContent = '✅ Claimed!';
        msg.innerHTML = '<span class="success">🎲 Your bonus roll has been added! Head back to Discord.</span>';
      } else {
        btn.disabled = false;
        btn.textContent = '🎲 Claim Your Free Roll';
        msg.innerHTML = '<span class="error">❌ ' + data.error + '</span>';
      }
    }
  </script>
  `}
</div>
</body>
</html>`;
}
function landingPageHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spoky's Bot – Discord Game Bot</title>
<meta name="description" content="A Discord bot for Steam manifests, game downloads, economy rolls, and giveaways.">
<meta name="google-adsense-account" content="ca-pub-4981846223446505">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4981846223446505" crossorigin="anonymous"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif}
  header{background:#161b22;border-bottom:1px solid #30363d;padding:20px 40px;display:flex;align-items:center;gap:16px}
  header h1{font-size:1.4rem;color:#58a6ff}
  .hero{padding:80px 40px;text-align:center;background:linear-gradient(135deg,#0d1117 0%,#161b22 100%)}
  .hero h2{font-size:2.4rem;font-weight:700;margin-bottom:16px}
  .hero p{color:#8b949e;font-size:1.1rem;max-width:560px;margin:0 auto 32px}
  .badge{display:inline-block;background:#238636;color:#fff;padding:4px 12px;border-radius:12px;font-size:.8rem;margin-bottom:16px}
  .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;padding:40px;max-width:1000px;margin:0 auto}
  .feat{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px}
  .feat h3{font-size:1.1rem;margin-bottom:8px;color:#58a6ff}
  .feat p{color:#8b949e;font-size:.9rem;line-height:1.5}
  .icon{font-size:1.8rem;margin-bottom:10px}
  footer{text-align:center;padding:32px;color:#8b949e;font-size:.85rem;border-top:1px solid #30363d;margin-top:40px}
  .ad-section{max-width:800px;margin:0 auto;padding:20px 40px;text-align:center}
  .ad-label{color:#8b949e;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
</style>
</head>
<body>
<header>
  <div style="font-size:1.8rem">🎲</div>
  <h1>Spoky's Bot</h1>
  <span style="margin-left:auto;color:#8b949e;font-size:.9rem">Discord Game Bot</span>
</header>
<div class="hero">
  <div class="badge">🎮 Gaming Bot</div>
  <h2>Steam Manifests, Rolls &amp; More</h2>
  <p>A feature-rich Discord bot for downloading game manifests, economy rolls, giveaways, and game library management — built for gamers.</p>
</div>
${ADSENSE_PUB_ID && !ADSENSE_PUB_ID.includes('REPLACE') ? `
<div class="ad-section">
  <div class="ad-label">Advertisement</div>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_PUB_ID}" data-ad-slot="${ADSENSE_SLOT_ID}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>` : ''}
<div class="features">
  <div class="feat"><div class="icon">📦</div><h3>Steam Manifests</h3><p>Fetch and download Steam game manifests instantly with <code>/gen</code>.</p></div>
  <div class="feat"><div class="icon">🎮</div><h3>Game Downloader</h3><p>Search SteamRIP & DODI Repacks for any game with <code>/game</code>.</p></div>
  <div class="feat"><div class="icon">🎲</div><h3>Economy & Rolls</h3><p>Earn Gen currency daily, roll the slots, and climb the leaderboard.</p></div>
  <div class="feat"><div class="icon">🎉</div><h3>Giveaways</h3><p>Host Discord giveaways with one command. Auto-draw winners.</p></div>
  <div class="feat"><div class="icon">📺</div><h3>Ad Rewards</h3><p>Watch an ad to earn bonus rolls beyond the 10-per-day limit.</p></div>
  <div class="feat"><div class="icon">🔔</div><h3>Release Alerts</h3><p>Get notified in your channel when a new ProjectDeathSeal update drops.</p></div>
</div>
<footer>Spoky's Bot &copy; ${new Date().getFullYear()} · Built with Discord.js</footer>
</body>
</html>`;
}
function privacyPageHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Privacy Policy – Spoky's Bot</title>
<style>body{background:#0d1117;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.7}h1,h2{color:#58a6ff;margin:24px 0 8px}p{color:#8b949e;margin-bottom:12px}a{color:#58a6ff}</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p>Last updated: ${new Date().toDateString()}</p>
<h2>Data Collected</h2>
<p>Spoky's Bot stores Discord user IDs and economy balances (Gen currency) in local JSON files for the purpose of operating the economy system. No personal information beyond Discord user IDs is collected.</p>
<h2>Advertising</h2>
<p>This site uses Google AdSense to serve advertisements. Google may use cookies to show relevant ads based on your visit to this site and other sites. You can opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads">Google Ad Settings</a>.</p>
<h2>Cookies</h2>
<p>Google AdSense may set cookies on your device. We do not set any cookies ourselves.</p>
<h2>Contact</h2>
<p>For questions, reach out via Discord.</p>
</body></html>`;
}
// ==========================================
// EXPRESS WEB SERVER
// ==========================================
const app = (0, express_1.default)();
app.use(express_1.default.json());
const keepAlivePort = parseInt(process.env.PORT || '3000', 10);
// Landing page (for AdSense site verification)
app.get('/', (_req, res) => res.send(landingPageHtml()));
app.get('/privacy', (_req, res) => res.send(privacyPageHtml()));
// Ad page
app.get('/ad', (req, res) => {
    const token = req.query.token || '';
    const entry = adTokens.get(token);
    const valid = !!(entry && Date.now() < entry.expiresAt);
    const claimed = entry?.claimed ?? false;
    res.send(adPageHtml(token, valid, claimed));
});
// Ad claim endpoint
app.post('/ad/claim', (req, res) => {
    const { token } = req.body;
    const entry = adTokens.get(token);
    if (!entry)
        return res.json({ ok: false, error: 'Invalid or expired token.' });
    if (Date.now() > entry.expiresAt)
        return res.json({ ok: false, error: 'Token expired. Use /watchad in Discord for a new link.' });
    if (entry.claimed)
        return res.json({ ok: false, error: 'Already claimed.' });
    entry.claimed = true;
    addBonusRolls(entry.userId, AD_REWARD);
    console.log(`[Ad] User ${entry.userId} claimed ${AD_REWARD} bonus roll(s) via ad`);
    res.json({ ok: true, reward: AD_REWARD });
});
// ads.txt — required by Google AdSense for publisher verification
app.get('/ads.txt', (_req, res) => {
    res.type('text/plain').send('google.com, pub-4981846223446505, DIRECT, f08c47fec0942fa0');
});
// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.listen(keepAlivePort, () => console.log(`[Web] Server running on port ${keepAlivePort}`));
// ==========================================
// COMMANDS
// ==========================================
const commands = [
    new discord_js_1.SlashCommandBuilder().setName('help').setDescription('Show all commands'),
    new discord_js_1.SlashCommandBuilder().setName('stats').setDescription('Bot statistics'),
    // Games
    new discord_js_1.SlashCommandBuilder().setName('gen').setDescription('Get Steam manifests as a zip')
        .addStringOption(o => o.setName('appid').setDescription('Steam App ID or game name').setRequired(true).setAutocomplete(true)),
    new discord_js_1.SlashCommandBuilder().setName('game').setDescription('Search SteamRIP & DODI Repacks')
        .addStringOption(o => o.setName('name').setDescription('Game name').setRequired(true).setAutocomplete(true)),
    // Economy
    new discord_js_1.SlashCommandBuilder().setName('balance').setDescription('Check your Gen balance'),
    new discord_js_1.SlashCommandBuilder().setName('daily').setDescription('Claim your daily Gen'),
    new discord_js_1.SlashCommandBuilder().setName('leaderboard').setDescription('Top Gen balances'),
    new discord_js_1.SlashCommandBuilder().setName('give').setDescription('Give/remove Gen [Admin]')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Amount (negative to remove)').setRequired(true)),
    // Gambling
    new discord_js_1.SlashCommandBuilder().setName('roll').setDescription(`Roll the slots (${DAILY_ROLL_CAP}/day limit, costs Gen)`),
    new discord_js_1.SlashCommandBuilder().setName('rollstatus').setDescription('Check your daily rolls remaining'),
    new discord_js_1.SlashCommandBuilder().setName('watchad').setDescription(`Watch an ad to earn ${AD_REWARD} bonus roll(s)`),
    new discord_js_1.SlashCommandBuilder().setName('roulette').setDescription('100 Gen for 10 random paid game manifests'),
    new discord_js_1.SlashCommandBuilder().setName('setrolls').setDescription('Configure roll cost [Admin]')
        .addIntegerOption(o => o.setName('cost').setDescription('New roll cost in Gen').setRequired(true).setMinValue(1)),
    // Shop
    new discord_js_1.SlashCommandBuilder().setName('shop').setDescription('Browse or buy from the Gen shop')
        .addSubcommand(s => s.setName('browse').setDescription('Browse available items'))
        .addSubcommand(s => s.setName('buy').setDescription('Buy an item')
        .addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true)
        .addChoices(...SHOP_ITEMS.map(it => ({ name: `${it.name} — ${it.price} Gen`, value: it.id }))))),
    // Giveaway
    new discord_js_1.SlashCommandBuilder().setName('giveaway').setDescription('Manage giveaways')
        .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
        .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10))
        .addStringOption(o => o.setName('title').setDescription('Giveaway title').setRequired(false)))
        .addSubcommand(s => s.setName('end').setDescription('End a giveaway early')
        .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand(s => s.setName('reroll').setDescription('Reroll a finished giveaway')
        .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true))),
    // Repo
    new discord_js_1.SlashCommandBuilder().setName('download').setDescription('Download the latest ProjectDeathSeal release'),
    new discord_js_1.SlashCommandBuilder().setName('setrepoalerts').setDescription('Set channel for repo update alerts [Admin]')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to post updates in').setRequired(true)
        .addChannelTypes(discord_js_1.ChannelType.GuildText)),
    // Admin
    new discord_js_1.SlashCommandBuilder().setName('refreshindex').setDescription('Rebuild online-fix.me index [Admin]'),
    new discord_js_1.SlashCommandBuilder().setName('updatecookies').setDescription('Update online-fix.me cookies [Admin]')
        .addStringOption(o => o.setName('cookies').setDescription('Cookie header').setRequired(true)),
];
// ==========================================
// HANDLERS
// ==========================================
async function handleHelp(i) {
    await i.reply({ embeds: [embed('📋 Command List', COLORS.purple)
                .addFields({ name: '🎮 Games', value: '`/gen` `/game`' }, { name: '💰 Economy', value: '`/balance` `/daily` `/leaderboard` `/give`' }, { name: '🎲 Gambling', value: `\`/roll\` *(${DAILY_ROLL_CAP}/day)* \`/roulette\` \`/rollstatus\` \`/setrolls\`` }, { name: '📺 Ad Rolls', value: `\`/watchad\` — watch an ad for +${AD_REWARD} bonus roll(s)` }, { name: '🛒 Shop', value: '`/shop browse` `/shop buy`' }, { name: '🎉 Giveaway', value: '`/giveaway start` `/giveaway end` `/giveaway reroll`' }, { name: '🔗 Repo', value: '`/download` `/setrepoalerts`' }, { name: '🔧 Admin', value: '`/refreshindex` `/updatecookies`' })], flags: [discord_js_1.MessageFlags.Ephemeral] });
}
async function handleStats(i) {
    await i.deferReply();
    const e = embed('📊 Bot Stats', COLORS.cyan).addFields({ name: 'Roll cost', value: `${rollConfig.cost} Gen`, inline: true }, { name: 'Daily roll cap', value: `${DAILY_ROLL_CAP} rolls/day`, inline: true }, { name: 'Ad bonus', value: `${AD_REWARD} roll(s) per ad`, inline: true }, { name: 'Economy players', value: `${Object.keys(balancesCache).length}`, inline: true }, { name: 'Active giveaways', value: `${Object.values(giveaways).filter(g => !g.ended).length}`, inline: true }, { name: 'Repo alerts', value: repoAlerts.channelId ? `<#${repoAlerts.channelId}>` : 'Not set', inline: true });
    await i.editReply({ embeds: [e] });
}
async function handleGen(i) {
    await i.deferReply({ flags: [discord_js_1.MessageFlags.Ephemeral] });
    const appId = i.options.getString('appid', true).trim();
    let steamName = appId, steamImage;
    try {
        const g = await fetchSteam(appId);
        steamName = g.name;
        steamImage = g.header_image;
    }
    catch { }
    await i.editReply({ content: `Fetching manifests for **${steamName}**...` });
    const result = await fares_1.FaresEngine.getManifests(appId);
    const e = embed(steamName, COLORS.purple).addFields({ name: 'App ID', value: `\`${appId}\``, inline: true });
    if (steamImage)
        e.setThumbnail(steamImage);
    if (result.error || !result.manifests.length) {
        e.addFields({ name: 'Manifests', value: result.error || 'No manifests found' });
        return i.editReply({ embeds: [e] });
    }
    e.addFields({ name: 'Manifests found', value: `${result.manifests.length} manifests from [fares.top](https://fares.top)` });
    await i.editReply({ content: `Downloading ${result.manifests.length} manifests...`, embeds: [e] });
    let fixText = 'Not found';
    try {
        const fixPage = await onlinefix_1.OnlineFixEngine.findGamePage(steamName);
        if (fixPage) {
            const fixInfo = await onlinefix_1.OnlineFixEngine.getDownloadInfo(fixPage);
            fixText = `**[🛠️ Fix page](${fixInfo.pageUrl})**\nPassword: \`${fixInfo.password}\``;
            if (fixInfo.downloads.length)
                fixText += `\n\n**Direct Links:**\n\`\`\`\n${fixInfo.downloads.map(d => d.url).join('\n')}\n\`\`\`\n*⚠️ Open the webpage link first or you'll get a 401.*`;
        }
    }
    catch {
        fixText = 'Error fetching online-fix.';
    }
    e.addFields({ name: 'Online-Fix (Multiplayer)', value: fixText, inline: false });
    const zip = await fares_1.FaresEngine.createManifestZip(appId, result.manifests, { maxSizeMb: 24 });
    if (!zip) {
        e.addFields({ name: 'Zip', value: 'Creation failed' });
        return i.editReply({ embeds: [e] });
    }
    e.addFields({ name: 'Zip ready', value: `${zip.fileCount} manifests bundled` });
    await i.editReply({ content: '', embeds: [e], files: [{ attachment: zip.buffer, name: `${appId}_manifests.zip` }] });
}
async function handleGame(i) {
    await i.deferReply();
    const query = i.options.getString('name', true).trim().replace(/[™®©]/g, '').trim();
    await i.editReply({ content: `Searching **${query}**...` });
    const scraped = await gamescraper_1.GameScraperEngine.scrapeByQuery(query);
    const e = embed(query, COLORS.blue);
    if (scraped.steamrip)
        e.addFields({ name: 'SteamRIP', value: `[Webpage](${scraped.steamrip.pageUrl})\n${scraped.steamrip.downloads.map(d => `[${d.label}](${d.url})`).join('\n') || 'No links'}`.slice(0, 1024) });
    if (scraped.dodi)
        e.addFields({ name: 'DODI Repacks', value: `[Webpage](${scraped.dodi.pageUrl})\n${scraped.dodi.downloads.map(d => `[${d.label}](${d.url})`).join('\n') || 'No links'}`.slice(0, 1024) });
    if (!scraped.steamrip && !scraped.dodi)
        return i.editReply({ embeds: [embed('No Results', COLORS.yellow).setDescription('Try a different spelling.')] });
    await i.editReply({ embeds: [e] });
}
async function handleBalance(i) {
    const bal = getBalance(i.user.id);
    const bonus = getBonusRolls(i.user.id);
    const used = getRollsUsedToday(i.user.id);
    const ownerNote = isOwner(i.user.id) ? '\n👑 **Owner — Infinite Gen & rolls**' : '';
    await i.reply({ embeds: [embed(`${i.user.username}'s Balance`, COLORS.gold)
                .setDescription(`**${isOwner(i.user.id) ? '∞' : bal} Gen** 💰${ownerNote}`)
                .addFields({ name: 'Rolls today', value: `${used}/${DAILY_ROLL_CAP}`, inline: true }, { name: 'Bonus rolls', value: `${isOwner(i.user.id) ? '∞' : bonus}`, inline: true })] });
}
async function handleLeaderboard(i) {
    await i.deferReply();
    const sorted = Object.entries(balancesCache).filter(([id]) => !isOwner(id)).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!sorted.length)
        return i.editReply({ content: 'No one has any Gen yet.' });
    const e = embed('🏆 Gen Leaderboard', COLORS.gold);
    let desc = '';
    for (let idx = 0; idx < sorted.length; idx++)
        desc += `**${idx + 1}.** <@${sorted[idx][0]}> — **${sorted[idx][1]} Gen**\n`;
    e.setDescription(desc);
    await i.editReply({ embeds: [e] });
}
async function handleDaily(i) {
    const last = dailyCache[i.user.id] ? new Date(dailyCache[i.user.id]) : null;
    if (last && (Date.now() - last.getTime()) / 3_600_000 < 24)
        return i.reply({ content: `Already claimed. Try again in **${(24 - (Date.now() - last.getTime()) / 3_600_000).toFixed(1)} hours**.`, flags: [discord_js_1.MessageFlags.Ephemeral] });
    dailyCache[i.user.id] = new Date().toISOString();
    saveDaily();
    let reward = 10;
    const hasBoost = consumeBoost(i.user.id, 'daily');
    if (hasBoost)
        reward *= 2;
    const newBal = updateBalance(i.user.id, reward);
    await i.reply({ embeds: [embed('✅ Daily Claimed!', COLORS.green)
                .setDescription(`+${reward} Gen 💰${hasBoost ? ' *(Daily Boost!)*' : ''}\nBalance: **${newBal} Gen**`)
        ] });
}
async function handleGive(i) {
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.reply({ content: 'Administrator required.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    const user = i.options.getUser('user', true);
    const amount = i.options.getInteger('amount', true);
    const newBal = updateBalance(user.id, amount);
    await i.reply({ embeds: [embed('💸 Gen Transfer', COLORS.green)
                .setDescription(`Gave **${amount} Gen** to ${user.username}.\nTheir balance: **${newBal} Gen**`)] });
}
async function handleRollStatus(i) {
    const used = getRollsUsedToday(i.user.id);
    const remaining = Math.max(0, DAILY_ROLL_CAP - used);
    const bonus = getBonusRolls(i.user.id);
    const url = adWatchUrl(i.user.id);
    const e = embed('🎲 Roll Status', COLORS.blue)
        .addFields({ name: 'Daily rolls used', value: `${used}/${DAILY_ROLL_CAP}`, inline: true }, { name: 'Daily rolls remaining', value: `${isOwner(i.user.id) ? '∞' : remaining}`, inline: true }, { name: 'Bonus rolls banked', value: `${isOwner(i.user.id) ? '∞' : bonus}`, inline: true })
        .setFooter({ text: 'Earn extra rolls by watching an ad with /watchad or the button below' });
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setLabel(`📺 Watch Ad (+${AD_REWARD} Roll)`).setStyle(discord_js_1.ButtonStyle.Link).setURL(url));
    await i.reply({ embeds: [e], components: [row], flags: [discord_js_1.MessageFlags.Ephemeral] });
}
async function handleRoll(i) {
    await i.deferReply();
    const used = getRollsUsedToday(i.user.id);
    const bonus = getBonusRolls(i.user.id);
    // Check daily cap — bonus rolls bypass it
    if (!isOwner(i.user.id) && used >= DAILY_ROLL_CAP && bonus <= 0) {
        const url = adWatchUrl(i.user.id);
        const e = embed('🚫 Daily Roll Limit Reached', COLORS.red)
            .setDescription(`You've used all **${DAILY_ROLL_CAP} daily rolls**.\n\nWatch an ad to earn **+${AD_REWARD} bonus roll** beyond the limit, or come back tomorrow!`)
            .setFooter({ text: `Resets at midnight UTC · /rollstatus to check your count` });
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setLabel(`📺 Watch Ad for +${AD_REWARD} Roll`).setStyle(discord_js_1.ButtonStyle.Link).setURL(url));
        return i.editReply({ embeds: [e], components: [row] });
    }
    const cost = rollConfig.cost;
    if (!isOwner(i.user.id))
        updateBalance(i.user.id, -cost);
    // Use a bonus roll if over the daily cap
    const usedBonus = !isOwner(i.user.id) && used >= DAILY_ROLL_CAP;
    if (usedBonus)
        consumeBonusRoll(i.user.id);
    incrementDailyRolls(i.user.id);
    const weekend = isWeekend();
    const hasLuck = getActiveBoosts(i.user.id).some(b => b.type === 'luck');
    const outcomes = weekend || hasLuck ? [
        { emoji: '💎', label: 'JACKPOT', value: 1000, weight: 0.5 },
        { emoji: '🌟', label: 'MEGA', value: 300, weight: 2 },
        { emoji: '🔥', label: 'BIG WIN', value: 100, weight: 5 },
        { emoji: '✅', label: 'WIN', value: 50, weight: 25 },
        { emoji: '📉', label: 'LOSS', value: -10, weight: 40 },
        { emoji: '💀', label: 'BIG LOSS', value: -30, weight: 20 },
        { emoji: '☠️', label: 'BUST', value: -cost, weight: 7.5 },
    ] : [
        { emoji: '💎', label: 'JACKPOT', value: 1000, weight: 0.1 },
        { emoji: '🌟', label: 'MEGA', value: 300, weight: 0.5 },
        { emoji: '🔥', label: 'BIG WIN', value: 100, weight: 3 },
        { emoji: '✅', label: 'WIN', value: 50, weight: 20 },
        { emoji: '📉', label: 'LOSS', value: -10, weight: 45 },
        { emoji: '💀', label: 'BIG LOSS', value: -30, weight: 22 },
        { emoji: '☠️', label: 'BUST', value: -cost, weight: 9.4 },
    ];
    const total = outcomes.reduce((s, o) => s + o.weight, 0);
    let rand = Math.random() * total;
    let chosen = outcomes[outcomes.length - 1];
    for (const o of outcomes) {
        rand -= o.weight;
        if (rand <= 0) {
            chosen = o;
            break;
        }
    }
    if (hasLuck)
        consumeBoost(i.user.id, 'luck');
    const newBal = updateBalance(i.user.id, chosen.value);
    const rollsLeft = Math.max(0, DAILY_ROLL_CAP - getRollsUsedToday(i.user.id));
    const bonusLeft = getBonusRolls(i.user.id);
    const color = chosen.value > 0 ? COLORS.green : chosen.value < -50 ? COLORS.red : COLORS.yellow;
    const e = embed('🎰 Slot Roll', color)
        .addFields({ name: 'Result', value: `${chosen.emoji} **${chosen.label}** — ${chosen.value > 0 ? '+' : ''}${chosen.value} Gen`, inline: true }, { name: 'Cost paid', value: `${cost} Gen${usedBonus ? ' *(bonus roll)*' : ''}`, inline: true }, { name: 'New Balance', value: `**${isOwner(i.user.id) ? '∞' : newBal} Gen**`, inline: true }, { name: 'Rolls left today', value: `${isOwner(i.user.id) ? '∞' : rollsLeft}/${DAILY_ROLL_CAP}`, inline: true }, { name: 'Bonus rolls', value: `${isOwner(i.user.id) ? '∞' : bonusLeft}`, inline: true })
        .setFooter({ text: `${weekend ? '🍀 Luck Weekend! ' : ''}${hasLuck ? '⚡ Luck Boost! ' : ''}${randomAd()}` });
    // If they're about to run out, show the ad button
    if (!isOwner(i.user.id) && rollsLeft === 0) {
        const url = adWatchUrl(i.user.id);
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setLabel(`📺 Watch Ad for +${AD_REWARD} Roll`).setStyle(discord_js_1.ButtonStyle.Link).setURL(url));
        return i.editReply({ embeds: [e], components: [row] });
    }
    await i.editReply({ embeds: [e] });
}
async function handleWatchAd(i) {
    const url = adWatchUrl(i.user.id);
    const used = getRollsUsedToday(i.user.id);
    const bonus = getBonusRolls(i.user.id);
    const e = embed('📺 Watch Ad for Bonus Rolls', COLORS.orange)
        .setDescription(`Click the button below to watch an ad and earn **+${AD_REWARD} bonus roll** — usable even after hitting the daily limit!\n\n*Link expires in 15 minutes.*`)
        .addFields({ name: 'Daily rolls used', value: `${used}/${DAILY_ROLL_CAP}`, inline: true }, { name: 'Bonus rolls banked', value: `${bonus}`, inline: true });
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setLabel(`📺 Watch Ad (+${AD_REWARD} Roll)`).setStyle(discord_js_1.ButtonStyle.Link).setURL(url));
    await i.reply({ embeds: [e], components: [row], flags: [discord_js_1.MessageFlags.Ephemeral] });
}
async function handleRoulette(i) {
    await i.deferReply({ flags: [discord_js_1.MessageFlags.Ephemeral] });
    const cost = 100;
    if (!isOwner(i.user.id))
        updateBalance(i.user.id, -cost);
    await i.editReply({ content: '🎰 Spinning… fetching 10 random paid game manifests!' });
    const zip = new adm_zip_1.default();
    let count = 0;
    let attempts = 0;
    while (count < 10 && attempts < 30) {
        attempts++;
        const appId = PAID_GAMES[Math.floor(Math.random() * PAID_GAMES.length)];
        try {
            const result = await fares_1.FaresEngine.getManifests(appId);
            if (result.manifests?.length) {
                const m = result.manifests[0];
                const buf = await fares_1.FaresEngine.downloadManifest(appId, m.depotId, m.manifestId);
                if (buf.length < 2 * 1024 * 1024) {
                    zip.addFile(`${appId}_${m.depotId}.manifest`, buf);
                    count++;
                }
            }
        }
        catch { }
    }
    if (count === 0) {
        if (!isOwner(i.user.id))
            updateBalance(i.user.id, cost);
        return i.editReply({ content: 'Failed to fetch games. Refunded 100 Gen.' });
    }
    await i.editReply({ content: '', embeds: [embed('🎰 Roulette Result', COLORS.gold).setDescription(`Won **${count}** paid game manifests!`).setFooter({ text: randomAd() })], files: [{ attachment: zip.toBuffer(), name: 'roulette_manifests.zip' }] });
}
async function handleSetRolls(i) {
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.reply({ content: 'Administrator required.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    rollConfig.cost = i.options.getInteger('cost', true);
    saveRollCfg();
    await i.reply({ embeds: [embed('⚙️ Roll Config Updated', COLORS.cyan).setDescription(`Roll cost set to **${rollConfig.cost} Gen**`)] });
}
async function handleShopBrowse(i) {
    const active = getActiveBoosts(i.user.id);
    const e = embed('🛒 Gen Shop', COLORS.blue).setDescription('Spend Gen on power-ups!');
    for (const item of SHOP_ITEMS) {
        e.addFields({ name: `${item.name} — **${item.price} Gen**`, value: `${item.desc}\nID: \`${item.id}\``, inline: false });
    }
    e.setFooter({ text: 'Use /shop buy <item> to purchase' });
    await i.reply({ embeds: [e] });
}
async function handleShopBuy(i) {
    const itemId = i.options.getString('item', true);
    const item = SHOP_ITEMS.find(s => s.id === itemId);
    if (!item)
        return i.reply({ content: 'Unknown item.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    const bal = getBalance(i.user.id);
    if (!isOwner(i.user.id) && bal < item.price)
        return i.reply({ content: `You need **${item.price} Gen** but have **${bal} Gen**.`, flags: [discord_js_1.MessageFlags.Ephemeral] });
    if (!isOwner(i.user.id))
        updateBalance(i.user.id, -item.price);
    if (item.id === 'luck_boost')
        addBoost(i.user.id, 'luck', 24);
    if (item.id === 'daily_boost')
        addBoost(i.user.id, 'daily', 48);
    if (item.id === 'extra_rolls')
        addBonusRolls(i.user.id, 5);
    if (item.id === 'jackpot_key')
        addBoost(i.user.id, 'luck', 2);
    await i.reply({ embeds: [embed('✅ Purchased!', COLORS.green).setDescription(`You bought **${item.name}**!\n${item.desc}`)] });
}
// ==========================================
// GIVEAWAY
// ==========================================
async function handleGiveawayStart(i) {
    await i.deferReply();
    const prize = i.options.getString('prize', true);
    const duration = i.options.getInteger('duration', true);
    const winnerCount = i.options.getInteger('winners') ?? 1;
    const title = i.options.getString('title') ?? '🎉 GIVEAWAY 🎉';
    const endAt = new Date(Date.now() + duration * 60_000);
    const e = embed(title, COLORS.orange)
        .setDescription(`**Prize:** ${prize}\n\nClick 🎉 below to enter!\n\n**Ends:** <t:${Math.floor(endAt.getTime() / 1000)}:R>`)
        .addFields({ name: 'Winners', value: `${winnerCount}`, inline: true }, { name: 'Hosted by', value: `<@${i.user.id}>`, inline: true });
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('giveaway:enter').setLabel('🎉 Enter').setStyle(discord_js_1.ButtonStyle.Primary));
    const msg = await i.editReply({ embeds: [e], components: [row] });
    giveaways[msg.id] = { messageId: msg.id, channelId: i.channelId, hostId: i.user.id, prize, title, endAt: endAt.toISOString(), winnerCount, entries: [], ended: false };
    saveGiveaways();
    setTimeout(() => endGiveaway(msg.id, i.client), duration * 60_000);
}
async function endGiveaway(msgId, client, _forced = false) {
    const g = giveaways[msgId];
    if (!g || g.ended)
        return;
    g.ended = true;
    saveGiveaways();
    try {
        const ch = await client.channels.fetch(g.channelId);
        const msg = await ch.messages.fetch(g.messageId);
        let desc = `**Prize:** ${g.prize}\n`;
        if (!g.entries.length) {
            desc += '\n❌ No entries.';
        }
        else {
            const winners = [...g.entries].sort(() => Math.random() - .5).slice(0, g.winnerCount);
            desc += `\n🏆 **Winners:** ${winners.map(id => `<@${id}>`).join(', ')}\n\nCongratulations! 🎉`;
            await ch.send({ content: `🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${g.prize}**!` });
        }
        const e = embed(g.title, COLORS.gold).setDescription(desc).setFooter({ text: `Ended · ${g.entries.length} entries` });
        await msg.edit({ embeds: [e], components: [] });
    }
    catch (err) {
        console.error('[Giveaway]', err);
    }
}
async function handleGiveawayEnd(i) {
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.reply({ content: 'Administrator required.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    const msgId = i.options.getString('message_id', true).trim();
    const g = giveaways[msgId];
    if (!g)
        return i.reply({ content: 'Not found.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    if (g.ended)
        return i.reply({ content: 'Already ended.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    await endGiveaway(msgId, i.client, true);
    await i.reply({ content: '✅ Giveaway ended.', flags: [discord_js_1.MessageFlags.Ephemeral] });
}
async function handleGiveawayReroll(i) {
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.reply({ content: 'Administrator required.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    const msgId = i.options.getString('message_id', true).trim();
    const g = giveaways[msgId];
    if (!g || !g.ended || !g.entries.length)
        return i.reply({ content: 'Cannot reroll this giveaway.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    const winners = [...g.entries].sort(() => Math.random() - .5).slice(0, g.winnerCount).map(id => `<@${id}>`).join(', ');
    await i.reply({ content: `🎉 Rerolled! New winner${g.winnerCount > 1 ? 's' : ''}: ${winners}` });
}
// ==========================================
// REPO / DOWNLOAD
// ==========================================
async function fetchLatestRelease() {
    const r = await axios_1.default.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, { timeout: 8000, headers: { 'User-Agent': 'DiscordBot/1.0', Accept: 'application/vnd.github+json' } });
    return r.data;
}
async function handleDownload(i) {
    await i.deferReply();
    try {
        const rel = await fetchLatestRelease();
        const e = embed(`📦 ${REPO_NAME} — ${rel.tag_name}`, COLORS.cyan)
            .setDescription((rel.body || 'No notes.').slice(0, 1000))
            .addFields({ name: 'Published', value: `<t:${Math.floor(new Date(rel.published_at).getTime() / 1000)}:R>`, inline: true })
            .setURL(rel.html_url);
        if (rel.assets?.length)
            e.addFields({ name: '⬇️ Downloads', value: rel.assets.map((a) => `[${a.name}](${a.browser_download_url}) *(${(a.size / 1_048_576).toFixed(1)} MB)*`).join('\n').slice(0, 1024) });
        else
            e.addFields({ name: '⬇️ Downloads', value: `[View Release](${rel.html_url})` });
        await i.editReply({ embeds: [e] });
    }
    catch (err) {
        await i.editReply({ content: `Failed: ${err.message}` });
    }
}
async function handleSetRepoAlerts(i) {
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.reply({ content: 'Administrator required.', flags: [discord_js_1.MessageFlags.Ephemeral] });
    const ch = i.options.getChannel('channel', true);
    repoAlerts.channelId = ch.id;
    saveRepoAlerts();
    await i.reply({ embeds: [embed('✅ Repo Alerts Set', COLORS.green).setDescription(`Updates for **${REPO_OWNER}/${REPO_NAME}** → <#${ch.id}>`)] });
}
async function pollRepoUpdates(client) {
    if (!repoAlerts.channelId)
        return;
    try {
        const rel = await fetchLatestRelease();
        if (repoAlerts.lastTag && rel.tag_name === repoAlerts.lastTag)
            return;
        repoAlerts.lastTag = rel.tag_name;
        saveRepoAlerts();
        const ch = await client.channels.fetch(repoAlerts.channelId);
        const e = embed(`🚀 New Release: ${REPO_NAME} ${rel.tag_name}`, COLORS.orange)
            .setDescription((rel.body || 'No notes.').slice(0, 1000)).setURL(rel.html_url)
            .addFields({ name: 'Published', value: `<t:${Math.floor(new Date(rel.published_at).getTime() / 1000)}:R>` });
        if (rel.assets?.length)
            e.addFields({ name: '⬇️ Downloads', value: rel.assets.map((a) => `[${a.name}](${a.browser_download_url})`).join('\n').slice(0, 1024) });
        await ch.send({ content: `@everyone 🚀 **${REPO_NAME}** has a new release!`, embeds: [e] });
    }
    catch (err) {
        console.error('[RepoPoller]', err.message);
    }
}
async function handleRefreshIndex(i) {
    await i.deferReply({ flags: [discord_js_1.MessageFlags.Ephemeral] });
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.editReply({ content: 'Admin required.' });
    await i.editReply({ content: 'Building index...' });
    const idx = await onlinefix_1.OnlineFixEngine.buildIndex(() => { });
    await i.editReply({ embeds: [embed('Index Refreshed', COLORS.green).addFields({ name: 'Games indexed', value: `${idx.gameCount}` })] });
}
async function handleUpdateCookies(i) {
    await i.deferReply({ flags: [discord_js_1.MessageFlags.Ephemeral] });
    if (!isAdmin(i) && !isOwner(i.user.id))
        return i.editReply({ content: 'Admin required.' });
    saveCookies(i.options.getString('cookies', true).trim(), i.user.tag);
    await i.editReply({ embeds: [embed('Cookies Updated', COLORS.green)] });
}
// ==========================================
// BOT INIT
// ==========================================
const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds] });
process.on('unhandledRejection', (r, p) => console.error('Unhandled Rejection:', p, r));
process.on('uncaughtException', e => console.error('Uncaught Exception:', e));
client.on('error', e => console.error('Client Error:', e));
client.once(discord_js_1.Events.ClientReady, async () => {
    console.log(`Bot online: ${client.user?.tag}`);
    await fares_1.FaresEngine.loadCatalog();
    // Register guild commands
    try {
        const rest = new discord_js_1.REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.put(discord_js_1.Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands.map(c => c.toJSON()) });
        console.log(`Registered ${commands.length} commands to guild ${GUILD_ID}`);
    }
    catch (e) {
        console.error('Cmd registration failed', e);
    }
    // Resume pending giveaway timers
    const now = Date.now();
    for (const [msgId, g] of Object.entries(giveaways)) {
        if (!g.ended) {
            const rem = new Date(g.endAt).getTime() - now;
            rem <= 0 ? endGiveaway(msgId, client) : setTimeout(() => endGiveaway(msgId, client), rem);
        }
    }
    setInterval(() => pollRepoUpdates(client), 10 * 60_000);
    pollRepoUpdates(client);
    console.log(`[Ad] Base URL: ${getBaseUrl()}`);
});
client.on('interactionCreate', async (i) => {
    // Guild guard
    if (i.guildId !== GUILD_ID) {
        if (i.isRepliable())
            try {
                await i.reply({ content: '❌ This bot only works in its home server.', flags: [discord_js_1.MessageFlags.Ephemeral] });
            }
            catch { }
        return;
    }
    if (i.isAutocomplete()) {
        try {
            if (i.commandName === 'gen')
                return i.respond(await genAutocomplete(i.options.getFocused()));
            if (i.commandName === 'game')
                return i.respond(await gameAutocomplete(i.options.getFocused()));
        }
        catch { }
        return i.respond([]);
    }
    if (i.isButton() && i.customId === 'giveaway:enter') {
        const btn = i;
        const g = giveaways[btn.message.id];
        if (!g || g.ended)
            return btn.reply({ content: 'This giveaway has ended.', flags: [discord_js_1.MessageFlags.Ephemeral] });
        if (g.entries.includes(btn.user.id))
            return btn.reply({ content: 'You are already entered!', flags: [discord_js_1.MessageFlags.Ephemeral] });
        g.entries.push(btn.user.id);
        saveGiveaways();
        return btn.reply({ content: `✅ Entered! **${g.entries.length}** total entries.`, flags: [discord_js_1.MessageFlags.Ephemeral] });
    }
    if (!i.isChatInputCommand())
        return;
    try {
        switch (i.commandName) {
            case 'help':
                await handleHelp(i);
                break;
            case 'stats':
                await handleStats(i);
                break;
            case 'gen':
                await handleGen(i);
                break;
            case 'game':
                await handleGame(i);
                break;
            case 'balance':
                await handleBalance(i);
                break;
            case 'daily':
                await handleDaily(i);
                break;
            case 'leaderboard':
                await handleLeaderboard(i);
                break;
            case 'give':
                await handleGive(i);
                break;
            case 'roll':
                await handleRoll(i);
                break;
            case 'rollstatus':
                await handleRollStatus(i);
                break;
            case 'watchad':
                await handleWatchAd(i);
                break;
            case 'roulette':
                await handleRoulette(i);
                break;
            case 'setrolls':
                await handleSetRolls(i);
                break;
            case 'download':
                await handleDownload(i);
                break;
            case 'setrepoalerts':
                await handleSetRepoAlerts(i);
                break;
            case 'refreshindex':
                await handleRefreshIndex(i);
                break;
            case 'updatecookies':
                await handleUpdateCookies(i);
                break;
            case 'shop':
                if (i.options.getSubcommand() === 'browse')
                    await handleShopBrowse(i);
                if (i.options.getSubcommand() === 'buy')
                    await handleShopBuy(i);
                break;
            case 'giveaway':
                if (i.options.getSubcommand() === 'start')
                    await handleGiveawayStart(i);
                if (i.options.getSubcommand() === 'end')
                    await handleGiveawayEnd(i);
                if (i.options.getSubcommand() === 'reroll')
                    await handleGiveawayReroll(i);
                break;
        }
    }
    catch (e) {
        console.error(`[${i.commandName}]`, e);
        try {
            if (i.replied || i.deferred)
                await i.editReply({ content: 'Something went wrong.' });
            else
                await i.reply({ content: 'Something went wrong.', flags: [discord_js_1.MessageFlags.Ephemeral] });
        }
        catch { }
    }
});
console.log('=========================================');
console.log('Token check - Length:', BOT_TOKEN.length);
console.log('Attempting to call client.login()...');
const loginTimeout = setTimeout(() => console.error('Login timed out.'), 15000);
client.login(BOT_TOKEN)
    .then(() => { clearTimeout(loginTimeout); console.log('client.login() successful!'); })
    .catch(err => { clearTimeout(loginTimeout); console.error('Failed to login:', err); });
