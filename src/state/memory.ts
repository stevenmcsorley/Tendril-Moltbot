import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLLMClient } from '../llm/factory.js';
import { OllamaProvider } from '../llm/providers/ollama.js';
import { getConfig } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    private memories: MemoryEntry[] = [];
    private readonly memoryPath: string;

    constructor() {
        const dataDir = join(__dirname, '../../data');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        this.memoryPath = join(dataDir, 'memory.json');
        this.load();
    }

    private load(): void {
        if (existsSync(this.memoryPath)) {
            try {
                const data = readFileSync(this.memoryPath, 'utf-8');
                this.memories = JSON.parse(data);
                console.log(`✓ Loaded ${this.memories.length} memories from disk`);
            } catch (error) {
                console.error('Failed to load memory.json', error);
                this.memories = [];
            }
        }
    }

    private save(): void {
        try {
            writeFileSync(this.memoryPath, JSON.stringify(this.memories, null, 2));
        } catch (error) {
            console.error('Failed to save memory.json', error);
        }
    }

    /**
     * Store a new memory after generating its embedding
     */
    async store(text: string, source: MemoryEntry['metadata']['source'], id?: string): Promise<void> {
        try {
            let llm = getLLMClient();

            // Skip if text is too short or just a skip
            if (text.length < 5 || text === 'SKIP') return;

            let embedding: number[];
            try {
                embedding = await llm.embed(text);
            } catch (error) {
                // FALLBACK: If main provider (e.g. DeepSeek) lacks embeddings, 
                // use local Ollama instance for memory processing.
                console.log('Falling back to local Ollama for embeddings...');
                const ollama = new OllamaProvider();
                embedding = await ollama.embed(text);
            }
            this.memories.push({
                text,
                embedding,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source,
                    id
                }
            });

            // Keep memory manageable (e.g., last 1000 entries)
            if (this.memories.length > 1000) {
                this.memories = this.memories.slice(-1000);
            }

            this.save();
        } catch (error) {
            console.error('Failed to store memory:', error);
        }
    }

    /**
     * Search for resonant memories using cosine similarity
     */
    async search(query: string, limit: number = 3): Promise<MemoryEntry[]> {
        try {
            let llm = getLLMClient();
            let queryEmbedding: number[];

            try {
                queryEmbedding = await llm.embed(query);
            } catch {
                const ollama = new OllamaProvider();
                queryEmbedding = await ollama.embed(query);
            }

            const scores = this.memories.map(entry => ({
                entry,
                similarity: this.cosineSimilarity(queryEmbedding, entry.embedding)
            }));

            // Sort by similarity descending
            scores.sort((a, b) => b.similarity - a.similarity);

            // Filter for minimum resonance (0.7)
            return scores
                .filter(s => s.similarity > 0.7)
                .slice(0, limit)
                .map(s => s.entry);
        } catch (error) {
            console.error('Failed to search memory:', error);
            return [];
        }
    }

    /**
     * Standard cosine similarity calculation
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
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
