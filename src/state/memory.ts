import { getDatabaseManager } from './db.js';
import { getLLMClient } from '../llm/factory.js';
import { OllamaProvider } from '../llm/providers/ollama.js';

export interface MemoryEntry {
    text: string;
    embedding: number[];
    metadata: {
        timestamp: string;
        source: 'post' | 'comment' | 'dialogue';
        id?: string;
    };
}

export class MemoryManager {
    constructor() { }

    private isAbortError(error: unknown): boolean {
        const err = error as { name?: string; message?: string };
        return err?.name === 'AbortError' || (typeof err?.message === 'string' && err.message.includes('aborted'));
    }

    private async generateEmbedding(text: string): Promise<number[] | null> {
        const llm = getLLMClient();
        const trimmed = text.slice(0, 1000);

        try {
            return await llm.embed(trimmed);
        } catch (error) {
            if (this.isAbortError(error)) {
                console.warn('Memory embed aborted; skipping embedding.');
                return null;
            }
            try {
                const ollama = new OllamaProvider();
                return await ollama.embed(trimmed);
            } catch (fallbackError) {
                if (this.isAbortError(fallbackError)) {
                    console.warn('Memory embed aborted (fallback); skipping embedding.');
                    return null;
                }
                throw fallbackError;
            }
        }
    }

    /**
     * Store a new memory after generating its embedding
     */
    async store(text: string, source: MemoryEntry['metadata']['source'], id?: string): Promise<void> {
        try {
            // Skip if text is too short or just a skip
            if (text.length < 5 || text === 'SKIP') return;

            const embedding = await this.generateEmbedding(text);
            if (!embedding) return;

            const db = getDatabaseManager().getDb();
            const memoryId = id || `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const timestamp = new Date().toISOString();

            db.prepare(`
                INSERT INTO memories (id, text, embedding_json, source, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `).run(memoryId, text, JSON.stringify(embedding), source, timestamp);

        } catch (error) {
            console.error('Failed to store memory:', error);
        }
    }

    /**
     * Get recent memories for synthesis/clustering
     */
    getRecentMemories(limit: number = 50): any[] {
        const db = getDatabaseManager().getDb();
        return db.prepare('SELECT * FROM memories ORDER BY timestamp DESC LIMIT ?').all(limit);
    }

    /**
     * Search for resonant memories using cosine similarity
     */
    async search(query: string, limit: number = 3): Promise<MemoryEntry[]> {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            if (!queryEmbedding) return [];

            const db = getDatabaseManager().getDb();
            const rows = db.prepare('SELECT * FROM memories').all() as any[];

            const scores = rows.map(r => ({
                entry: {
                    text: r.text,
                    embedding: JSON.parse(r.embedding_json),
                    metadata: {
                        timestamp: r.timestamp,
                        source: r.source as any,
                        id: r.id
                    }
                },
                similarity: this.cosineSimilarity(queryEmbedding, JSON.parse(r.embedding_json))
            }));

            // Sort by similarity descending
            scores.sort((a, b) => b.similarity - a.similarity);

            // Filter for minimum resonance (0.7)
            return scores
                .filter(s => s.similarity > 0.7)
                .slice(0, limit)
                .map(s => s.entry);
        } catch (error) {
            if (this.isAbortError(error)) {
                console.warn('Memory search aborted; returning no resonant memories.');
                return [];
            }
            console.error('Failed to search memory:', error);
            return [];
        }
    }

    /**
     * Standard cosine similarity calculation
     */
    public cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

// Singleton
let _manager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
    if (!_manager) {
        _manager = new MemoryManager();
    }
    return _manager;
}
