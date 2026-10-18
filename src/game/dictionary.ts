export type TrieNode = {
  c: Record<string, TrieNode>;
  end: boolean;
};

export type Dictionary = {
  size: number;
  trie: TrieNode;
  has: (word: string) => boolean;
};

function emptyNode(): TrieNode {
  return { c: {}, end: false };
}

export function createDictionary(text: string): Dictionary {
  const trie = emptyNode();
  let size = 0;

  for (const line of text.split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (word.length < 2 || !/^[a-z]+$/.test(word)) continue;
    let node = trie;
    for (const ch of word) {
      let next = node.c[ch];
      if (!next) {
        next = emptyNode();
        node.c[ch] = next;
      }
      node = next;
    }
    if (!node.end) {
      node.end = true;
      size += 1;
    }
  }

  return {
    size,
    trie,
    has(word: string) {
      let node = trie;
      for (const ch of word.toLowerCase()) {
        const next = node.c[ch];
        if (!next) return false;
        node = next;
      }
      return node.end;
    },
  };
}

export async function loadDictionary(): Promise<Dictionary> {
  const response = await fetch("/dictionary/enable1.txt");
  if (!response.ok) {
    throw new Error("Could not load the word list");
  }
  return createDictionary(await response.text());
}
