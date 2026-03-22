// ui/ModelSelector.ts — OpenRouter model list + multi-select with sort/filter
import { state, persistModels, type ModelInfo } from '../store';
import { fetchModels } from '../api/openrouter';

type SortMode = 'default' | 'price-asc' | 'price-desc' | 'name';
type FilterMode = 'all' | 'free' | 'paid';

let listEl: HTMLElement;
let refreshBtn: HTMLButtonElement;
let statusEl: HTMLElement;
let searchEl: HTMLInputElement;
let sortEl: HTMLSelectElement;
let filterEl: HTMLSelectElement;
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
      <input type="text" id="model-search" placeholder="Search by name or provider…" aria-label="Search models" />
    </div>

    <div style="display:flex;gap:0.5rem">
      <select id="model-filter" aria-label="Filter models" style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:0.4rem 0.6rem;font-size:0.78rem;font-family:var(--font-sans)">
        <option value="all">All models</option>
        <option value="free">Free only</option>
        <option value="paid">Paid only</option>
      </select>
      <select id="model-sort" aria-label="Sort models" style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:0.4rem 0.6rem;font-size:0.78rem;font-family:var(--font-sans)">
        <option value="default">Default order</option>
        <option value="price-asc">Price: low → high</option>
        <option value="price-desc">Price: high → low</option>
        <option value="name">Name A → Z</option>
      </select>
    </div>

    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <button class="btn btn-ghost" id="select-all" style="padding:0.3rem 0.7rem;font-size:0.75rem">Select all</button>
      <button class="btn btn-ghost" id="select-none" style="padding:0.3rem 0.7rem;font-size:0.75rem">Clear</button>
      <span id="selected-count" style="font-size:0.75rem;color:var(--muted);margin-left:auto">0 selected</span>
    </div>

    <div class="model-list" id="model-list" role="group" aria-label="Model selection"></div>
  `;

  listEl     = card.querySelector('#model-list')!;
  refreshBtn = card.querySelector<HTMLButtonElement>('#refresh-models')!;
  statusEl   = card.querySelector('#model-status')!;
  searchEl   = card.querySelector<HTMLInputElement>('#model-search')!;
  sortEl     = card.querySelector<HTMLSelectElement>('#model-sort')!;
  filterEl   = card.querySelector<HTMLSelectElement>('#model-filter')!;

  refreshBtn.addEventListener('click', () => loadModels());
  searchEl.addEventListener('input', () => renderModels());
  sortEl.addEventListener('change', () => renderModels());
  filterEl.addEventListener('change', () => renderModels());

  card.querySelector('#select-all')!.addEventListener('click', () => {
    getVisible().forEach(m => state.selectedModels.add(m.id));
    persistModels([...state.selectedModels]);
    renderModels();
  });
  card.querySelector('#select-none')!.addEventListener('click', () => {
    state.selectedModels.clear();
    persistModels([]);
    renderModels();
  });

  if (state.apiKey) loadModels();
  else statusEl.textContent = 'Add API key to load';

  return card;
}

export async function loadModels() {
  if (!state.apiKey) { statusEl.textContent = 'No API key set'; return; }
  statusEl.textContent = 'Loading…';
  refreshBtn.disabled = true;
  try {
    const models = await fetchModels(state.apiKey);
    state.models = models;
    currentModels = models;
    statusEl.textContent = `${models.length} models`;
    renderModels();
  } catch (e: any) {
    statusEl.textContent = `Error loading models`;
    listEl.innerHTML = `<p style="font-size:0.8rem;color:var(--red);padding:0.5rem">${e.message}</p>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

function getVisible(): ModelInfo[] {
  const q = searchEl?.value.toLowerCase() ?? '';
  const filter = (filterEl?.value ?? 'all') as FilterMode;
  const sort = (sortEl?.value ?? 'default') as SortMode;

  let models = currentModels.filter(m => {
    const matchesSearch = !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'free' ? m.isFree :
      !m.isFree;
    return matchesSearch && matchesFilter;
  });

  if (sort === 'price-asc')  models = [...models].sort((a, b) => a.pricing.prompt - b.pricing.prompt);
  if (sort === 'price-desc') models = [...models].sort((a, b) => b.pricing.prompt - a.pricing.prompt);
  if (sort === 'name')       models = [...models].sort((a, b) => a.id.localeCompare(b.id));

  return models;
}

function renderModels() {
  const visible = getVisible();
  listEl.innerHTML = '';

  if (visible.length === 0) {
    listEl.innerHTML = `<p style="font-size:0.8rem;color:var(--muted);padding:0.5rem">No models match your filter.</p>`;
    updateCount();
    return;
  }

  visible.forEach(m => {
    const item = document.createElement('label');
    item.className = 'model-item';
    const checked = state.selectedModels.has(m.id);

    const priceStr = m.isFree
      ? '<span class="tag-free">FREE</span>'
      : `<span class="model-price">$${(m.pricing.prompt * 1_000_000).toFixed(2)}/M</span>`;

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
