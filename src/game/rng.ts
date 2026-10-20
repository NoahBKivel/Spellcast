export type Rng = () => number;

export function statefulRng(seed: number): { rng: Rng; getState: () => number } {
  let state = seed >>> 0;
  const rng: Rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rng, getState: () => state };
}

export function mulberry32(seed: number): Rng {
  return statefulRng(seed).rng;
}

export function scriptedRng(values: number[]): Rng {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
}

export function pickIndex(rng: Rng, length: number): number {
  return Math.floor(rng() * length);
}

export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}
