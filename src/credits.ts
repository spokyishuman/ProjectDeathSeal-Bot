import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const CREDITS_FILE = path.join(ROOT, 'credits.json');

export interface UserCredits {
    userId: string;
    credits: number;
    lastDaily: number;
    lastRoulette: number;
    totalEarned: number;
    totalSpent: number;
}

export interface CreditsData {
    users: Record<string, UserCredits>;
}

const DEFAULT_CREDITS: UserCredits = {
    userId: '',
    credits: 0,
    lastDaily: 0,
    lastRoulette: 0,
    totalEarned: 0,
    totalSpent: 0
};

function loadCreditsData(): CreditsData {
    try {
        if (fs.existsSync(CREDITS_FILE)) {
            const data = fs.readFileSync(CREDITS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[CREDITS] Error loading credits data:', e);
    }
    return { users: {} };
}

function saveCreditsData(data: CreditsData): void {
    try {
        fs.writeFileSync(CREDITS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[CREDITS] Error saving credits data:', e);
    }
}

export class CreditsSystem {
    static getUserCredits(userId: string): UserCredits {
        const data = loadCreditsData();
        if (!data.users[userId]) {
            data.users[userId] = { ...DEFAULT_CREDITS, userId };
            saveCreditsData(data);
        }
        return data.users[userId];
    }

    static addCredits(userId: string, amount: number, reason: string): UserCredits {
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

    static removeCredits(userId: string, amount: number, reason: string): UserCredits | null {
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

    static setCredits(userId: string, amount: number, reason: string): UserCredits {
        const data = loadCreditsData();
        if (!data.users[userId]) {
            data.users[userId] = { ...DEFAULT_CREDITS, userId };
        }
        data.users[userId].credits = amount;
        saveCreditsData(data);
        console.log(`[CREDITS] Set ${amount} for ${userId} (${reason})`);
        return data.users[userId];
    }

    static canClaimDaily(userId: string): boolean {
        const user = this.getUserCredits(userId);
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        return now - user.lastDaily >= dayInMs;
    }

    static claimDaily(userId: string): { success: boolean; amount: number; message: string } {
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

    static getLeaderboard(limit = 10): { userId: string; credits: number; totalEarned: number }[] {
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

    static getStats(userId: string): UserCredits {
        return this.getUserCredits(userId);
    }
}
