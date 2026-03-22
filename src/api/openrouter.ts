// api/openrouter.ts — OpenRouter API client
import type { ModelInfo } from '../store';

const BASE = 'https://openrouter.ai/api/v1';

// ── Thinking model detection ─────────────────────────────
// Only send thinking:disabled to models that natively support extended thinking.
// Sending it to standard models can cause empty/errored responses.
const THINKING_PATTERNS: RegExp[] = [
  /^openai\/o\d/i,                    // o1, o3, o4-mini etc.
  /^deepseek\/deepseek-r\d/i,         // R1, R2
  /thinking/i,                         // gemini-*-thinking, etc.
  /reasoning/i,
  /^anthropic\/claude-3-7/i,          // Claude 3.7 extended thinking
  /-r1/i,                              // any r1 variant
];

export function isThinkingModel(id: string): boolean {
  return THINKING_PATTERNS.some(p => p.test(id));
}

// ── Model list ───────────────────────────────────────────
export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch models (HTTP ${res.status}). Check your API key.`);
  const data = await res.json();
  return (data.data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name ?? m.id,
    pricing: {
      prompt: parseFloat(m.pricing?.prompt ?? '0'),
      completion: parseFloat(m.pricing?.completion ?? '0'),
    },
    isFree: m.id.endsWith(':free') || (
      parseFloat(m.pricing?.prompt ?? '1') === 0 &&
      parseFloat(m.pricing?.completion ?? '1') === 0
    ),
  }));
}

// ── Chat completion ──────────────────────────────────────
export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface ChatOptions {
  temperature: number;
  maxTokens: number;
  /** If true, adds response-healing plugin + json_object response_format */
  requestJson?: boolean;
}

export async function chatCompletion(
  apiKey: string,
  modelId: string,
  prompt: string,
  opts: ChatOptions,
  pricingPrompt: number,
  pricingCompletion: number,
): Promise<ChatResult> {
  const start = Date.now();

  const body: Record<string, unknown> = {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };

  // Only send thinking:disabled to models that support the extended thinking API.
  // Sending this field to standard models causes empty responses on some providers.
  if (isThinkingModel(modelId)) {
    body.thinking = { type: 'disabled' };
  }

  // For judge calls: request JSON output + activate server-side healing plugin.
  // Healing fixes: missing brackets, trailing commas, markdown fences, unquoted keys.
  if (opts.requestJson) {
    body.response_format = { type: 'json_object' };
    body.plugins = [{ id: 'response-healing' }];
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://blossomz37.github.io/one-shot-benchmark/',
      'X-Title': 'One-Shot Benchmark',
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${modelId} returned HTTP ${res.status}${err ? ': ' + err.slice(0, 200) : ''}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  if (!content) {
    throw new Error(`${modelId} returned an empty response. The model may not support this prompt format.`);
  }

  const usage = data.usage ?? {};
  const pt = usage.prompt_tokens ?? 0;
  const ct = usage.completion_tokens ?? 0;
  const costUsd = pt * pricingPrompt + ct * pricingCompletion;

  return { content, promptTokens: pt, completionTokens: ct, costUsd, latencyMs };
}
