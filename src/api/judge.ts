// api/judge.ts — Scoring logic

export interface JudgeResult {
  score: number;     // 0.0 – 1.0
  badge: 'pass' | 'partial' | 'fail';
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Exact match: trimmed, lowercased equality */
export function exactMatch(output: string, expected: string): JudgeResult {
  const score = normalize(output) === normalize(expected) ? 1.0 : 0.0;
  return { score, badge: score === 1 ? 'pass' : 'fail' };
}

/** Fuzzy: token overlap (Jaccard) */
export function fuzzyMatch(output: string, expected: string, threshold: number): JudgeResult {
  const tokensA = new Set(normalize(output).split(/\s+/));
  const tokensB = new Set(normalize(expected).split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const score = union === 0 ? 0 : intersection / union;
  const badge = score >= threshold ? 'pass' : score >= threshold * 0.5 ? 'partial' : 'fail';
  return { score: Math.round(score * 1000) / 1000, badge };
}

export function runJudge(
  mode: 'exact' | 'fuzzy',
  output: string,
  expected: string,
  fuzzyThreshold: number,
): JudgeResult {
  if (mode === 'exact') return exactMatch(output, expected);
  return fuzzyMatch(output, expected, fuzzyThreshold);
}
