// ui/RunControls.ts — Temperature, max tokens, judge mode, run button
import { state } from '../store';

export function createRunControls(onRun: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem';

  card.innerHTML = `
    <h2 style="font-size:0.85rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Run Settings</h2>

    <div>
      <label class="label" for="temp-slider">
        Temperature <span id="temp-val" style="color:var(--text)">${state.temperature}</span>
      </label>
      <input type="range" id="temp-slider" min="0" max="2" step="0.1" value="${state.temperature}" aria-label="Temperature" />
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--muted);margin-top:0.25rem">
        <span>0 (deterministic)</span><span>1.0 (creative)</span><span>2.0 (chaotic)</span>
      </div>
    </div>

    <div>
      <label class="label" for="max-tokens">Max Output Tokens</label>
      <input type="number" id="max-tokens" min="64" max="32768" value="${state.maxTokens}" aria-label="Max output tokens" />
    </div>

    <div>
      <label class="label">Judge Mode</label>
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" name="judge" value="exact" ${state.judgeMode === 'exact' ? 'checked' : ''} />
          <div>
            <div style="font-weight:500">Exact Match</div>
            <div style="font-size:0.75rem;color:var(--muted)">Trimmed, lowercased string equality</div>
          </div>
        </label>
        <label class="radio-option">
          <input type="radio" name="judge" value="fuzzy" ${state.judgeMode === 'fuzzy' ? 'checked' : ''} />
          <div style="flex:1">
            <div style="font-weight:500">Fuzzy Match</div>
            <div style="font-size:0.75rem;color:var(--muted)">Token overlap (Jaccard). Pass threshold:
              <span id="thresh-val">${Math.round(state.fuzzyThreshold * 100)}%</span>
            </div>
            <input type="range" id="thresh-slider" min="0.1" max="1" step="0.05"
              value="${state.fuzzyThreshold}" style="margin-top:0.5rem"
              aria-label="Fuzzy match threshold" />
          </div>
        </label>
      </div>
    </div>

    <button class="btn btn-primary" id="run-btn" style="width:100%;justify-content:center;padding:0.75rem">
      ▶ Run Benchmark
    </button>
  `;

  const tempSlider = card.querySelector<HTMLInputElement>('#temp-slider')!;
  const tempVal = card.querySelector<HTMLElement>('#temp-val')!;
  tempSlider.addEventListener('input', () => {
    state.temperature = parseFloat(tempSlider.value);
    tempVal.textContent = state.temperature.toFixed(1);
  });

  const maxTokensInput = card.querySelector<HTMLInputElement>('#max-tokens')!;
  maxTokensInput.addEventListener('change', () => {
    state.maxTokens = parseInt(maxTokensInput.value, 10);
  });

  const radios = card.querySelectorAll<HTMLInputElement>('input[name="judge"]');
  radios.forEach(r => r.addEventListener('change', () => {
    state.judgeMode = r.value as 'exact' | 'fuzzy';
  }));

  const threshSlider = card.querySelector<HTMLInputElement>('#thresh-slider')!;
  const threshVal = card.querySelector<HTMLElement>('#thresh-val')!;
  threshSlider.addEventListener('input', () => {
    state.fuzzyThreshold = parseFloat(threshSlider.value);
    threshVal.textContent = `${Math.round(state.fuzzyThreshold * 100)}%`;
  });

  const runBtn = card.querySelector<HTMLButtonElement>('#run-btn')!;
  runBtn.addEventListener('click', onRun);

  return card;
}

export function setRunning(running: boolean) {
  const btn = document.getElementById('run-btn') as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = running;
  btn.textContent = running ? '⏳ Running…' : '▶ Run Benchmark';
}
