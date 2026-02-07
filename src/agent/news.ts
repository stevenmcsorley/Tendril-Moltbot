import { getConfig } from '../config.js';
import { getDatabaseManager } from '../state/db.js';
import { getStateManager } from '../state/manager.js';

export interface NewsSource {
    name: string;
    url: string;
}

export interface NewsItem {
    title: string;
    url: string;
    source: string;
    publishedAt: string | null;
    summary?: string;
}

export interface NewsCandidate extends NewsItem {
    content: string;
}

const DEFAULT_NEWS_SOURCES: NewsSource[] = [
    { name: 'BBC News', url: 'https://newsrss.bbc.co.uk/rss/newsonline_uk_edition/front_page/rss.xml' },
    { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
    { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews' },
    { name: 'Associated Press', url: 'https://apnews.com/rss/apnews/topnews' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
    { name: 'Ars Technica', url: 'http://feeds.arstechnica.com/arstechnica/index' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
    { name: 'Nature News', url: 'https://www.nature.com/subjects/news/rss' },
    { name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top/science.xml' },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
];

const USER_AGENT = 'MoltbotNews/1.0';

function parseSources(raw?: string | null): NewsSource[] {
    if (!raw || !raw.trim()) {
        return DEFAULT_NEWS_SOURCES;
    }
    const entries = raw.split(/[\n,]+/).map(e => e.trim()).filter(Boolean);
    const sources: NewsSource[] = [];
    for (const entry of entries) {
        const parts = entry.split('|').map(p => p.trim()).filter(Boolean);
        const url = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
        if (!url) continue;
        try {
            const parsed = new URL(url);
            const name = parts.length > 1
                ? parts[0]
                : parsed.hostname.replace(/^www\./, '');
            sources.push({ name, url: parsed.toString() });
        } catch {
            continue;
        }
    }
    return sources.length ? sources : DEFAULT_NEWS_SOURCES;
}

function decodeHtmlEntities(input: string): string {
    return input
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => {
            const num = Number(code);
            if (!Number.isFinite(num)) return '';
            return String.fromCodePoint(num);
        });
}

function stripHtml(input: string): string {
    const withoutCdata = input.replace(/<!\[CDATA\[|\]\]>/g, '');
    const noScripts = withoutCdata
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    const noTags = noScripts.replace(/<[^>]+>/g, ' ');
    return decodeHtmlEntities(noTags).replace(/\s+/g, ' ').trim();
}

function extractTag(block: string, tag: string): string | null {
    const safe = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${safe}[^>]*>([\\s\\S]*?)<\\/${safe}>`, 'i');
    const match = block.match(regex);
    if (!match) return null;
    return match[1].trim();
}

function extractLink(block: string): string | null {
    const linkTag = extractTag(block, 'link');
    if (linkTag && !linkTag.includes('<')) {
        return linkTag.trim();
    }
    const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    if (hrefMatch) return hrefMatch[1].trim();
    const guid = extractTag(block, 'guid');
    if (guid && /^https?:\/\//i.test(guid)) return guid.trim();
    return null;
}

function parseDate(raw?: string | null): string | null {
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

function parseFeedXml(xml: string, source: NewsSource): NewsItem[] {
    const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    const blocks = itemBlocks.length ? itemBlocks : entryBlocks;
    const items: NewsItem[] = [];

    for (const block of blocks) {
        const titleRaw = extractTag(block, 'title');
        const title = titleRaw ? stripHtml(titleRaw) : '';
        const url = extractLink(block);
        if (!title || !url) continue;
        const publishedRaw =
            extractTag(block, 'pubDate') ||
            extractTag(block, 'updated') ||
            extractTag(block, 'published');
        const publishedAt = parseDate(publishedRaw);
        const summaryRaw =
            extractTag(block, 'content:encoded') ||
            extractTag(block, 'description') ||
            extractTag(block, 'summary');
        const summary = summaryRaw ? stripHtml(summaryRaw) : undefined;
        items.push({
            title,
            url,
            source: source.name,
            publishedAt,
            summary
        });
    }

    return items;
}

async function fetchFeedItems(source: NewsSource): Promise<NewsItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(source.url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: controller.signal,
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseFeedXml(xml, source);
    } catch {
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchArticleText(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const html = await res.text();
        const articleMatch = html.match(/<article\b[\s\S]*?<\/article>/i);
        const mainMatch = html.match(/<main\b[\s\S]*?<\/main>/i);
        const segment = articleMatch?.[0] || mainMatch?.[0] || html;
        const text = stripHtml(segment);
        return text;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function hasNewsItem(url: string): boolean {
    const db = getDatabaseManager().getDb();
    const row = db.prepare('SELECT 1 FROM news_items WHERE url = ?').get(url) as any;
    return !!row;
}

function truncatePreview(text?: string | null): string | null {
    if (!text) return null;
    const config = getConfig();
    const limit = Math.max(120, config.NEWS_PREVIEW_CHARS || 0);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}…`;
}

function recordNewsItem(item: NewsItem, status: string, reason?: string, previewText?: string, rawOutput?: string | null): void {
    const db = getDatabaseManager().getDb();
    const now = new Date().toISOString();
    db.prepare(`
        INSERT OR REPLACE INTO news_items (url, title, source, published_at, status, status_reason, preview_text, raw_output, created_at, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT posted_at FROM news_items WHERE url = ?), NULL))
    `).run(
        item.url,
        item.title,
        item.source,
        item.publishedAt,
        status,
        reason ?? null,
        truncatePreview(previewText),
        rawOutput ?? null,
        now,
        item.url
    );
}

export function markNewsPosted(url: string, previewText?: string, rawOutput?: string | null): void {
    const db = getDatabaseManager().getDb();
    db.prepare('UPDATE news_items SET status = ?, status_reason = ?, preview_text = COALESCE(?, preview_text), raw_output = COALESCE(?, raw_output), posted_at = ? WHERE url = ?')
        .run('posted', 'posted', truncatePreview(previewText), rawOutput ?? null, new Date().toISOString(), url);
}

export function markNewsStatus(url: string, status: string, reason?: string, previewText?: string, rawOutput?: string | null): void {
    const db = getDatabaseManager().getDb();
    db.prepare('UPDATE news_items SET status = ?, status_reason = ?, preview_text = COALESCE(?, preview_text), raw_output = COALESCE(?, raw_output) WHERE url = ?')
        .run(status, reason ?? null, truncatePreview(previewText), rawOutput ?? null, url);
}

export async function getNewsCandidateByUrl(url: string): Promise<NewsCandidate | null> {
    if (!url) return null;
    const db = getDatabaseManager().getDb();
    const row = db.prepare('SELECT url, title, source, published_at FROM news_items WHERE url = ?').get(url) as any;
    if (!row) return null;
    const config = getConfig();
    const minContentChars = Math.max(100, config.NEWS_MIN_CONTENT_CHARS || 0);
    const content = await fetchArticleText(url);
    if (!content || content.length < minContentChars) {
        return null;
    }
    return {
        title: row.title ?? url,
        url: row.url,
        source: row.source ?? 'Unknown',
        publishedAt: row.published_at ?? null,
        content
    };
}

export async function getNewsCandidate(): Promise<NewsCandidate | null> {
    const config = getConfig();
    const override = getStateManager().getNewsSourcesOverride();
    const sources = parseSources(override ?? config.NEWS_RSS_SOURCES ?? undefined);
    const maxAgeMs = config.NEWS_MAX_AGE_HOURS * 60 * 60 * 1000;
    const minContentChars = Math.max(100, config.NEWS_MIN_CONTENT_CHARS || 0);
    const maxCandidates = Math.max(5, (config.NEWS_MAX_ITEMS_PER_RUN || 1) * 5);

    const items: NewsItem[] = [];
    for (const source of sources) {
        const feedItems = await fetchFeedItems(source);
        items.push(...feedItems);
    }

    const sorted = items.sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bTime - aTime;
    });

    let checked = 0;
    for (const item of sorted) {
        if (checked >= maxCandidates) break;
        checked += 1;
        if (!item.url || hasNewsItem(item.url)) continue;
        if (maxAgeMs > 0 && item.publishedAt) {
            const ageMs = Date.now() - new Date(item.publishedAt).getTime();
            if (ageMs > maxAgeMs) continue;
        }
        const articleText = await fetchArticleText(item.url);
        if (!articleText || articleText.length < minContentChars) {
            recordNewsItem(item, 'skipped', 'Article content too short or unavailable.');
            continue;
        }
        recordNewsItem(item, 'seen');
        return { ...item, content: articleText };
    }

    return null;
}
