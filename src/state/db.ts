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
                error TEXT,
                evolution_id TEXT
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
                evolution_id TEXT,
                rationale TEXT NOT NULL,
                delta TEXT NOT NULL,
                interpretation TEXT
            );

            CREATE TABLE IF NOT EXISTS soul_snapshots (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                soul TEXT NOT NULL,
                reason TEXT
            );

            CREATE TABLE IF NOT EXISTS autonomous_evolutions (
                evolution_id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                enacted_diff_json TEXT NOT NULL,
                rationale_json TEXT NOT NULL,
                expected_effects_json TEXT NOT NULL,
                rollback_snapshot_id TEXT NOT NULL,
                rollback_conditions_json TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                rolled_back_at TEXT
            );

            CREATE TABLE IF NOT EXISTS synthesis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                cluster_summary TEXT NOT NULL,
                report_text TEXT NOT NULL,
                memories_json TEXT NOT NULL,
                human_summary TEXT,
                implication TEXT
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

        // Lightweight migrations for additive columns
        this.ensureColumn('synthesis', 'human_summary', 'TEXT');
        this.ensureColumn('synthesis', 'implication', 'TEXT');
        this.ensureColumn('evolutions', 'interpretation', 'TEXT');
        this.ensureColumn('evolutions', 'evolution_id', 'TEXT');
        this.ensureColumn('activity', 'evolution_id', 'TEXT');
    }

    private ensureColumn(table: string, column: string, type: string): void {
        try {
            const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
            if (!columns.some(c => c.name === column)) {
                this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
            }
        } catch (error) {
            console.error(`Failed to ensure column ${table}.${column}:`, error);
        }
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
