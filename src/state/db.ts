import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class DatabaseManager {
    private db: Database.Database;

    constructor() {
        const dataDir = join(__dirname, '../../data');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        const dbPath = join(dataDir, 'moltbot.db');
        this.db = new Database(dbPath);

        // Performance optimizations
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');

        this.initializeSchema();
    }

    private initializeSchema(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                action_type TEXT NOT NULL,
                target_id TEXT,
                target_submolt TEXT,
                prompt_sent TEXT,
                raw_model_output TEXT,
                final_action TEXT,
                error TEXT
            );

            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                embedding_json TEXT NOT NULL,
                source TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS topology (
                username TEXT PRIMARY KEY,
                interactions INTEGER DEFAULT 0,
                score INTEGER DEFAULT 0,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                replies INTEGER DEFAULT 0,
                last_seen TEXT,
                handshake_step TEXT DEFAULT 'none',
                is_quarantined INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sovereignty (
                type TEXT PRIMARY KEY,
                data_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS evolutions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                rationale TEXT NOT NULL,
                delta TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS synthesis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                cluster_summary TEXT NOT NULL,
                report_text TEXT NOT NULL,
                memories_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                submolt TEXT NOT NULL,
                votes INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS kv_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);
    }

    public getDb(): Database.Database {
        return this.db;
    }

    public close(): void {
        this.db.close();
    }
}

// Singleton
let _instance: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
    if (!_instance) {
        _instance = new DatabaseManager();
    }
    return _instance;
}
