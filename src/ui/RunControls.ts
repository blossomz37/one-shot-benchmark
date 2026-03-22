// ui/RunControls.ts — Temperature, max tokens, judge mode, delay, run button
import { state } from '../store';

let delaySeconds = 1;

export function getDelay(): number { return delaySeconds * 1000; }

export function createRunControls(onRun: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem';

  card.innerHTML = `
    <h2 style="font-size:0.85rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Run Settings</h2>

    <div>
      <label class="label" for="temp-slider">
        Temperature <span id="temp-val" style="color:var(--text);font-family:var(--font-mono)">${state.temperature.toFixed(1)}</span>
      </label>
      <input type="range" id="temp-slider" min="0" max="2" step="0.1" value="${state.temperature}" aria-label="Temperature" />
      <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--muted);margin-top:0.25rem">
        <span>0 · deterministic</span><span>1.0</span><span>2.0 · chaotic</span>
      </div>
    </div>

    <div>
      <label class="label" for="max-tokens">Max Output Tokens</label>
      <input type="number" id="max-tokens" min="64" max="32768" value="${state.maxTokens}" aria-label="Max output tokens" />
    </div>

    <div>
      <label class="label" for="delay-select">
        Delay between requests
        <span style="font-weight:400;text-transform:none;color:var(--muted);font-size:0.7rem">(rate-limit safety)</span>
      </label>
      <select id="delay-select" aria-label="Delay between requests"
        style="width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:0.5rem 0.75rem;font-size:0.875rem;font-family:var(--font-sans)">
        <option value="0">No delay</option>
        <option value="1" selected>1 second</option>
        <option value="2">2 seconds</option>
        <option value="5">5 seconds</option>
        <option value="10">10 seconds (free models)</option>
      </select>
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
        <label class="radio-option" style="flex-direction:column;align-items:flex-start">
          <div style="display:flex;align-items:center;gap:0.6rem;width:100%">
            <input type="radio" name="judge" value="fuzzy" ${state.judgeMode === 'fuzzy' ? 'checked' : ''} />
            <div>
              <div style="font-weight:500">Fuzzy Match</div>
              <div style="font-size:0.75rem;color:var(--muted)">Token overlap · pass at
                <span id="thresh-val" style="font-family:var(--font-mono)">${Math.round(state.fuzzyThreshold * 100)}%</span>
              </div>
            </div>
          </div>
          <div style="padding-left:1.6rem;width:100%;margin-top:0.4rem">
            <input type="range" id="thresh-slider" min="0.1" max="1" step="0.05"
              value="${state.fuzzyThreshold}" style="width:100%"
              aria-label="Fuzzy match threshold" />
          </div>
        </label>
      </div>
    </div>

    <button class="btn btn-primary" id="run-btn" style="width:100%;justify-content:center;padding:0.75rem;font-size:0.95rem">
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

  const delaySelect = card.querySelector<HTMLSelectElement>('#delay-select')!;
  delaySelect.addEventListener('change', () => {
    delaySeconds = parseInt(delaySelect.value, 10);
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
