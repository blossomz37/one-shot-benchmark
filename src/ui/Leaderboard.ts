// ui/Leaderboard.ts — Live results table with visual indicators and Markdown/PDF export
import type { RunResult } from '../store';

let tableBody: HTMLTableSectionElement;
let progressFill: HTMLElement;
let progressLabel: HTMLElement;
let statusBanner: HTMLElement;
let sectionEl: HTMLElement;

// Injected from main.ts — avoids dynamic import
let getResultsFn: (() => RunResult[]) = () => [];
export function setResultsGetter(fn: () => RunResult[]) { getResultsFn = fn; }

// ── Create section ───────────────────────────────────────
export function createLeaderboard(): HTMLElement {
  const section = document.createElement('div');
  section.id = 'leaderboard-section';
  section.style.cssText = 'display:none;flex-direction:column;gap:0.75rem';
  sectionEl = section;

  // Print stylesheet — injected once
  const printStyle = document.createElement('style');
  printStyle.textContent = `
    @media print {
      body > * { display: none !important; }
      #leaderboard-section { display: flex !important; }
      .no-print { display: none !important; }
      body { background: #fff; color: #000; }
      .card { box-shadow: none; border: 1px solid #ccc; }
      .badge-pass  { color: #065f46; }
      .badge-warn  { color: #92400e; }
      .badge-fail  { color: #991b1b; }
      .lat-fast, .lat-mid, .lat-slow { color: #000; }
    }
  `;
  document.head.appendChild(printStyle);

  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
      <h2 style="font-size:0.85rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Results</h2>
      <div style="display:flex;gap:0.5rem;align-items:center" class="no-print">
        <span id="lb-summary" style="font-size:0.8rem;color:var(--muted)"></span>
        <button class="btn btn-ghost" id="export-md-btn" style="padding:0.35rem 0.8rem;font-size:0.78rem" disabled>⬇ Markdown</button>
        <button class="btn btn-ghost" id="export-pdf-btn" style="padding:0.35rem 0.8rem;font-size:0.78rem" disabled>🖨 PDF</button>
      </div>
    </div>

    <div id="status-banner" style="display:none;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.6rem 0.85rem;font-size:0.82rem;color:var(--muted)"></div>

    <div class="progress-bar no-print">
      <div class="progress-fill" id="progress-fill" style="width:0%"></div>
    </div>
    <div style="font-size:0.75rem;color:var(--muted);text-align:right" id="progress-label" class="no-print"></div>

    <div class="card leaderboard-wrap">
      <table class="leaderboard" aria-label="Benchmark results">
        <thead>
          <tr>
            <th>#</th>
            <th>Model</th>
            <th>Score</th>
            <th>Result</th>
            <th>Latency</th>
            <th>Cost</th>
            <th class="no-print">Output ▾</th>
          </tr>
        </thead>
        <tbody id="lb-body"></tbody>
      </table>
    </div>
  `;

  tableBody    = section.querySelector('#lb-body')!;
  progressFill = section.querySelector('#progress-fill')!;
  progressLabel = section.querySelector('#progress-label')!;
  statusBanner = section.querySelector('#status-banner')!;

  section.querySelector('#export-md-btn')!.addEventListener('click', exportMarkdown);
  section.querySelector('#export-pdf-btn')!.addEventListener('click', () => window.print());

  return section;
}

export function showLeaderboard() {
  if (sectionEl) sectionEl.style.display = 'flex';
}

export function resetLeaderboard(total: number) {
  tableBody.innerHTML = '';
  progressFill.style.width = '0%';
  progressLabel.textContent = `0 / ${total}`;
  hideBanner();
  const mdBtn = document.getElementById('export-md-btn') as HTMLButtonElement;
  const pdfBtn = document.getElementById('export-pdf-btn') as HTMLButtonElement;
  if (mdBtn) mdBtn.disabled = true;
  if (pdfBtn) pdfBtn.disabled = true;
  document.getElementById('lb-summary')!.textContent = '';
}

export function showBanner(msg: string, type: 'info' | 'warn' | 'error' = 'info') {
  statusBanner.style.display = '';
  statusBanner.style.color =
    type === 'error' ? 'var(--red)' :
    type === 'warn'  ? 'var(--amber)' :
    'var(--muted)';
  statusBanner.textContent = msg;
}

export function hideBanner() {
  statusBanner.style.display = 'none';
}

// ── Row management ───────────────────────────────────────
export function addPendingRow(model: string) {
  const idx = tableBody.children.length + 1;
  const row = document.createElement('tr');
  row.id = `row-${rowId(model)}`;
  row.innerHTML = `
    <td class="mono muted">${idx}</td>
    <td>${modelCell(model)}</td>
    <td class="mono muted">—</td>
    <td><span class="badge badge-pending">Queued</span></td>
    <td class="mono muted">—</td>
    <td class="mono muted">—</td>
    <td class="no-print"></td>
  `;
  tableBody.appendChild(row);
}

export function setRowRunning(model: string) {
  const row = document.getElementById(`row-${rowId(model)}`);
  if (!row) return;
  const badgeCell = row.children[3];
  badgeCell.innerHTML = `<span class="badge badge-pending" style="animation:pulse-ring 1.2s infinite">⏳ Running</span>`;
}

export function updateRow(result: RunResult) {
  const row = document.getElementById(`row-${rowId(result.model)}`);
  if (!row) return;

  const badge = badgeHtml(result);
  const latMs = result.latency ?? 0;
  const latClass = latMs < 10000 ? 'lat-fast' : latMs < 40000 ? 'lat-mid' : 'lat-slow';
  const latStr = result.latency != null ? `${(result.latency / 1000).toFixed(1)}s` : '—';
  const costStr = formatCost(result.cost);
  const scoreStr = result.score != null ? result.score.toFixed(3) : '—';
  const expandId = `expand-${rowId(result.model)}`;
  const outputContent = result.error
    ? `⚠ Error: ${escHtml(result.error)}`
    : escHtml(result.output || '(no output)');

  row.innerHTML = `
    <td class="mono muted">${(row as HTMLTableRowElement).rowIndex}</td>
    <td>${modelCell(result.model)}</td>
    <td class="mono">${scoreStr}</td>
    <td>${badge}</td>
    <td class="mono ${latClass}">${latStr}</td>
    <td class="mono muted">${costStr}</td>
    <td class="no-print">
      <button class="btn-icon" aria-expanded="false" aria-controls="${expandId}"
        onclick="window.__toggleExpand('${expandId}', this)" aria-label="Show output">▾</button>
    </td>
  `;

  // Expand row
  const expandRow = document.createElement('tr');
  expandRow.className = 'expand-row no-print';
  expandRow.id = expandId;
  expandRow.style.display = 'none';

  const contentColor = result.error ? 'var(--red)' : 'var(--muted)';
  expandRow.innerHTML = `<td colspan="7"><div class="expand-content" style="color:${contentColor}">${outputContent}</div></td>`;
  row.insertAdjacentElement('afterend', expandRow);
}

export function setProgress(done: number, total: number) {
  const pct = Math.round((done / total) * 100);
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = `${done} / ${total} models complete`;
  const summaryEl = document.getElementById('lb-summary');
  if (summaryEl) summaryEl.textContent = `${done}/${total}`;
  if (done === total) {
    const results = getResultsFn();
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'error').length;
    if (summaryEl) summaryEl.textContent = `${passed}/${total} passed · ${failed} errors`;
    const mdBtn = document.getElementById('export-md-btn') as HTMLButtonElement;
    const pdfBtn = document.getElementById('export-pdf-btn') as HTMLButtonElement;
    if (mdBtn) mdBtn.disabled = false;
    if (pdfBtn) pdfBtn.disabled = false;
  }
}

// ── Markdown export ──────────────────────────────────────
function exportMarkdown() {
  const results = getResultsFn();
  if (!results.length) return;

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines: string[] = [
    `# One-Shot Benchmark Results`,
    ``,
    `**Date:** ${now}  `,
    `**Models tested:** ${results.length}  `,
    ``,
    `| # | Model | Score | Result | Latency | Cost |`,
    `|---|-------|------:|--------|---------|------|`,
  ];

  results
    .slice()
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .forEach((r, i) => {
      const score = r.score != null ? r.score.toFixed(3) : '—';
      const badge = r.status === 'pass' ? '✅ Pass' : r.status === 'partial' ? '⚠️ Partial' : r.status === 'error' ? '❌ Error' : '❌ Fail';
      const lat = r.latency != null ? `${(r.latency / 1000).toFixed(1)}s` : '—';
      const cost = formatCostText(r.cost);
      lines.push(`| ${i + 1} | \`${r.model}\` | ${score} | ${badge} | ${lat} | ${cost} |`);
    });

  lines.push('', '## Outputs', '');
  results.forEach(r => {
    lines.push(`### ${r.model}`);
    if (r.error) lines.push(`> ⚠️ Error: ${r.error}`);
    else lines.push('```', r.output || '(empty)', '```');
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `osb-results-${Date.now()}.md`;
  a.click();
}

// ── Helpers ──────────────────────────────────────────────
function modelCell(model: string): string {
  const [provider, ...rest] = model.split('/');
  return `<span style="font-size:0.7rem;color:var(--muted)">${provider}/</span><br>
          <span class="mono" style="font-size:0.8rem">${rest.join('/').replace(':free','')}</span>
          ${model.endsWith(':free') ? '<span class="tag-free" style="font-size:0.6rem">FREE</span>' : ''}`;
}

function badgeHtml(result: RunResult): string {
  const ERROR_MSGS: Record<string, string> = {
    error: 'Error',
    fail: 'Fail',
    partial: 'Partial',
    pass: 'Pass',
    running: 'Running',
    pending: 'Queued',
  };
  const cls = result.status === 'pass' ? 'badge-pass'
    : result.status === 'partial' ? 'badge-warn'
    : result.status === 'error'   ? 'badge-fail'
    : result.status === 'fail'    ? 'badge-fail'
    : 'badge-pending';
  const icon = result.status === 'pass' ? '✓'
    : result.status === 'partial' ? '⚠'
    : result.status === 'error'   ? '✗'
    : result.status === 'fail'    ? '✗'
    : '…';
  const title = result.error ? ` title="${escHtml(result.error.slice(0, 120))}"` : '';
  return `<span class="badge ${cls}"${title}>${icon} ${ERROR_MSGS[result.status] ?? result.status}</span>`;
}

function formatCost(c: number | null): string {
  if (c === null) return '—';
  if (c === 0) return '<span class="tag-free" style="font-size:0.65rem;padding:0.1rem 0.3rem">Free</span>';
  return `$${c.toFixed(5)}`;
}

function formatCostText(c: number | null): string {
  if (c === null) return '—';
  if (c === 0) return 'Free';
  return `$${c.toFixed(5)}`;
}

function rowId(model: string): string {
  return model.replace(/[^a-z0-9]/gi, '_');
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Global expand toggle referenced from inline onclick
(window as any).__toggleExpand = (id: string, btn: HTMLButtonElement) => {
  const el = document.getElementById(id);
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : '';
  btn.setAttribute('aria-expanded', String(!visible));
  btn.textContent = visible ? '▾' : '▴';
};
