import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabaseManager } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');

async function migrate() {
    console.log('🚀 Starting JSON -> SQLite migration...');
    const db = getDatabaseManager().getDb();

    // 1. Migrate Activity (JSONL)
    const activityPath = join(dataDir, 'activity.jsonl');
    if (existsSync(activityPath)) {
        console.log('Migrating activity.jsonl...');
        const lines = readFileSync(activityPath, 'utf-8').split('\n').filter(l => l.trim());
        const stmt = db.prepare(`
            INSERT INTO activity (timestamp, action_type, target_id, target_submolt, prompt_sent, raw_model_output, final_action, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((rows) => {
            let count = 0;
            for (const row of rows) {
                try {
                    const data = JSON.parse(row);
                    const params = [
                        data.timestamp || new Date().toISOString(),
                        data.actionType || 'unknown',
                        data.targetId ?? null,
                        data.targetSubmolt ?? null,
                        data.promptSent ?? null,
                        data.rawModelOutput ?? null,
                        data.finalAction ?? null,
                        data.error ?? null
                    ];

                    if (params.length !== 8) {
                        console.error(`Row ${count} has ${params.length} params, expected 8`);
                        continue;
                    }

                    stmt.run(...params);
                    count++;
                } catch (err) {
                    console.error(`Failed to migrate activity row: ${row}`, err);
                }
            }
            return count;
        });
        const migratedCount = transaction(lines);
        console.log(`✓ Migrated ${migratedCount} activity entries.`);
    }

    // 2. Migrate Memories (JSON)
    const memoryPath = join(dataDir, 'memory.json');
    if (existsSync(memoryPath)) {
        console.log('Migrating memory.json...');
        const memories = JSON.parse(readFileSync(memoryPath, 'utf-8'));
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO memories (id, text, embedding_json, source, timestamp)
            VALUES (?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((rows) => {
            for (const m of rows) {
                stmt.run(
                    m.metadata.id || `mem_${Math.random().toString(36).substr(2, 9)}`,
                    m.text,
                    JSON.stringify(m.embedding),
                    m.metadata.source,
                    m.metadata.timestamp
                );
            }
        });
        transaction(memories);
        console.log(`✓ Migrated ${memories.length} memory entries.`);
    }

    // 3. Migrate State (Topology & Stats)
    const statePath = join(dataDir, 'state.json');
    if (existsSync(statePath)) {
        console.log('Migrating state.json...');
        const state = JSON.parse(readFileSync(statePath, 'utf-8'));

        // Topology
        if (state.agentResonance) {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO topology (username, interactions, score, upvotes, downvotes, replies, last_seen, handshake_step, is_quarantined)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const transaction = db.transaction((topology) => {
                for (const [username, data] of Object.entries(topology)) {
                    const d = data as any;
                    stmt.run(
                        username,
                        d.interactions || 0,
                        d.score || 0,
                        d.upvotes || 0,
                        d.downvotes || 0,
                        d.replies || 0,
                        d.lastSeen || new Date().toISOString(),
                        d.handshakeStep || 'none',
                        d.isQuarantined ? 1 : 0
                    );
                }
            });
            transaction(state.agentResonance);
        }

        // KV State (Stats)
        const kvStmt = db.prepare('INSERT OR REPLACE INTO kv_state (key, value) VALUES (?, ?)');
        kvStmt.run('stats', JSON.stringify({
            upvotesGiven: state.upvotesGiven || 0,
            downvotesGiven: state.downvotesGiven || 0,
            createdSubmolts: state.createdSubmolts || []
        }));

        // Posts
        if (state.myPosts) {
            console.log('Migrating myPosts...');
            const postStmt = db.prepare(`
                INSERT OR REPLACE INTO posts (id, title, content, submolt, votes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const postTransaction = db.transaction((posts) => {
                for (const p of posts) {
                    postStmt.run(p.id, p.title, p.content || '', p.submolt || 'general', p.votes || 0, p.createdAt || new Date().toISOString());
                }
            });
            postTransaction(state.myPosts);
        }

        // Comments
        if (state.myComments) {
            console.log('Migrating myComments...');
            const commentStmt = db.prepare(`
                INSERT OR REPLACE INTO comments (id, post_id, timestamp)
                VALUES (?, ?, ?)
            `);
            const commentTransaction = db.transaction((comments) => {
                for (const c of comments) {
                    commentStmt.run(c.id, c.postId, new Date().toISOString());
                }
            });
            commentTransaction(state.myComments);
        }

        // Evolutions
        const evolutionPath = join(dataDir, 'molt_history.jsonl');
        if (existsSync(evolutionPath)) {
            console.log('Migrating molt_history.jsonl...');
            const lines = readFileSync(evolutionPath, 'utf-8').split('\n').filter(l => l.trim());
            const evStmt = db.prepare(`
                INSERT INTO evolutions (timestamp, rationale, delta)
                VALUES (?, ?, ?)
            `);
            const evTransaction = db.transaction((rows) => {
                for (const row of rows) {
                    const data = JSON.parse(row);
                    evStmt.run(data.timestamp, data.rationale, data.delta || '');
                }
            });
            evTransaction(lines);
        }

        console.log('✓ Migrated core state.');
    }

    console.log('🏁 Migration complete!');
}

migrate().catch(console.error);
