export class PlatformApiError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public platform: string,
        public hint?: string,
        public retryAfterMinutes?: number,
        public retryAfterSeconds?: number,
        public dailyRemaining?: number
    ) {
        super(message);
        this.name = 'PlatformApiError';
    }

    get isRateLimited(): boolean {
        return this.statusCode === 429;
    }
}
