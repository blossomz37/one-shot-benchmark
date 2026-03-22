// api/judge.ts — Scoring logic with robust JSON extraction

export interface JudgeResult {
  score: number;     // 0.0 – 1.0
  badge: 'pass' | 'partial' | 'fail';
}

// ── String normalization ─────────────────────────────────
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Exact match ──────────────────────────────────────────
export function exactMatch(output: string, expected: string): JudgeResult {
  const score = normalize(output) === normalize(expected) ? 1.0 : 0.0;
  return { score, badge: score === 1 ? 'pass' : 'fail' };
}

// ── Fuzzy match (Jaccard token overlap) ──────────────────
export function fuzzyMatch(output: string, expected: string, threshold: number): JudgeResult {
  const tokensA = new Set(normalize(output).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalize(expected).split(/\s+/).filter(Boolean));
  if (tokensB.size === 0) return { score: 0, badge: 'fail' };
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const score = union === 0 ? 0 : Math.round((intersection / union) * 1000) / 1000;
  const badge = score >= threshold ? 'pass' : score >= threshold * 0.5 ? 'partial' : 'fail';
  return { score, badge };
}

// ── Robust JSON extraction ───────────────────────────────
// Used for LLM-as-Judge responses. Tries multiple strategies before giving up.
export interface JsonJudgePayload {
  score: number;
  reasoning: string;
}

export function extractJson(text: string): JsonJudgePayload | null {
  // Strategy 1: Parse directly
  try {
    const parsed = JSON.parse(text.trim());
    if (isValidPayload(parsed)) return normalizePayload(parsed);
  } catch { /* continue */ }

  // Strategy 2: Extract from ```json ... ``` or ``` ... ``` fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (isValidPayload(parsed)) return normalizePayload(parsed);
    } catch { /* continue */ }
  }

  // Strategy 3: Find the first {...} block in the string
  const braceMatch = text.match(/\{[\s\S]*?\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (isValidPayload(parsed)) return normalizePayload(parsed);
    } catch { /* continue */ }
  }

  // Strategy 4: Regex-extract score from plain text (last resort)
  const scoreMatch = text.match(/\b(?:score|rating)[:\s]+([0-9]+(?:\.[0-9]+)?)/i);
  if (scoreMatch) {
    const raw = parseFloat(scoreMatch[1]);
    // Normalize: if score looks like it's on a 1-10 scale, divide by 10
    const score = raw > 1 ? Math.min(raw / 10, 1) : Math.min(Math.max(raw, 0), 1);
    return { score, reasoning: text.slice(0, 300) };
  }

  return null;
}

function isValidPayload(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && 'score' in obj;
}

function normalizePayload(obj: Record<string, unknown>): JsonJudgePayload {
  let raw = Number(obj.score);
  // Normalize scores on 0-10 scale to 0-1
  if (raw > 1) raw = Math.min(raw / 10, 1);
  const score = Math.min(Math.max(raw, 0), 1);
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : String(obj.reasoning ?? '');
  return { score, reasoning };
}

function scoreToBadge(score: number): 'pass' | 'partial' | 'fail' {
  if (score >= 0.8) return 'pass';
  if (score >= 0.4) return 'partial';
  return 'fail';
}

// ── LLM-as-Judge result from extracted JSON ──────────────
export function llmJudgeResult(text: string): JudgeResult & { reasoning: string } {
  const payload = extractJson(text);
  if (!payload) {
    return { score: 0, badge: 'fail', reasoning: 'Could not extract a score from the judge response.' };
  }
  return { score: payload.score, badge: scoreToBadge(payload.score), reasoning: payload.reasoning };
}

// ── Dispatcher ───────────────────────────────────────────
export function runJudge(
  mode: 'exact' | 'fuzzy',
  output: string,
  expected: string,
  fuzzyThreshold: number,
): JudgeResult {
  if (mode === 'exact') return exactMatch(output, expected);
  return fuzzyMatch(output, expected, fuzzyThreshold);
}
