// api/openrouter.ts — OpenRouter API client
import type { ModelInfo } from '../store';

const BASE = 'https://openrouter.ai/api/v1';

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name ?? m.id,
    pricing: {
      prompt: parseFloat(m.pricing?.prompt ?? '0'),
      completion: parseFloat(m.pricing?.completion ?? '0'),
    },
    isFree: m.id.endsWith(':free') || (parseFloat(m.pricing?.prompt ?? '0') === 0),
  }));
}

export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
}

export async function chatCompletion(
  apiKey: string,
  modelId: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
  pricingPrompt: number,
  pricingCompletion: number,
): Promise<ChatResult> {
  const start = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://blossomz37.github.io/one-shot-benchmark/',
      'X-Title': 'One-Shot Benchmark',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
    }),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage ?? {};
  const pt = usage.prompt_tokens ?? 0;
  const ct = usage.completion_tokens ?? 0;
  const costUsd = pt * pricingPrompt + ct * pricingCompletion;

  return { content, promptTokens: pt, completionTokens: ct, costUsd, latencyMs };
}
