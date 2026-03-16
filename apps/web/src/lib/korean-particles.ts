const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const RIEUL_FINAL_CONSONANT_INDEX = 8;

function getLastCharacter(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return Array.from(trimmed).at(-1) ?? null;
}

export function appendEuroRo(value: string, fallback = '주문자명'): string {
  const trimmed = value.trim();
  const base = trimmed || fallback;
  const lastCharacter = getLastCharacter(base);

  if (!lastCharacter) {
    return `${fallback}으로`;
  }

  const code = lastCharacter.charCodeAt(0);
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) {
    return `${base}으로`;
  }

  const finalConsonantIndex = (code - HANGUL_SYLLABLE_START) % 28;
  if (
    finalConsonantIndex === 0 ||
    finalConsonantIndex === RIEUL_FINAL_CONSONANT_INDEX
  ) {
    return `${base}로`;
  }

  return `${base}으로`;
}
