import axios from 'axios';
import AdmZip from 'adm-zip';

const BASE = 'https://fares.top';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface ManifestFile { depotId: string; manifestId: string; size: number; downloadSize: number; }
export interface ManifestResult { appId: string; name: string; manifests: ManifestFile[]; error?: string; }

function log(tag: string, msg: string): void { console.log(`[FARES:${tag}] ${msg}`); }

export class FaresEngine {
    private static catalog: { id: string; name: string }[] = [];
    private static catalogLoaded = false;

    static async loadCatalog(): Promise<void> {
        if (this.catalogLoaded) return;
        try { 
            const r = await axios.get(`${BASE}/api/games/catalog`, { timeout: 10000, headers: { 'User-Agent': UA } }); 
            if (Array.isArray(r.data?.d)) { 
                this.catalog = r.data.d.map((g: any) => ({ id: String(g.i), name: g.n })); 
                log('CATALOG', `loaded ${this.catalog.length} games`); 
            } 
        } catch {}
        this.catalogLoaded = true;
    }

    static searchCatalog(query: string, limit = 25): { id: string; name: string }[] {
        const q = query.toLowerCase().trim(); if (!q) return this.catalog.slice(0, limit);
        if (/^\d+$/.test(q)) { const e = this.catalog.find(g => g.id === q); if (e) return [e]; }
        return this.catalog.filter(g => g.name.toLowerCase().includes(q) || g.id.includes(q)).slice(0, limit);
    }

    static async getManifests(appId: string, server = 1): Promise<ManifestResult> {
        try {
            const r = await axios.get(`${BASE}/api/manifest`, { params: { appId, server }, timeout: 10000, headers: { 'User-Agent': UA } });
            if (r.data?.error) return { appId, name: appId, manifests: [], error: r.data.error };
            const appData = r.data?.data?.[appId]; if (!appData) return { appId, name: appId, manifests: [], error: 'No manifest data' };
            const manifests: ManifestFile[] = [];
            for (const [, depot] of Object.entries(appData.depots || {}) as [string, any][]) { const pub = depot.manifests?.public; if (!pub?.gid) continue; manifests.push({ depotId: depot.depotid || '', manifestId: pub.gid, size: parseInt(pub.size || '0', 10) || 0, downloadSize: parseInt(pub.download || '0', 10) || 0 }); }
            manifests.sort((a, b) => b.size - a.size);
            return { appId, name: appData.common?.name || appId, manifests };
        } catch (e: any) { return { appId, name: appId, manifests: [], error: e.message }; }
    }

    static async downloadManifest(appId: string, depotId: string, manifestId: string, server = 1, apiKey?: string): Promise<Buffer> {
        const params: Record<string, string> = { depotId, manifestId, appId };
        if (server === 2) params.server = '2';
        const headers: Record<string, string> = { 'User-Agent': UA };
        if (server === 2 && apiKey) headers['x-api-key'] = apiKey;
        // Increased timeout to 15s to prevent roulette failures
        const r = await axios.get(`${BASE}/api/manifest/download`, { params, timeout: 15000, responseType: 'arraybuffer', headers, maxContentLength: 5 * 1024 * 1024 });
        return Buffer.from(r.data);
    }

    static async createManifestZip(appId: string, manifests: ManifestFile[], options: { maxSizeMb?: number } = {}): Promise<{ buffer: Buffer; fileCount: number; skipped: number } | null> {
        const maxSize = (options.maxSizeMb ?? 24) * 1024 * 1024; const files: { name: string; buffer: Buffer }[] = []; let skipped = 0;
        for (const m of manifests) {
            try { const buf = await this.downloadManifest(appId, m.depotId, m.manifestId); files.push({ name: `${m.depotId}_${m.manifestId}.manifest`, buffer: buf }); }
            catch { skipped++; }
        }
        if (!files.length) return null;
        const zip = new AdmZip(); for (const f of files) zip.addFile(f.name, f.buffer);
        const buffer = zip.toBuffer(); if (buffer.length > maxSize) return null;
        return { buffer, fileCount: files.length, skipped };
    }

    static getCatalogStats(): { count: number } { return { count: this.catalog.length }; }
}