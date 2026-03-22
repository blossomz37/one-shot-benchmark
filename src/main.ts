// main.ts — App bootstrap and runner orchestration
import './styles/base.css';
import { state, type RunResult } from './store';
import { chatCompletion } from './api/openrouter';
import { runJudge } from './api/judge';
import { createKeyButton, openModal } from './ui/ApiKeyModal';
import { createPromptPanel, buildFinalPrompt } from './ui/PromptPanel';
import { createModelSelector, loadModels } from './ui/ModelSelector';
import { createRunControls, setRunning, getDelay } from './ui/RunControls';
import {
  createLeaderboard,
  showLeaderboard,
  resetLeaderboard,
  addPendingRow,
  setRowRunning,
  updateRow,
  setProgress,
  showBanner,
  hideBanner,
  setResultsGetter,
} from './ui/Leaderboard';

// ── Shell layout ─────────────────────────────────────────
function buildShell(): void {
  const root = document.getElementById('app')!;
  root.innerHTML = `
    <div id="shell" style="min-height:100vh;display:flex;flex-direction:column">
      <header style="
        background:var(--surface);
        border-bottom:1px solid var(--border);
        padding:0 1.5rem;
        height:56px;
        display:flex;align-items:center;justify-content:space-between;
        position:sticky;top:0;z-index:50;">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span style="font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
            One-Shot Benchmark
          </span>
          <span style="font-size:0.68rem;color:var(--muted);font-family:var(--font-mono);background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.4rem">v0.1</span>
        </div>
        <div id="header-actions" style="display:flex;gap:0.5rem;align-items:center"></div>
      </header>

      <main style="
        flex:1;max-width:1400px;width:100%;margin:0 auto;
        padding:1.5rem;display:grid;gap:1.25rem;align-items:start;
        grid-template-columns:1fr 320px" id="main-grid">
        <div style="display:flex;flex-direction:column;gap:1.25rem">
          <div id="prompt-panel-slot"></div>
          <div id="leaderboard-slot"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1.25rem">
          <div id="judge-panel-slot"></div>
          <div id="model-selector-slot"></div>
        </div>
      </main>

      <footer style="text-align:center;padding:1rem;font-size:0.72rem;color:var(--muted);border-top:1px solid var(--border)">
        One-Shot Benchmark ·
        <a href="https://github.com/blossomz37/one-shot-benchmark" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">GitHub</a>
        · Powered by <a href="https://openrouter.ai" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">OpenRouter</a>
      </footer>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `@media (max-width:800px) { #main-grid { grid-template-columns:1fr !important; } }`;
  document.head.appendChild(style);
}

// ── Mount ────────────────────────────────────────────────
function mountComponents(): void {
  document.getElementById('header-actions')!.appendChild(createKeyButton());
  if (!state.apiKey) setTimeout(openModal, 400);

  document.getElementById('prompt-panel-slot')!.appendChild(createPromptPanel());
  document.getElementById('judge-panel-slot')!.appendChild(createRunControls(handleRun));
  document.getElementById('model-selector-slot')!.appendChild(createModelSelector());

  const lb = createLeaderboard();
  document.getElementById('leaderboard-slot')!.appendChild(lb);

  // Wire results getter — no dynamic import needed
  setResultsGetter(() => state.results);
}

// ── Runner ───────────────────────────────────────────────
async function handleRun(): Promise<void> {
  if (!state.apiKey) {
    openModal();
    return;
  }
  if (!state.prompt.trim()) {
    showBanner('⚠ Please enter a prompt before running.', 'warn');
    showLeaderboard();
    return;
  }
  if (state.selectedModels.size === 0) {
    showBanner('⚠ No models selected. Choose at least one model from the panel on the right.', 'warn');
    showLeaderboard();
    return;
  }
  if (!state.expected.trim()) {
    showBanner('⚠ Expected output is empty. The judge needs something to compare against.', 'warn');
    showLeaderboard();
    return;
  }

  const models = [...state.selectedModels];
  const finalPrompt = buildFinalPrompt();
  const delay = getDelay();

  state.isRunning = true;
  state.results = [];
  setRunning(true);
  showLeaderboard();
  resetLeaderboard(models.length);
  hideBanner();

  // Add all pending rows upfront so the user sees the full queue
  models.forEach(m => addPendingRow(m));

  let errorCount = 0;

  for (let i = 0; i < models.length; i++) {
    const modelId = models[i];
    const modelInfo = state.models.find(m => m.id === modelId);

    setRowRunning(modelId);

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
        { temperature: state.temperature, maxTokens: state.maxTokens },
        modelInfo?.pricing.prompt ?? 0,
        modelInfo?.pricing.completion ?? 0,
      );

      const judged = runJudge(state.judgeMode, chat.content, state.expected, state.fuzzyThreshold);
      result.status = judged.badge === 'pass' ? 'pass' : judged.badge === 'partial' ? 'partial' : 'fail';
      result.score   = judged.score;
      result.latency = chat.latencyMs;
      result.cost    = chat.costUsd;
      result.output  = chat.content;

    } catch (err: any) {
      result.status = 'error';
      result.error  = err.message;
      result.output = '';
      errorCount++;
    }

    state.results.push(result);
    updateRow(result);
    setProgress(i + 1, models.length);

    // Final summary banner
    if (i === models.length - 1) {
      const passed = state.results.filter(r => r.status === 'pass').length;
      const msg = errorCount > 0
        ? `Run complete. ${passed}/${models.length} passed · ${errorCount} model${errorCount > 1 ? 's' : ''} returned errors (expand row for details).`
        : `Run complete. ${passed}/${models.length} passed.`;
      showBanner(msg, errorCount > 0 ? 'warn' : 'info');
    }

    if (i < models.length - 1 && delay > 0) await sleep(delay);
  }

  state.isRunning = false;
  setRunning(false);
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ─────────────────────────────────────────────────
buildShell();
mountComponents();

// Expose model reload for ApiKeyModal to trigger after key save
(window as any).__reloadModels = loadModels;
