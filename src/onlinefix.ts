import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://online-fix.me';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CATEGORIES = ['officialservers', 'vr', 'survival', 'adventures', 'horror', 'action', 'racing', 'rpg', 'shooter', 'simulator', 'strategy', 'fighting', 'sandbox', 'arcade', 'puzzles'];
const FILLER_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'with', 'game', 'games', 'online', 'edition', 'definitive', 'deluxe', 'remastered', 'remaster', 'hd', 'goty', 'by', 'po', 'seti', 'multiplayer', 'coop', 'co-op']);
const GAME_LINK_RE = /href="(?:https:\/\/online-fix\.me)?(\/games\/([^/]+)\/\d+-([^"]+)\.html)"[^>]*(?:title="([^"]*)")?/gi;

export interface IndexGame { url: string; path: string; title: string; slug: string; category: string; }
export interface OnlineFixIndexFile { builtAt: string; gameCount: number; entries: Record<string, string>; catalog: IndexGame[]; }
export interface DownloadLink { label: string; url: string; }
export interface DownloadInfo { downloadUrl?: string; downloads: DownloadLink[]; password: string; pageUrl: string; fileSize?: string; gameVersion?: string; }

function log(tag: string, msg: string): void { console.log(`[${tag}] ${msg}`); }

export function normalizeName(input: string): string {
    return input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function importantWords(input: string): string[] {
    return normalizeName(input).split(' ').filter(w => w.length > 1 && !FILLER_WORDS.has(w));
}

export function slugify(input: string): string {
    return normalizeName(input).replace(/\s+/g, '-').replace(/-+/g, '-');
}

export function scoreMatch(query: string, title: string, slug: string): number {
    const qWords = importantWords(query);
    if (!qWords.length) return 0;
    const titleNorm = normalizeName(title);
    const slugNorm = normalizeName(slug.replace(/-/g, ' '));
    const queryNorm = normalizeName(query);
    const allTokens = [...importantWords(title), ...importantWords(slug.replace(/-/g, ' '))];

    const allMatch = qWords.every(w => allTokens.some(t => t === w || t.includes(w) || w.includes(t)) || titleNorm.includes(w) || slugNorm.includes(w));
    if (!allMatch) return 0;

    let score = 0;
    if (titleNorm === queryNorm) score += 100;
    else if (slugify(query) === slug.replace(/-po-seti.*$/, '').replace(/-online.*$/, '')) score += 90;
    else if (qWords.every(w => allTokens.some(t => t === w || t.includes(w)))) score += 80;
    else score += 50;
    return score;
}

export class OnlineFixEngine {
    private static memoryCache = new Map<string, string>();
    private static index: OnlineFixIndexFile | null = null;
    private static indexPath = '';
    private static loadCookies: () => string = () => '';
    private static indexBuilding = false;

    static configure(indexPath: string, loadCookies: () => string): void {
        this.indexPath = indexPath;
        this.loadCookies = loadCookies;
        this.loadIndexFromDisk();
    }

    private static headers(extra: Record<string, string> = {}): Record<string, string> {
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

    static loadIndexFromDisk(): OnlineFixIndexFile | null {
        try {
            if (fs.existsSync(this.indexPath)) {
                this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
                log('INDEX', `loaded ${this.index?.gameCount ?? 0} games`);
                return this.index;
            }
        } catch {}
        return null;
    }

    private static saveIndex(catalog: IndexGame[]): void {
        const entries: Record<string, string> = {};
        for (const g of catalog) {
            const k = new Set([
                normalizeName(g.title || g.slug.replace(/-/g, ' ')),
                normalizeName(g.slug.replace(/-po-seti.*$/i, '').replace(/-online.*$/i, '').replace(/-/g, ' '))
            ]);
            for (const key of k) if (key.length > 1) entries[key] = g.url;
        }
        this.index = { builtAt: new Date().toISOString(), gameCount: catalog.length, entries, catalog };
        fs.mkdirSync(path.dirname(this.indexPath), { recursive: true });
        fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
    }

    private static async request<T = string>(label: string, config: AxiosRequestConfig, retries = 3): Promise<T> {
        for (let a = 1; a <= retries; a++) {
            try {
                const res = await axios({ timeout: 20000, validateStatus: () => true, ...config });
                if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
                return res.data as T;
            } catch (e: any) {
                if (a === retries) throw e;
                await new Promise(r => setTimeout(r, 800 * a));
            }
        }
        throw new Error('Failed');
    }

    private static parseGames(html: string): IndexGame[] {
        const games: IndexGame[] = [];
        const seen = new Set<string>();
        for (const m of html.matchAll(GAME_LINK_RE)) {
            const p = m[1];
            if (seen.has(p)) continue;
            seen.add(p);
            games.push({ url: `${BASE}${p}`, path: p, category: m[2], slug: m[3], title: (m[4] || '').replace(/\s*по\s*сети.*/i, '').trim() });
        }
        return games;
    }

    private static async crawlListing(listUrl: string, label: string): Promise<IndexGame[]> {
        const found = new Map<string, IndexGame>();
        const first = await this.request<string>(label, { method: 'GET', url: listUrl, headers: this.headers() });
        for (const g of this.parseGames(first)) found.set(g.path, g);

        const postHeaders = this.headers({ 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: listUrl });
        for (let p = 1; p <= 500; p++) {
            const d = await this.request<{ cstart?: number; content?: string }>(`${label} p${p}`, { method: 'POST', url: listUrl, data: `show_more=${p}`, headers: postHeaders });
            if (typeof d !== 'object' || !d.content) break;
            const before = found.size;
            for (const g of this.parseGames(d.content)) found.set(g.path, g);
            if (found.size === before) break;
        }
        return [...found.values()];
    }

    static async buildIndex(onProgress?: (msg: string) => void): Promise<OnlineFixIndexFile> {
        if (this.indexBuilding) throw new Error('Already building');
        this.indexBuilding = true;
        try {
            const all = new Map<string, IndexGame>();
            const prog = (m: string) => { log('CRAWL', m); onProgress?.(m); };
            const main = await this.crawlListing(`${BASE}/games/`, 'main');
            for (const g of main) all.set(g.path, g);
            if (main.length < 50) {
                for (const c of CATEGORIES) {
                    const games = await this.crawlListing(`${BASE}/games/${c}/`, c);
                    for (const g of games) all.set(g.path, g);
                }
            }
            this.saveIndex([...all.values()]);
            return this.index!;
        } finally {
            this.indexBuilding = false;
        }
    }

    private static rankCandidates(query: string, games: IndexGame[]): { game: IndexGame; score: number }[] {
        return games
            .map(g => ({ game: g, score: scoreMatch(query, g.title || g.slug.replace(/-/g, ' '), g.slug) }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);
    }

    private static searchIndex(query: string): { url: string; score: number } | undefined {
        const key = normalizeName(query);
        if (this.index?.entries[key]) return { url: this.index.entries[key], score: 100 };
        if (!this.index?.catalog?.length) return undefined;
        const ranked = this.rankCandidates(query, this.index.catalog);
        return ranked.length ? { url: ranked[0].game.url, score: ranked[0].score } : undefined;
    }

    private static async searchLive(query: string): Promise<IndexGame[]> {
        const urls = [
            `${BASE}/?s=${encodeURIComponent(query)}`,
            `${BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`
        ];
        const found = new Map<string, IndexGame>();
        for (const u of urls) {
            try {
                const h = await this.request<string>(u, { method: 'GET', url: u, headers: this.headers() });
                for (const g of this.parseGames(h)) found.set(g.path, g);
            } catch {}
        } 
        return [...found.values()];
    }

    static async findGamePage(query: string, options: { refreshIndex?: boolean } = {}): Promise<string | undefined> {
        const key = normalizeName(query);
        if (this.memoryCache.has(key)) return this.memoryCache.get(key);

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

    private static async searchByAppId(appId: string): Promise<string | undefined> {
        try {
            const h = await this.request<string>('appid', { method: 'GET', url: `${BASE}/index.php?do=search&subaction=search&story=${appId}`, headers: this.headers() });
            const g = this.parseGames(h);
            return g[0]?.url;
        } catch {
            return undefined;
        }
    }

    private static parseDownloadLinks(html: string): DownloadLink[] {
        const links: DownloadLink[] = [];
        const seen = new Set<string>();

        const add = (url: string, label: string) => {
            const n = url.startsWith('//') ? `https:${url}` : url;
            if (seen.has(n)) return;
            seen.add(n);
            links.push({ label, url: n });
        };

        const btnRe = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*(?:btn|button|download)[^"]*"[^>]*>([^<]*)<\/a>/gi;
        for (const m of html.matchAll(btnRe)) {
            const href = m[1];
            if (href.includes('online-fix.me') || href.startsWith('magnet:') || href.includes('1fichier.com') || href.includes('mediafire.com') || href.includes('gofile.io') || href.includes('mega.nz') || href.includes('pixeldrain.com')) {
                // Hardcode clean English labels to prevent Cyrillic garbage text
                let label = 'Download Link';
                if (href.includes('hosters')) label = 'Online-Fix Hosters';
                else if (href.includes('drive')) label = 'Online-Fix Drive';
                else if (href.includes('uploads')) label = 'Online-Fix Uploads';
                else if (href.startsWith('magnet:')) label = 'Magnet Link';
                else if (href.includes('torrent')) label = 'Torrent';
                add(href, label);
            }
        }

        const directPatterns: { re: RegExp; label: string }[] = [
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
            for (const m of html.matchAll(re)) add(m[1], label);
        }

        return links;
    }

    static async getDownloadInfo(pageUrl: string): Promise<DownloadInfo> {
        try {
            const html = await this.request<string>(pageUrl, { method: 'GET', url: pageUrl, headers: this.headers() });
            const result: DownloadInfo = { pageUrl, password: 'online-fix.me', downloads: this.parseDownloadLinks(html) };
            if (result.downloads.length) result.downloadUrl = result.downloads[0].url;

            const ver = html.match(/Game version:\s*([^<]+)/i);
            if (ver) result.gameVersion = ver[1].trim();

            for (const p of [/password[:\s]+([^<\s]+)/i, /пароль[:\s]+([^<\s]+)/i]) {
                const m = html.match(p);
                if (m) { result.password = m[1]; break; }
            }

            const sm = html.match(/(\d+[\.,]?\d*\s*(?:MB|GB))/i);
            if (sm) result.fileSize = sm[1];

            return result;
        } catch (e: any) {
            return { pageUrl, password: 'online-fix.me', downloads: [] };
        }
    }

    static async scrape(query: string): Promise<string | undefined> {
        const page = await this.findGamePage(query);
        if (!page) return undefined;
        const info = await this.getDownloadInfo(page);
        return info.downloads.find(d => d.url.includes('drive.online-fix.me'))?.url || 
               info.downloads.find(d => d.url.includes('uploads.online-fix.me'))?.url || 
               info.downloadUrl || 
               info.pageUrl;
    }

    static async probe(url: string): Promise<{ accessible: boolean; size?: number }> {
        try {
            const r = await axios.head(url, { timeout: 10000, validateStatus: () => true });
            return {
                accessible: r.status >= 200 && r.status < 400,
                size: r.headers['content-length'] ? parseInt(String(r.headers['content-length']), 10) : undefined
            };
        } catch {
            return { accessible: false };
        }
    }

    static getIndexStats(): { gameCount: number; builtAt?: string } {
        return { gameCount: this.index?.gameCount ?? 0, builtAt: this.index?.builtAt };
    }
}