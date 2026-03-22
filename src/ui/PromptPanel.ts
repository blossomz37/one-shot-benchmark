// ui/PromptPanel.ts — Prompt, insert text, and expected output inputs
import { state } from '../store';

export function createPromptPanel(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '1.25rem';

  card.innerHTML = `
    <h2 style="font-size:0.85rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem">
      Prompt &amp; Expected Output
    </h2>
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div>
        <label class="label" for="prompt-input">Prompt <span style="color:var(--muted);font-size:0.7rem;text-transform:none;font-weight:400">(use <code>[INSERT TEXT]</code> for an optional passage)</span></label>
        <textarea id="prompt-input" rows="6" placeholder="Enter your prompt here..."></textarea>
      </div>
      <div id="insert-wrap" style="display:none">
        <label class="label" for="insert-input">Insert Text <span style="color:var(--muted);font-size:0.7rem;text-transform:none;font-weight:400">(replaces [INSERT TEXT])</span></label>
        <textarea id="insert-input" rows="4" placeholder="Paste passage here..."></textarea>
      </div>
      <div>
        <label class="label" for="expected-input">Expected Output</label>
        <textarea id="expected-input" rows="4" placeholder="What should the model produce?"></textarea>
      </div>
    </div>
  `;

  const promptTA = card.querySelector<HTMLTextAreaElement>('#prompt-input')!;
  const insertWrap = card.querySelector<HTMLElement>('#insert-wrap')!;
  const insertTA = card.querySelector<HTMLTextAreaElement>('#insert-input')!;
  const expectedTA = card.querySelector<HTMLTextAreaElement>('#expected-input')!;

  // Restore state
  promptTA.value = state.prompt;
  insertTA.value = state.insertText;
  expectedTA.value = state.expected;

  function checkInsert() {
    insertWrap.style.display = promptTA.value.includes('[INSERT TEXT]') ? '' : 'none';
  }
  checkInsert();

  promptTA.addEventListener('input', () => {
    state.prompt = promptTA.value;
    checkInsert();
  });
  insertTA.addEventListener('input', () => { state.insertText = insertTA.value; });
  expectedTA.addEventListener('input', () => { state.expected = expectedTA.value; });

  return card;
}

/** Resolve final prompt with [INSERT TEXT] substitution */
export function buildFinalPrompt(): string {
  return state.prompt.replace('[INSERT TEXT]', state.insertText);
}
