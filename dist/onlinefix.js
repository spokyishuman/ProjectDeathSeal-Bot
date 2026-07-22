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
exports.OnlineFixEngine = void 0;
exports.normalizeName = normalizeName;
exports.importantWords = importantWords;
exports.slugify = slugify;
exports.scoreMatch = scoreMatch;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const BASE = 'https://online-fix.me';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CATEGORIES = ['officialservers', 'vr', 'survival', 'adventures', 'horror', 'action', 'racing', 'rpg', 'shooter', 'simulator', 'strategy', 'fighting', 'sandbox', 'arcade', 'puzzles'];
const FILLER_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'with', 'game', 'games', 'online', 'edition', 'definitive', 'deluxe', 'remastered', 'remaster', 'hd', 'goty', 'by', 'po', 'seti', 'multiplayer', 'coop', 'co-op']);
const GAME_LINK_RE = /href="(?:https:\/\/online-fix\.me)?(\/games\/([^/]+)\/\d+-([^"]+)\.html)"[^>]*(?:title="([^"]*)")?/gi;
function log(tag, msg) { console.log(`[${tag}] ${msg}`); }
function normalizeName(input) {
    return input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function importantWords(input) {
    return normalizeName(input).split(' ').filter(w => w.length > 1 && !FILLER_WORDS.has(w));
}
function slugify(input) {
    return normalizeName(input).replace(/\s+/g, '-').replace(/-+/g, '-');
}
function scoreMatch(query, title, slug) {
    const qWords = importantWords(query);
    if (!qWords.length)
        return 0;
    const titleNorm = normalizeName(title);
    const slugNorm = normalizeName(slug.replace(/-/g, ' '));
    const queryNorm = normalizeName(query);
    const allTokens = [...importantWords(title), ...importantWords(slug.replace(/-/g, ' '))];
    const allMatch = qWords.every(w => allTokens.some(t => t === w || t.includes(w) || w.includes(t)) || titleNorm.includes(w) || slugNorm.includes(w));
    if (!allMatch)
        return 0;
    let score = 0;
    if (titleNorm === queryNorm)
        score += 100;
    else if (slugify(query) === slug.replace(/-po-seti.*$/, '').replace(/-online.*$/, ''))
        score += 90;
    else if (qWords.every(w => allTokens.some(t => t === w || t.includes(w))))
        score += 80;
    else
        score += 50;
    return score;
}
class OnlineFixEngine {
    static memoryCache = new Map();
    static index = null;
    static indexPath = '';
    static loadCookies = () => '';
    static indexBuilding = false;
    static configure(indexPath, loadCookies) {
        this.indexPath = indexPath;
        this.loadCookies = loadCookies;
        this.loadIndexFromDisk();
    }
    static headers(extra = {}) {
        const c = this.loadCookies();
        return {
            'User-Agent': UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: BASE,
            ...(c ? { Cookie: c } : {}),
            ...extra
        };
    }
    static loadIndexFromDisk() {
        try {
            if (fs.existsSync(this.indexPath)) {
                this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
                log('INDEX', `loaded ${this.index?.gameCount ?? 0} games`);
                return this.index;
            }
        }
        catch { }
        return null;
    }
    static saveIndex(catalog) {
        const entries = {};
        for (const g of catalog) {
            const k = new Set([
                normalizeName(g.title || g.slug.replace(/-/g, ' ')),
                normalizeName(g.slug.replace(/-po-seti.*$/i, '').replace(/-online.*$/i, '').replace(/-/g, ' '))
            ]);
            for (const key of k)
                if (key.length > 1)
                    entries[key] = g.url;
        }
        this.index = { builtAt: new Date().toISOString(), gameCount: catalog.length, entries, catalog };
        fs.mkdirSync(path.dirname(this.indexPath), { recursive: true });
        fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
    }
    static async request(label, config, retries = 3) {
        for (let a = 1; a <= retries; a++) {
            try {
                const res = await (0, axios_1.default)({ timeout: 20000, validateStatus: () => true, ...config });
                if (res.status >= 500)
                    throw new Error(`HTTP ${res.status}`);
                return res.data;
            }
            catch (e) {
                if (a === retries)
                    throw e;
                await new Promise(r => setTimeout(r, 800 * a));
            }
        }
        throw new Error('Failed');
    }
    static parseGames(html) {
        const games = [];
        const seen = new Set();
        for (const m of html.matchAll(GAME_LINK_RE)) {
            const p = m[1];
            if (seen.has(p))
                continue;
            seen.add(p);
            games.push({ url: `${BASE}${p}`, path: p, category: m[2], slug: m[3], title: (m[4] || '').replace(/\s*по\s*сети.*/i, '').trim() });
        }
        return games;
    }
    static async crawlListing(listUrl, label) {
        const found = new Map();
        const first = await this.request(label, { method: 'GET', url: listUrl, headers: this.headers() });
        for (const g of this.parseGames(first))
            found.set(g.path, g);
        const postHeaders = this.headers({ 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: listUrl });
        for (let p = 1; p <= 500; p++) {
            const d = await this.request(`${label} p${p}`, { method: 'POST', url: listUrl, data: `show_more=${p}`, headers: postHeaders });
            if (typeof d !== 'object' || !d.content)
                break;
            const before = found.size;
            for (const g of this.parseGames(d.content))
                found.set(g.path, g);
            if (found.size === before)
                break;
        }
        return [...found.values()];
    }
    static async buildIndex(onProgress) {
        if (this.indexBuilding)
            throw new Error('Already building');
        this.indexBuilding = true;
        try {
            const all = new Map();
            const prog = (m) => { log('CRAWL', m); onProgress?.(m); };
            const main = await this.crawlListing(`${BASE}/games/`, 'main');
            for (const g of main)
                all.set(g.path, g);
            if (main.length < 50) {
                for (const c of CATEGORIES) {
                    const games = await this.crawlListing(`${BASE}/games/${c}/`, c);
                    for (const g of games)
                        all.set(g.path, g);
                }
            }
            this.saveIndex([...all.values()]);
            return this.index;
        }
        finally {
            this.indexBuilding = false;
        }
    }
    static rankCandidates(query, games) {
        return games
            .map(g => ({ game: g, score: scoreMatch(query, g.title || g.slug.replace(/-/g, ' '), g.slug) }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);
    }
    static searchIndex(query) {
        const key = normalizeName(query);
        if (this.index?.entries[key])
            return { url: this.index.entries[key], score: 100 };
        if (!this.index?.catalog?.length)
            return undefined;
        const ranked = this.rankCandidates(query, this.index.catalog);
        return ranked.length ? { url: ranked[0].game.url, score: ranked[0].score } : undefined;
    }
    static async searchLive(query) {
        const urls = [
            `${BASE}/?s=${encodeURIComponent(query)}`,
            `${BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`
        ];
        const found = new Map();
        for (const u of urls) {
            try {
                const h = await this.request(u, { method: 'GET', url: u, headers: this.headers() });
                for (const g of this.parseGames(h))
                    found.set(g.path, g);
            }
            catch { }
        }
        return [...found.values()];
    }
    static async findGamePage(query, options = {}) {
        const key = normalizeName(query);
        if (this.memoryCache.has(key))
            return this.memoryCache.get(key);
        if (/^\d+$/.test(query.trim())) {
            const byId = await this.searchByAppId(query.trim());
            if (byId) {
                this.memoryCache.set(key, byId);
                return byId;
            }
        }
        let indexed = this.searchIndex(query);
        if (indexed) {
            this.memoryCache.set(key, indexed.url);
            return indexed.url;
        }
        const live = await this.searchLive(query);
        const ranked = this.rankCandidates(query, live);
        if (ranked.length) {
            this.memoryCache.set(key, ranked[0].game.url);
            return ranked[0].game.url;
        }
        if (!this.index?.catalog?.length || options.refreshIndex) {
            await this.buildIndex();
            indexed = this.searchIndex(query);
            if (indexed) {
                this.memoryCache.set(key, indexed.url);
                return indexed.url;
            }
        }
        return undefined;
    }
    static async searchByAppId(appId) {
        try {
            const h = await this.request('appid', { method: 'GET', url: `${BASE}/index.php?do=search&subaction=search&story=${appId}`, headers: this.headers() });
            const g = this.parseGames(h);
            return g[0]?.url;
        }
        catch {
            return undefined;
        }
    }
    static parseDownloadLinks(html) {
        const links = [];
        const seen = new Set();
        const add = (url, label) => {
            const n = url.startsWith('//') ? `https:${url}` : url;
            if (seen.has(n))
                return;
            seen.add(n);
            links.push({ label, url: n });
        };
        const btnRe = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*(?:btn|button|download)[^"]*"[^>]*>([^<]*)<\/a>/gi;
        for (const m of html.matchAll(btnRe)) {
            const href = m[1];
            if (href.includes('online-fix.me') || href.startsWith('magnet:') || href.includes('1fichier.com') || href.includes('mediafire.com') || href.includes('gofile.io') || href.includes('mega.nz') || href.includes('pixeldrain.com')) {
                // Hardcode clean English labels to prevent Cyrillic garbage text
                let label = 'Download Link';
                if (href.includes('hosters'))
                    label = 'Online-Fix Hosters';
                else if (href.includes('drive'))
                    label = 'Online-Fix Drive';
                else if (href.includes('uploads'))
                    label = 'Online-Fix Uploads';
                else if (href.startsWith('magnet:'))
                    label = 'Magnet Link';
                else if (href.includes('torrent'))
                    label = 'Torrent';
                add(href, label);
            }
        }
        const directPatterns = [
            { re: /href="(https:\/\/hosters\.online-fix\.me[^"]+)"/gi, label: 'Online-Fix Hosters' },
            { re: /href="(https:\/\/drive\.online-fix\.me[^"]+)"/gi, label: 'Online-Fix Drive' },
            { re: /href="(https:\/\/uploads\.online-fix\.me[^"]*\/uploads\/[^"]+)"/gi, label: 'Online-Fix Uploads' },
            { re: /href="(https:\/\/uploads\.online-fix\.me[^"]*\/torrents\/[^"]+)"/gi, label: 'Torrent' },
            { re: /href="(magnet:[^"]+)"/gi, label: 'Magnet Link' },
            { re: /href="(https:\/\/1fichier\.com[^"]+)"/gi, label: '1Fichier' },
            { re: /href="(https:\/\/gofile\.io[^"]+)"/gi, label: 'GoFile' },
            { re: /href="(https:\/\/mega\.nz[^"]+)"/gi, label: 'Mega' }
        ];
        for (const { re, label } of directPatterns) {
            for (const m of html.matchAll(re))
                add(m[1], label);
        }
        return links;
    }
    static async getDownloadInfo(pageUrl) {
        try {
            const html = await this.request(pageUrl, { method: 'GET', url: pageUrl, headers: this.headers() });
            const result = { pageUrl, password: 'online-fix.me', downloads: this.parseDownloadLinks(html) };
            if (result.downloads.length)
                result.downloadUrl = result.downloads[0].url;
            const ver = html.match(/Game version:\s*([^<]+)/i);
            if (ver)
                result.gameVersion = ver[1].trim();
            for (const p of [/password[:\s]+([^<\s]+)/i, /пароль[:\s]+([^<\s]+)/i]) {
                const m = html.match(p);
                if (m) {
                    result.password = m[1];
                    break;
                }
            }
            const sm = html.match(/(\d+[\.,]?\d*\s*(?:MB|GB))/i);
            if (sm)
                result.fileSize = sm[1];
            return result;
        }
        catch (e) {
            return { pageUrl, password: 'online-fix.me', downloads: [] };
        }
    }
    static async scrape(query) {
        const page = await this.findGamePage(query);
        if (!page)
            return undefined;
        const info = await this.getDownloadInfo(page);
        return info.downloads.find(d => d.url.includes('drive.online-fix.me'))?.url ||
            info.downloads.find(d => d.url.includes('uploads.online-fix.me'))?.url ||
            info.downloadUrl ||
            info.pageUrl;
    }
    static async probe(url) {
        try {
            const r = await axios_1.default.head(url, { timeout: 10000, validateStatus: () => true });
            return {
                accessible: r.status >= 200 && r.status < 400,
                size: r.headers['content-length'] ? parseInt(String(r.headers['content-length']), 10) : undefined
            };
        }
        catch {
            return { accessible: false };
        }
    }
    static getIndexStats() {
        return { gameCount: this.index?.gameCount ?? 0, builtAt: this.index?.builtAt };
    }
}
exports.OnlineFixEngine = OnlineFixEngine;
