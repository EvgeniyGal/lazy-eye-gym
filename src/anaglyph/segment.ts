export type TextSegment = {
  text: string;
  kind: 'content' | 'neutral';
};

const VOWELS = new Set('aeiouyAEIOUY');

function isLetter(char: string) {
  return /[A-Za-z]/.test(char);
}

export function segmentLetters(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  for (const char of text) {
    if (isLetter(char)) {
      segments.push({ text: char, kind: 'content' });
    } else {
      const last = segments[segments.length - 1];
      if (last?.kind === 'neutral') {
        last.text += char;
      } else {
        segments.push({ text: char, kind: 'neutral' });
      }
    }
  }
  return segments;
}

export function segmentSyllables(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const tokenPattern = /[A-Za-z']+|[^A-Za-z']+/g;
  const tokens = text.match(tokenPattern) ?? [text];

  for (const token of tokens) {
    if (!/[A-Za-z]/.test(token)) {
      segments.push({ text: token, kind: 'neutral' });
      continue;
    }
    for (const syllable of splitWordSyllables(token)) {
      segments.push({ text: syllable, kind: 'content' });
    }
  }
  return segments;
}

function splitWordSyllables(word: string): string[] {
  if (word.length <= 3) {
    return [word];
  }

  const lower = word.toLowerCase();
  const breaks: number[] = [];
  let i = 0;
  while (i < lower.length - 1) {
    const a = lower[i]!;
    const b = lower[i + 1]!;
    const c = lower[i + 2];

    if (!VOWELS.has(a) && VOWELS.has(b)) {
      i += 1;
      continue;
    }

    if (VOWELS.has(a) && !VOWELS.has(b) && c && VOWELS.has(c)) {
      breaks.push(i + 1);
      i += 2;
      continue;
    }

    if (VOWELS.has(a) && !VOWELS.has(b) && c && !VOWELS.has(c)) {
      breaks.push(i + 2);
      i += 2;
      continue;
    }

    i += 1;
  }

  if (breaks.length === 0) {
    return [word];
  }

  const parts: string[] = [];
  let start = 0;
  for (const point of breaks) {
    if (point > start && point < word.length) {
      parts.push(word.slice(start, point));
      start = point;
    }
  }
  if (start < word.length) {
    parts.push(word.slice(start));
  }
  return parts.filter(Boolean);
}
