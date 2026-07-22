import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export interface MovieResult { name: string; url: string; image?: string; year?: string; }
function log(tag: string, msg: string): void { console.log(`[MOVIES:${tag}] ${msg}`); }

export class MovieScraperEngine {
    private static popularCache: MovieResult[] = [];
    private static popularCacheTime = 0;

    static async getPopularMovies(limit = 20): Promise<MovieResult[]> {
        // Cache popular movies for 1 hour to prevent lag
        if (Date.now() - this.popularCacheTime < 3600000 && this.popularCache.length > 0) {
            return this.popularCache.slice(0, limit);
        }
        try {
            const r = await axios.get('https://moviesrox.net/wp-json/wp/v2/posts', {
                timeout: 3000, // Strict 3s timeout
                params: { per_page: 100 },
                headers: { 'User-Agent': UA, 'Accept': 'application/json' }
            });
            const results: MovieResult[] = [];
            for (const post of r.data) {
                let title = post.title?.rendered || '';
                title = title.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').trim();

                // FIX: If title is empty, extract from slug
                if (!title) {
                    const slug = post.slug || '';
                    title = slug.replace(/-/g, ' ').trim();
                }

                // FIX: Only add if title is valid to prevent Discord 50035 crash
                if (title && title.length > 0) {
                    results.push({ name: title, url: post.link });
                }
            }
            this.popularCache = results;
            this.popularCacheTime = Date.now();
            return results.slice(0, limit);
        } catch (e: any) { 
            log('POPULAR', `Failed: ${e.message}`); 
            return []; 
        }
    }

    static async searchMoviesRox(query: string, limit = 15): Promise<MovieResult[]> {
        try {
            const r = await axios.get('https://moviesrox.net/wp-json/wp/v2/posts', {
                timeout: 3000, // Strict 3s timeout
                params: { search: query, per_page: limit },
                headers: { 'User-Agent': UA, 'Accept': 'application/json' }
            });
            const results: MovieResult[] = []; 
            for (const post of r.data) {
                let title = post.title?.rendered || '';
                title = title.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').trim();

                // FIX: If title is empty, extract from slug
                if (!title) {
                    const slug = post.slug || '';
                    title = slug.replace(/-/g, ' ').trim();
                }

                if (title && title.length > 0) {
                    results.push({ name: title, url: post.link });
                }
            }
            return results;
        } catch (e: any) { 
            log('MOVIESROX', `Search failed: ${e.message}`); 
            return []; 
        }
    }

    static async searchYarrlist(query: string, limit = 15): Promise<MovieResult[]> {
        try {
            const r = await axios.get('https://yarrlist.net/anime-list', { 
                timeout: 3000,
                headers: { 'User-Agent': UA, 'Accept': 'text/html' } 
            });
            const html = String(r.data); 
            const results: MovieResult[] = []; 
            const seen = new Set<string>();

            const re = /<a[^>]*href="(https?:\/\/[^"]+)">([^<]+)<\/a>/gi;
            for (const m of html.matchAll(re)) {
                const url = m[1]; 
                const name = m[2].trim();
                if (name.length > 3 && !url.includes('yarrlist.net') && !url.includes('discord') && !url.includes('telegram')) {
                    if (name.toLowerCase().includes(query.toLowerCase())) {
                        if (!seen.has(url)) { seen.add(url); results.push({ name, url }); }
                        if (results.length >= limit) break;
                    }
                }
            }
            return results;
        } catch (e: any) { 
            log('YARRLIST', `Search failed: ${e.message}`); 
            return []; 
        }
    }

    static async searchMovies(query: string, limit = 25): Promise<MovieResult[]> {
        if (!query) return this.getPopularMovies(limit);
        const [moviesrox, yarrlist] = await Promise.all([this.searchMoviesRox(query, limit), this.searchYarrlist(query, limit)]);
        return [...moviesrox, ...yarrlist].slice(0, limit);
    }

    static async getAutocompleteSuggestions(query: string, limit = 25): Promise<{ name: string; value: string }[]> {
        if (!query) { 
            const p = await this.getPopularMovies(limit); 
            return p.length ? p.map(m => ({ name: m.name.slice(0, 100), value: m.name })) : [{ name: 'Type to search...', value: ' ' }]; 
        }
        const movies = await this.searchMovies(query, limit);
        // FIX: Filter out any empty names just in case before mapping
        const validMovies = movies.filter(m => m.name && m.name.trim().length > 0);
        return validMovies.length ? validMovies.map(m => ({ name: m.name.slice(0, 100), value: m.name })) : [{ name: `No results for "${query}"`, value: query }];
    }
}