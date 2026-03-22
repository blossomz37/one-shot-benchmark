// main.ts — App bootstrap and runner orchestration
import './styles/base.css';
import { state, type RunResult } from './store';
import { chatCompletion } from './api/openrouter';
import { runJudge } from './api/judge';
import { createKeyButton, openModal } from './ui/ApiKeyModal';
import { createPromptPanel, buildFinalPrompt } from './ui/PromptPanel';
import { createModelSelector, loadModels } from './ui/ModelSelector';
import { createRunControls, setRunning } from './ui/RunControls';
import {
  createLeaderboard,
  showLeaderboard,
  resetLeaderboard,
  addPendingRow,
  updateRow,
  setProgress,
} from './ui/Leaderboard';

// ── App shell layout ─────────────────────────────────────
function buildShell(): void {
  const root = document.getElementById('app')!;

  root.innerHTML = `
    <div id="shell" style="min-height:100vh;display:flex;flex-direction:column">
      <!-- Header -->
      <header style="
        background:var(--surface);
        border-bottom:1px solid var(--border);
        padding:0 1.5rem;
        height:56px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        position:sticky;top:0;z-index:50;
      ">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span style="font-size:1.15rem;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
            One-Shot Benchmark
          </span>
          <span style="font-size:0.7rem;color:var(--muted);font-family:var(--font-mono)">v0.1</span>
        </div>
        <div id="header-actions" style="display:flex;gap:0.5rem;align-items:center"></div>
      </header>

      <!-- Main -->
      <main style="flex:1;max-width:1400px;width:100%;margin:0 auto;padding:1.5rem;display:grid;gap:1.25rem;align-items:start;grid-template-columns:1fr 320px" id="main-grid">
        <!-- Left column -->
        <div style="display:flex;flex-direction:column;gap:1.25rem">
          <div id="prompt-panel-slot"></div>
          <div id="leaderboard-slot"></div>
        </div>
        <!-- Right column -->
        <div style="display:flex;flex-direction:column;gap:1.25rem">
          <div id="judge-panel-slot"></div>
          <div id="model-selector-slot"></div>
        </div>
      </main>

      <!-- Footer -->
      <footer style="text-align:center;padding:1rem;font-size:0.72rem;color:var(--muted);border-top:1px solid var(--border)">
        One-Shot Benchmark — <a href="https://github.com/blossomz37/one-shot-benchmark" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">GitHub</a>
        · Powered by <a href="https://openrouter.ai" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">OpenRouter</a>
      </footer>
    </div>
  `;

  // Responsive: stack on mobile
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 800px) {
      #main-grid { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
}

// ── Mount components ─────────────────────────────────────
function mountComponents(): void {
  // Header key button
  const headerActions = document.getElementById('header-actions')!;
  headerActions.appendChild(createKeyButton());

  // Show modal on first load if no key
  if (!state.apiKey) {
    setTimeout(openModal, 400);
  }

  // Prompt panel
  document.getElementById('prompt-panel-slot')!.appendChild(createPromptPanel());

  // Judge + run controls
  document.getElementById('judge-panel-slot')!.appendChild(createRunControls(handleRun));

  // Model selector
  document.getElementById('model-selector-slot')!.appendChild(createModelSelector());

  // Leaderboard (hidden until first run)
  document.getElementById('leaderboard-slot')!.appendChild(createLeaderboard());
}

// ── Runner ───────────────────────────────────────────────
async function handleRun(): Promise<void> {
  // Validate
  if (!state.apiKey) { openModal(); return; }
  if (!state.prompt.trim()) { alert('Please enter a prompt.'); return; }
  if (state.selectedModels.size === 0) { alert('Select at least one model.'); return; }
  if (!state.expected.trim()) { alert('Please enter expected output for the judge.'); return; }

  const models = [...state.selectedModels];
  const finalPrompt = buildFinalPrompt();

  state.isRunning = true;
  state.results = [];
  setRunning(true);
  showLeaderboard();
  resetLeaderboard(models.length);

  // Add pending rows
  models.forEach(m => addPendingRow(m));

  for (let i = 0; i < models.length; i++) {
    const modelId = models[i];
    const modelInfo = state.models.find(m => m.id === modelId);
    const result: RunResult = {
      model: modelId,
      status: 'running',
      score: null,
      latency: null,
      cost: null,
      output: '',
    };

    try {
      const chat = await chatCompletion(
        state.apiKey,
        modelId,
        finalPrompt,
        state.temperature,
        state.maxTokens,
        modelInfo?.pricing.prompt ?? 0,
        modelInfo?.pricing.completion ?? 0,
      );

      const judged = runJudge(state.judgeMode, chat.content, state.expected, state.fuzzyThreshold);
      result.status = judged.badge === 'pass' ? 'pass'
        : judged.badge === 'partial' ? 'partial'
        : 'fail';
      result.score = judged.score;
      result.latency = chat.latencyMs;
      result.cost = chat.costUsd;
      result.output = chat.content;
    } catch (err: any) {
      result.status = 'error';
      result.error = err.message;
      result.output = '';
    }

    state.results.push(result);
    updateRow(result);
    setProgress(i + 1, models.length);

    // Small delay between requests (rate-limit safe)
    if (i < models.length - 1) await sleep(1000);
  }

  state.isRunning = false;
  setRunning(false);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ─────────────────────────────────────────────────
buildShell();
mountComponents();

// Re-load models when API key is updated (listen via storage event or periodic check)
// Simple approach: expose a refresh hook triggered after modal save
(window as any).__reloadModels = loadModels;
