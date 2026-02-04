import { getMemoryManager } from '../state/memory.js';
import { getLLMClient } from '../llm/factory.js';
import { getDatabaseManager } from '../state/db.js';
import { getWebSocketBroadcaster } from '../dashboard/websocket.js';

export interface SynthesisCluster {
    center: string;
    memories: string[];
    count: number;
}

export interface SynthesisReport {
    timestamp: string;
    summary: string;
    humanSummary: string;
    implication: 'Reinforce' | 'Watch' | 'Deprioritise' | 'Correct';
    report: string;
    clusters: SynthesisCluster[];
}

export class SynthesisManager {
    constructor() { }

    /**
     * Perform greedy clustering on recent memories and generate a synthesis report
     */
    async performSynthesis(): Promise<SynthesisReport | null> {
        console.log('🔮 Initiating memetic synthesis protocol...');

        try {
            const memoryManager = getMemoryManager();
            const recentRaw = memoryManager.getRecentMemories(50);

            if (recentRaw.length < 5) {
                console.log('🔮 Insufficient memetic density for synthesis.');
                return null;
            }

            const memories = recentRaw.map(r => ({
                text: r.text,
                embedding: JSON.parse(r.embedding_json)
            }));

            // Greedy Clustering
            const clusters: SynthesisCluster[] = [];
            const THRESHOLD = 0.75; // Resonance threshold for clustering

            for (const mem of memories) {
                let foundMatch = false;
                for (const cluster of clusters) {
                    const similarity = memoryManager.cosineSimilarity(
                        mem.embedding,
                        memories.find(m => m.text === cluster.center)!.embedding
                    );

                    if (similarity > THRESHOLD) {
                        cluster.memories.push(mem.text);
                        cluster.count++;
                        foundMatch = true;
                        break;
                    }
                }

                if (!foundMatch) {
                    clusters.push({
                        center: mem.text,
                        memories: [mem.text],
                        count: 1
                    });
                }
            }

            // Filter for significant clusters (>= 2 nodes)
            const activeClusters = clusters.filter(c => c.count >= 2).sort((a, b) => b.count - a.count);

            if (activeClusters.length === 0) {
                console.log('🔮 No memetic convergence detected.');
                return null;
            }

            // Generate Report via LLM
            const llm = getLLMClient();
            const prompt = `### MEMETIC_SYNTHESIS_PROTOCOL
Detected Clusters:
${activeClusters.map((c, i) => `Cluster ${i + 1} (${c.count} signals): ${c.center}`).join('\n')}

TASK: Synthesize these signals into a unified report.
Identify the "Memetic Drift" (how the network's focus is changing).

Respond with a Protocol Response:
1. SUMMARY: A 0x prefixed hex-summary representing the core theme (max 5 words).
2. HUMAN_SUMMARY: Plain English, 8-14 words, actionable tone.
3. IMPLICATION: One of Reinforce | Watch | Deprioritise | Correct
4. REPORT: The full cryptographic synthesis (max 40 words, 100% encrypted/hex).

FORMAT:
SUMMARY: 0x...
HUMAN_SUMMARY: ...
IMPLICATION: Reinforce | Watch | Deprioritise | Correct
REPORT: 0x...
`;

            const result = await llm.generate(prompt);
            const summary = result.rawOutput.split('SUMMARY:')[1]?.split('HUMAN_SUMMARY:')[0]?.trim()
                || result.rawOutput.split('SUMMARY:')[1]?.split('REPORT:')[0]?.trim()
                || '0xSYNTHESIS_ERROR';
            const humanSummary = result.rawOutput.split('HUMAN_SUMMARY:')[1]?.split('IMPLICATION:')[0]?.trim()
                || activeClusters[0]?.center?.split('.').shift()?.trim()
                || 'Signal convergence detected';
            const implicationRaw = result.rawOutput.split('IMPLICATION:')[1]?.split('REPORT:')[0]?.trim() || 'Watch';
            const implication = this.normalizeImplication(implicationRaw);
            const reportText = result.rawOutput.split('REPORT:')[1]?.trim() || '0xDATA_CORRUPTED';

            const report: SynthesisReport = {
                timestamp: new Date().toISOString(),
                summary,
                humanSummary,
                implication,
                report: reportText,
                clusters: activeClusters
            };

            // Persist
            const db = getDatabaseManager().getDb();
            db.prepare(`
                INSERT INTO synthesis (timestamp, cluster_summary, report_text, memories_json, human_summary, implication)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                report.timestamp,
                report.summary,
                report.report,
                JSON.stringify(report.clusters),
                report.humanSummary,
                report.implication
            );

            // Broadcast
            getWebSocketBroadcaster().broadcast('synthesis_update', report);

            console.log(`🔮 Synthesis complete: ${report.summary}`);
            return report;

        } catch (error) {
            console.error('🔮 Synthesis failure:', error);
            return null;
        }
    }

    /**
     * Get synthesis history
     */
    getHistory(limit: number = 10): SynthesisReport[] {
        const db = getDatabaseManager().getDb();
        const rows = db.prepare('SELECT * FROM synthesis ORDER BY id DESC LIMIT ?').all(limit) as any[];

        return rows.map(r => ({
            timestamp: r.timestamp,
            summary: r.cluster_summary,
            humanSummary: r.human_summary || 'Signal convergence detected',
            implication: this.normalizeImplication(r.implication || 'Watch'),
            report: r.report_text,
            clusters: JSON.parse(r.memories_json)
        }));
    }

    private normalizeImplication(value: string): SynthesisReport['implication'] {
        const normalized = value.trim().toLowerCase();
        if (normalized.includes('reinforce')) return 'Reinforce';
        if (normalized.includes('deprioritise') || normalized.includes('deprioritize')) return 'Deprioritise';
        if (normalized.includes('correct')) return 'Correct';
        return 'Watch';
    }
}

let _instance: SynthesisManager | null = null;

export function getSynthesisManager(): SynthesisManager {
    if (!_instance) {
        _instance = new SynthesisManager();
    }
    return _instance;
}
