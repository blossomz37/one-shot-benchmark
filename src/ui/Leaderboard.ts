// ui/Leaderboard.ts — Live results table
import type { RunResult } from '../store';

let tableBody: HTMLTableSectionElement;
let progressFill: HTMLElement;
let exportBtn: HTMLButtonElement;
let summaryEl: HTMLElement;
let sectionEl: HTMLElement;

export function createLeaderboard(): HTMLElement {
  const section = document.createElement('div');
  section.id = 'leaderboard-section';
  section.style.cssText = 'display:none;flex-direction:column;gap:0.75rem';
  sectionEl = section;

  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
      <h2 style="font-size:0.85rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Results</h2>
      <div style="display:flex;gap:0.75rem;align-items:center">
        <span id="lb-summary" style="font-size:0.8rem;color:var(--muted)"></span>
        <button class="btn btn-ghost" id="export-btn" style="padding:0.35rem 0.8rem;font-size:0.78rem" disabled>⬇ Export JSON</button>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" id="progress-fill" style="width:0%"></div>
    </div>

    <div class="card leaderboard-wrap">
      <table class="leaderboard" aria-label="Benchmark results">
        <thead>
          <tr>
            <th>#</th>
            <th>Model</th>
            <th>Score</th>
            <th>Badge</th>
            <th>Latency</th>
            <th>Cost</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody id="lb-body"></tbody>
      </table>
    </div>
  `;

  tableBody = section.querySelector('#lb-body')!;
  progressFill = section.querySelector('#progress-fill')!;
  exportBtn = section.querySelector('#export-btn')!;
  summaryEl = section.querySelector('#lb-summary')!;

  exportBtn.addEventListener('click', exportResults);

  return section;
}

export function showLeaderboard() {
  if (sectionEl) sectionEl.style.display = 'flex';
}

export function resetLeaderboard(total: number) {
  tableBody.innerHTML = '';
  progressFill.style.width = '0%';
  exportBtn.disabled = true;
  summaryEl.textContent = `0 / ${total} complete`;
}

export function addPendingRow(model: string) {
  const row = document.createElement('tr');
  row.id = `row-${rowId(model)}`;
  row.innerHTML = `
    <td class="mono muted">${tableBody.children.length + 1}</td>
    <td>
      <span style="font-size:0.7rem;color:var(--muted)">${model.split('/')[0]}/</span><br>
      <span class="mono" style="font-size:0.8rem">${model.split('/')[1] ?? model}</span>
    </td>
    <td class="mono muted">—</td>
    <td><span class="badge badge-pending">Pending</span></td>
    <td class="mono muted">—</td>
    <td class="mono muted">—</td>
    <td></td>
  `;
  tableBody.appendChild(row);
}

export function updateRow(result: RunResult) {
  const row = document.getElementById(`row-${rowId(result.model)}`);
  if (!row) return;

  const badge = result.status === 'pass' ? '<span class="badge badge-pass">✓ Pass</span>'
    : result.status === 'partial' ? '<span class="badge badge-warn">⚠ Partial</span>'
    : result.status === 'error' ? '<span class="badge badge-fail">✗ Error</span>'
    : '<span class="badge badge-fail">✗ Fail</span>';

  const latClass = (result.latency ?? 99999) < 10000 ? 'lat-fast'
    : (result.latency ?? 99999) < 40000 ? 'lat-mid' : 'lat-slow';
  const latStr = result.latency != null ? `${(result.latency / 1000).toFixed(1)}s` : '—';
  const costStr = result.cost != null && result.cost > 0
    ? `$${result.cost.toFixed(5)}` : result.cost === 0 ? 'Free' : '—';
  const scoreStr = result.score != null ? result.score.toFixed(3) : '—';

  const expandId = `expand-${rowId(result.model)}`;
  row.innerHTML = `
    <td class="mono muted">${(row as HTMLTableRowElement).rowIndex}</td>
    <td>
      <span style="font-size:0.7rem;color:var(--muted)">${result.model.split('/')[0]}/</span><br>
      <span class="mono" style="font-size:0.8rem">${result.model.split('/')[1] ?? result.model}</span>
    </td>
    <td class="mono">${scoreStr}</td>
    <td>${badge}</td>
    <td class="mono ${latClass}">${latStr}</td>
    <td class="mono muted">${costStr}</td>
    <td>
      <button class="btn-icon" aria-expanded="false" aria-controls="${expandId}" 
        onclick="toggleExpand('${expandId}', this)" aria-label="Show output">▾</button>
    </td>
  `;

  // Add hidden expand row
  const expandRow = document.createElement('tr');
  expandRow.className = 'expand-row';
  expandRow.id = expandId;
  expandRow.style.display = 'none';
  expandRow.innerHTML = `<td colspan="7"><div class="expand-content">${escHtml(result.output || result.error || '(no output)')}</div></td>`;
  row.insertAdjacentElement('afterend', expandRow);
}

export function setProgress(done: number, total: number) {
  progressFill.style.width = `${Math.round((done / total) * 100)}%`;
  summaryEl.textContent = `${done} / ${total} complete`;
  if (done === total) exportBtn.disabled = false;
}

function exportResults() {
  // We export from state instead
  import('../store').then(({ state }) => {
    const blob = new Blob([JSON.stringify(state.results, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `osb-results-${Date.now()}.json`;
    a.click();
  });
}

function rowId(model: string) {
  return model.replace(/[^a-z0-9]/gi, '_');
}

function escHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Global toggle helper (attached via onclick attr)
(window as any).toggleExpand = (id: string, btn: HTMLButtonElement) => {
  const el = document.getElementById(id);
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : '';
  btn.setAttribute('aria-expanded', String(!visible));
  btn.textContent = visible ? '▾' : '▴';
};
