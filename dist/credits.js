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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditsSystem = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ROOT = path.join(__dirname, '..');
const CREDITS_FILE = path.join(ROOT, 'credits.json');
const DEFAULT_CREDITS = {
    userId: '',
    credits: 0,
    lastDaily: 0,
    lastRoulette: 0,
    totalEarned: 0,
    totalSpent: 0
};
function loadCreditsData() {
    try {
        if (fs.existsSync(CREDITS_FILE)) {
            const data = fs.readFileSync(CREDITS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (e) {
        console.error('[CREDITS] Error loading credits data:', e);
    }
    return { users: {} };
}
function saveCreditsData(data) {
    try {
        fs.writeFileSync(CREDITS_FILE, JSON.stringify(data, null, 2));
    }
    catch (e) {
        console.error('[CREDITS] Error saving credits data:', e);
    }
}
class CreditsSystem {
    static getUserCredits(userId) {
        const data = loadCreditsData();
        if (!data.users[userId]) {
            data.users[userId] = { ...DEFAULT_CREDITS, userId };
            saveCreditsData(data);
        }
        return data.users[userId];
    }
    static addCredits(userId, amount, reason) {
        const data = loadCreditsData();
        if (!data.users[userId]) {
            data.users[userId] = { ...DEFAULT_CREDITS, userId };
        }
        data.users[userId].credits += amount;
        data.users[userId].totalEarned += amount;
        saveCreditsData(data);
        console.log(`[CREDITS] +${amount} to ${userId} (${reason})`);
        return data.users[userId];
    }
    static removeCredits(userId, amount, reason) {
        const data = loadCreditsData();
        if (!data.users[userId]) {
            return null;
        }
        if (data.users[userId].credits < amount) {
            return null;
        }
        data.users[userId].credits -= amount;
        data.users[userId].totalSpent += amount;
        saveCreditsData(data);
        console.log(`[CREDITS] -${amount} from ${userId} (${reason})`);
        return data.users[userId];
    }
    static setCredits(userId, amount, reason) {
        const data = loadCreditsData();
        if (!data.users[userId]) {
            data.users[userId] = { ...DEFAULT_CREDITS, userId };
        }
        data.users[userId].credits = amount;
        saveCreditsData(data);
        console.log(`[CREDITS] Set ${amount} for ${userId} (${reason})`);
        return data.users[userId];
    }
    static canClaimDaily(userId) {
        const user = this.getUserCredits(userId);
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        return now - user.lastDaily >= dayInMs;
    }
    static claimDaily(userId) {
        if (!this.canClaimDaily(userId)) {
            const user = this.getUserCredits(userId);
            const nextClaim = user.lastDaily + 24 * 60 * 60 * 1000;
            const hoursLeft = Math.ceil((nextClaim - Date.now()) / (60 * 60 * 1000));
            return {
                success: false,
                amount: 0,
                message: `Daily bonus available in ${hoursLeft} hours`
            };
        }
        const dailyAmount = 10;
        const user = this.addCredits(userId, dailyAmount, 'daily bonus');
        user.lastDaily = Date.now();
        const data = loadCreditsData();
        data.users[userId] = user;
        saveCreditsData(data);
        return {
            success: true,
            amount: dailyAmount,
            message: `Claimed ${dailyAmount} gen credits!`
        };
    }
    static getLeaderboard(limit = 10) {
        const data = loadCreditsData();
        return Object.entries(data.users)
            .map(([userId, user]) => ({
            userId,
            credits: user.credits,
            totalEarned: user.totalEarned
        }))
            .sort((a, b) => b.credits - a.credits)
            .slice(0, limit);
    }
    static getStats(userId) {
        return this.getUserCredits(userId);
    }
}
exports.CreditsSystem = CreditsSystem;
