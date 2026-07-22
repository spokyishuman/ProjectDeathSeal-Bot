"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSteamGames = searchSteamGames;
exports.popularGames = popularGames;
const axios_1 = __importDefault(require("axios"));
const POPULAR = [
    { id: '730', name: 'Counter-Strike 2' }, { id: '570', name: 'Dota 2' }, { id: '440', name: 'Team Fortress 2' },
    { id: '252950', name: 'Rocket League' }, { id: '1091500', name: 'Cyberpunk 2077' }, { id: '1174180', name: 'Red Dead Redemption 2' },
    { id: '1245620', name: 'ELDEN RING' }, { id: '1962660', name: 'Call of Duty' }, { id: '2358720', name: 'Black Myth: Wukong' }, { id: '1966720', name: 'Lethal Company' }
];
async function searchSteamGames(query, limit = 25) {
    const q = query.trim();
    if (!q)
        return POPULAR.slice(0, limit);
    if (/^\d+$/.test(q)) {
        try {
            const r = await axios_1.default.get(`https://store.steampowered.com/api/appdetails?appids=${q}&l=english`, { timeout: 8000 });
            if (r.data[q]?.success)
                return [{ id: q, name: r.data[q].data.name, image: r.data[q].data.header_image }];
        }
        catch { }
    }
    try {
        const r = await axios_1.default.get('https://store.steampowered.com/api/storesearch/', { params: { term: q, l: 'english', cc: 'US' }, timeout: 8000 });
        return (r.data?.items || []).slice(0, limit).map((i) => ({ id: String(i.id), name: i.name, image: i.tiny_image }));
    }
    catch {
        return [];
    }
}
function popularGames() { return POPULAR; }
