"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudflareBypassClient = void 0;
const axios_1 = __importDefault(require("axios"));
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];
class CloudflareBypassClient {
    static axiosInstance;
    static configure() {
        this.axiosInstance = axios_1.default.create({ timeout: 30000, validateStatus: () => true });
        this.axiosInstance.interceptors.request.use((config) => {
            config.headers = config.headers || {};
            config.headers['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            config.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
            config.headers['Accept-Language'] = 'en-US,en;q=0.9,en-GB;q=0.8';
            config.headers['Accept-Encoding'] = 'gzip, deflate, br';
            config.headers['Connection'] = 'keep-alive';
            config.headers['Upgrade-Insecure-Requests'] = '1';
            config.headers['Sec-Fetch-Dest'] = 'document';
            config.headers['Sec-Fetch-Mode'] = 'navigate';
            config.headers['Sec-Fetch-Site'] = 'none';
            config.headers['Sec-Fetch-User'] = '?1';
            config.headers['Cache-Control'] = 'max-age=0';
            config.headers['DNT'] = '1';
            config.headers['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
            config.headers['Sec-Ch-Ua-Mobile'] = '?0';
            config.headers['Sec-Ch-Ua-Platform'] = '"Windows"';
            return config;
        });
        this.axiosInstance.interceptors.response.use((response) => response, async (error) => {
            const config = error.config;
            if ([403, 429, 503, 520, 521, 522, 524].includes(error.response?.status) && !config._retry) {
                config._retry = true;
                config._retryCount = (config._retryCount || 0) + 1;
                if (config._retryCount <= 5) {
                    const delay = Math.pow(2, config._retryCount) * 1500;
                    console.log(`[CLOUDFLARE] Retry ${config._retryCount}/5 for ${config.url} after ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    config.headers['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                    return this.axiosInstance(config);
                }
            }
            return Promise.reject(error);
        });
    }
    static async get(url, config) { return this.axiosInstance.get(url, config); }
    static async post(url, data, config) { return this.axiosInstance.post(url, data, config); }
    static getInstance() { if (!this.axiosInstance)
        this.configure(); return this.axiosInstance; }
}
exports.CloudflareBypassClient = CloudflareBypassClient;
CloudflareBypassClient.configure();
