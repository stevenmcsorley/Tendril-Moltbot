export function packId(parts: string[]): string {
    return parts.map((part) => encodeURIComponent(part)).join('|');
}

export function unpackId(id: string, expectedParts = 2): string[] {
    const parts = id.split('|').map((part) => decodeURIComponent(part));
    if (parts.length < expectedParts) {
        return [id];
    }
    return parts;
}
