let refMap = new Map();
let screenRect = null;
let lastUpdated = 0;
export function updateRefMap(nodes) {
    refMap.clear();
    screenRect = null;
    for (const node of nodes) {
        if (!node.ref || !node.rect)
            continue;
        refMap.set(node.ref, node.rect);
        if (!screenRect && node.rect.x === 0 && node.rect.y === 0 && node.rect.width > 300) {
            screenRect = node.rect;
        }
    }
    lastUpdated = Date.now();
}
export function lookupRef(ref) {
    const clean = ref.startsWith('@') ? ref.slice(1) : ref;
    return refMap.get(clean) ?? null;
}
export function refCenter(ref) {
    const rect = lookupRef(ref);
    if (!rect)
        return null;
    return {
        x: Math.round(rect.x + rect.width / 2),
        y: Math.round(rect.y + rect.height / 2),
    };
}
export function getScreenRect() {
    return screenRect;
}
export function getRefMapAge() {
    return lastUpdated ? Date.now() - lastUpdated : Infinity;
}
export function clearRefMap() {
    refMap.clear();
    screenRect = null;
    lastUpdated = 0;
}
export function hasRefMap() {
    return refMap.size > 0;
}
