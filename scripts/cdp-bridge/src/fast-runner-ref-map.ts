interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SnapshotNode {
  ref: string;
  rect: ElementRect;
  label?: string;
  identifier?: string;
  type?: string;
  enabled?: boolean;
  hittable?: boolean;
}

let refMap = new Map<string, ElementRect>();
let screenRect: ElementRect | null = null;
let lastUpdated = 0;

export function updateRefMap(nodes: SnapshotNode[]): void {
  refMap.clear();
  screenRect = null;

  for (const node of nodes) {
    if (!node.ref || !node.rect) continue;
    refMap.set(node.ref, node.rect);

    if (!screenRect && node.rect.x === 0 && node.rect.y === 0 && node.rect.width > 300) {
      screenRect = node.rect;
    }
  }

  lastUpdated = Date.now();
}

export function lookupRef(ref: string): ElementRect | null {
  const clean = ref.startsWith('@') ? ref.slice(1) : ref;
  return refMap.get(clean) ?? null;
}

export function refCenter(ref: string): { x: number; y: number } | null {
  const rect = lookupRef(ref);
  if (!rect) return null;
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2),
  };
}

export function getScreenRect(): ElementRect | null {
  return screenRect;
}

export function getRefMapAge(): number {
  return lastUpdated ? Date.now() - lastUpdated : Infinity;
}

export function clearRefMap(): void {
  refMap.clear();
  screenRect = null;
  lastUpdated = 0;
}

export function hasRefMap(): boolean {
  return refMap.size > 0;
}
