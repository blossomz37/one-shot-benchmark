// ui/ModelSelector.ts — OpenRouter model list + multi-select
import { state, persistModels, type ModelInfo } from '../store';
import { fetchModels } from '../api/openrouter';

let listEl: HTMLElement;
let refreshBtn: HTMLButtonElement;
let statusEl: HTMLElement;
let searchEl: HTMLInputElement;
let currentModels: ModelInfo[] = [];

export function createModelSelector(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem';

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h2 style="font-size:0.85rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Models</h2>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span id="model-status" style="font-size:0.75rem;color:var(--muted)"></span>
        <button class="btn-icon" id="refresh-models" aria-label="Refresh model list" title="Refresh model list">↻</button>
      </div>
    </div>
    <div class="search-wrap">
      <span class="search-icon">⌕</span>
      <input type="text" id="model-search" placeholder="Search models..." aria-label="Search models" />
    </div>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <button class="btn btn-ghost" id="select-all" style="padding:0.3rem 0.7rem;font-size:0.75rem">All</button>
      <button class="btn btn-ghost" id="select-none" style="padding:0.3rem 0.7rem;font-size:0.75rem">None</button>
      <span id="selected-count" style="font-size:0.75rem;color:var(--muted)">0 selected</span>
    </div>
    <div class="model-list" id="model-list" role="group" aria-label="Model selection"></div>
  `;

  listEl = card.querySelector('#model-list')!;
  refreshBtn = card.querySelector('#refresh-models')!;
  statusEl = card.querySelector('#model-status')!;
  searchEl = card.querySelector('#model-search')!;

  refreshBtn.addEventListener('click', () => loadModels());
  searchEl.addEventListener('input', () => renderModels(searchEl.value));
  card.querySelector('#select-all')!.addEventListener('click', () => {
    currentModels.forEach(m => state.selectedModels.add(m.id));
    persistModels([...state.selectedModels]);
    renderModels(searchEl.value);
  });
  card.querySelector('#select-none')!.addEventListener('click', () => {
    state.selectedModels.clear();
    persistModels([]);
    renderModels(searchEl.value);
  });

  if (state.apiKey) loadModels();
  else statusEl.textContent = 'Add API key to load models';

  return card;
}

export async function loadModels() {
  if (!state.apiKey) { statusEl.textContent = 'No API key'; return; }
  statusEl.textContent = 'Loading…';
  refreshBtn.disabled = true;
  try {
    const models = await fetchModels(state.apiKey);
    state.models = models;
    currentModels = models;
    statusEl.textContent = `${models.length} models`;
    renderModels(searchEl.value);
  } catch (e: any) {
    statusEl.textContent = `Error: ${e.message}`;
  } finally {
    refreshBtn.disabled = false;
  }
}

function renderModels(filter = '') {
  const q = filter.toLowerCase();
  const filtered = currentModels.filter(m =>
    m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  );

  listEl.innerHTML = '';
  filtered.forEach(m => {
    const item = document.createElement('label');
    item.className = 'model-item';

    const checked = state.selectedModels.has(m.id);
    const priceStr = m.isFree
      ? '<span class="tag-free">FREE</span>'
      : `<span class="model-price">$${(m.pricing.prompt * 1000000).toFixed(2)}/M</span>`;

    item.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''} aria-checked="${checked}" />
      <span class="model-id">${m.id}</span>
      ${priceStr}
    `;

    const cb = item.querySelector<HTMLInputElement>('input')!;
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedModels.add(m.id);
      else state.selectedModels.delete(m.id);
      persistModels([...state.selectedModels]);
      updateCount();
    });

    listEl.appendChild(item);
  });

  updateCount();
}

function updateCount() {
  const el = document.getElementById('selected-count');
  if (el) el.textContent = `${state.selectedModels.size} selected`;
}
