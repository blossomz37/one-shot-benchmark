// store.ts — Ephemeral session state
export interface ModelInfo {
  id: string;
  name: string;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
}

export interface RunResult {
  model: string;
  status: 'pending' | 'running' | 'pass' | 'partial' | 'fail' | 'error';
  score: number | null;
  latency: number | null;
  cost: number | null;
  output: string;
  error?: string;
}

export interface AppState {
  apiKey: string;
  saveKey: boolean;
  prompt: string;
  insertText: string;
  expected: string;
  judgeMode: 'exact' | 'fuzzy';
  fuzzyThreshold: number;
  selectedModels: Set<string>;
  temperature: number;
  maxTokens: number;
  isRunning: boolean;
  results: RunResult[];
  models: ModelInfo[];
}

const KEY_STORAGE = 'osb_api_key';
const MODELS_STORAGE = 'osb_selected_models';

export const state: AppState = {
  apiKey: localStorage.getItem(KEY_STORAGE) ?? '',
  saveKey: !!localStorage.getItem(KEY_STORAGE),
  prompt: '',
  insertText: '',
  expected: '',
  judgeMode: 'exact',
  fuzzyThreshold: 0.7,
  selectedModels: new Set(JSON.parse(localStorage.getItem(MODELS_STORAGE) ?? '[]')),
  temperature: 0.3,
  maxTokens: 2048,
  isRunning: false,
  results: [],
  models: [],
};

export function persistKey(key: string, save: boolean) {
  if (save) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}

export function persistModels(ids: string[]) {
  localStorage.setItem(MODELS_STORAGE, JSON.stringify(ids));
}
