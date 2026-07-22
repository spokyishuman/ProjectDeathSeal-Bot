"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameScraperEngine = void 0;
const onlinefix_1 = require("./onlinefix");
const cloudflare_1 = require("./cloudflare");
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
function log(tag, msg) { console.log(`[${tag}] ${msg}`); }
function scoreTitle(query, title) {
    const qWords = (0, onlinefix_1.importantWords)(query);
    if (!qWords.length)
        return 0;
    const titleNorm = (0, onlinefix_1.normalizeName)(title);
    const queryNorm = (0, onlinefix_1.normalizeName)(query);
    if (titleNorm === queryNorm)
        return 100;
    if (!qWords.every(w => titleNorm.includes(w)))
        return 0;
    return 50 + qWords.filter(w => titleNorm.includes(w)).length * 10;
}
function absUrl(base, href) {
    if (href.startsWith('http'))
        return href;
    if (href.startsWith('//'))
        return `https:${href}`;
    const root = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${root}${href.startsWith('/') ? '' : '/'}${href}`;
}
class GameScraperEngine {
    static async searchSteamRip(query, limit = 15) {
        const q = query.replace(/[™®©]/g, '').trim();
        if (!q)
            return [];
        try {
            const r = await cloudflare_1.CloudflareBypassClient.get('https://steamrip.com/', { params: { s: q }, headers: { Accept: 'text/html' } });
            const html = String(r.data);
            if (html.includes('Just a moment')) {
                log('STEAMRIP', 'CF blocked');
                return [];
            }
            const results = [];
            const seen = new Set();
            const re = /<a[^>]*href="([^"]+\/)"[^>]*>([^<]*Free Download[^<]*)<\/a>/gi;
            for (const m of html.matchAll(re)) {
                const href = m[1];
                const title = m[2].replace(/\s+/g, ' ').trim();
                if (!title || href.includes('/category/') || href.includes('/tag/'))
                    continue;
                const pageUrl = absUrl('https://steamrip.com', href);
                if (seen.has(pageUrl))
                    continue;
                seen.add(pageUrl);
                results.push({ name: title.replace(/\s*Free Download.*$/i, '').trim() || title, slug: href.replace(/^\//, '').replace(/\/$/, ''), pageUrl, source: 'steamrip' });
            }
            return results.map(r => ({ ...r, score: scoreTitle(q, r.name) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ score, ...r }) => r);
        }
        catch (e) {
            log('STEAMRIP', `search failed: ${e.message}`);
            return [];
        }
    }
    // DODI FIXED: Reverted to HTML scraping via CF Bypass to prevent WP API 403 blocks
    static async searchDodi(query, limit = 15) {
        const q = query.replace(/[™®©]/g, '').trim();
        if (!q)
            return [];
        try {
            const r = await cloudflare_1.CloudflareBypassClient.get('https://dodi-repacks.download/', {
                params: { s: q },
                headers: { Accept: 'text/html' }
            });
            const html = String(r.data);
            if (html.includes('Just a moment')) {
                log('DODI', 'CF blocked');
                return [];
            }
            const results = [];
            const seen = new Set();
            const patterns = [
                /<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis,
                /<a[^>]*href="(https:\/\/dodi-repacks\.download\/[^"]+)"[^>]*rel="bookmark"[^>]*>(.*?)<\/a>/gis
            ];
            for (const re of patterns) {
                for (const m of html.matchAll(re)) {
                    const href = m[1];
                    const title = m[2].replace(/<[^>]*>/g, '').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').trim();
                    if (!title || href.includes('/category/') || href.includes('/tag/') || href.includes('/page/'))
                        continue;
                    const pageUrl = absUrl('https://dodi-repacks.download', href);
                    if (seen.has(pageUrl))
                        continue;
                    seen.add(pageUrl);
                    results.push({
                        name: title,
                        slug: href.replace(/^https?:\/\/dodi-repacks\.download\//, '').replace(/\/$/, ''),
                        pageUrl,
                        source: 'dodi'
                    });
                    if (results.length >= limit)
                        break;
                }
            }
            return results;
        }
        catch (e) {
            log('DODI', `search failed: ${e.message}`);
            return [];
        }
    }
    static async searchAll(query, limit = 25) {
        const [steamrip, dodi] = await Promise.all([this.searchSteamRip(query, 15), this.searchDodi(query, 15)]);
        const merged = [];
        const seen = new Set();
        for (const r of [...steamrip, ...dodi]) {
            const key = (0, onlinefix_1.normalizeName)(r.name);
            if (seen.has(key))
                continue;
            seen.add(key);
            merged.push(r);
            if (merged.length >= limit)
                break;
        }
        return merged.slice(0, limit);
    }
    static parseDownloadButtons(html, baseUrl) {
        const downloads = [];
        const seen = new Set();
        const patterns = [
            /href="([^"]*\?ddownload=[^"]*)"/gi,
            /href="([^"]*\?tdownload=[^"]*)"/gi,
            /<a[^>]*href="([^"]+)"[^>]*class="[^"]*shortc-button[^"]*"[^>]*>[^<]*<\/a>/gi,
            /<a[^>]*href="([^"]+)"[^>]*class="[^"]*wp-block-button__link[^"]*"[^>]*>[^<]*<\/a>/gi,
            /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(?:Download|DOWNLOAD|Torrent|Magnet)[^<]*<\/a>/gi
        ];
        let dlCount = 1;
        for (const re of patterns)
            for (const m of html.matchAll(re)) {
                const url = absUrl(baseUrl, m[1]);
                const label = `Download Link ${dlCount}`;
                // Allow dodi-repacks.download links if they contain ?ddownload or ?tdownload
                if (url.includes('steamrip.com') || url.includes('online-fix.me') || seen.has(url))
                    continue;
                if (url.includes('dodi-repacks.download') && !url.includes('?ddownload') && !url.includes('?tdownload'))
                    continue;
                seen.add(url);
                downloads.push({ label, url });
                dlCount++;
            }
        return downloads;
    }
    static async scrapePage(result) {
        try {
            let html = '';
            // Use CloudflareBypassClient to get the raw HTML page for DODI to catch all links
            const r = await cloudflare_1.CloudflareBypassClient.get(result.pageUrl, { headers: { Accept: 'text/html' } });
            html = String(r.data);
            return { name: result.name, pageUrl: result.pageUrl, downloads: this.parseDownloadButtons(html, result.pageUrl), source: result.source };
        }
        catch (e) {
            log(result.source.toUpperCase(), `scrape failed: ${e.message}`);
            return { name: result.name, pageUrl: result.pageUrl, downloads: [], source: result.source };
        }
    }
    static async scrapeByQuery(query) {
        const results = await this.searchAll(query, 10);
        const steamripHit = results.find(r => r.source === 'steamrip');
        const dodiHit = results.find(r => r.source === 'dodi');
        const [steamrip, dodi] = await Promise.all([steamripHit ? this.scrapePage(steamripHit) : Promise.resolve(undefined), dodiHit ? this.scrapePage(dodiHit) : Promise.resolve(undefined)]);
        return { steamrip, dodi };
    }
}
exports.GameScraperEngine = GameScraperEngine;
