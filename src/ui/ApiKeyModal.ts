// ui/ApiKeyModal.ts — Key icon + modal for API key entry
import { state, persistKey } from '../store';

let modalEl: HTMLElement | null = null;
let keyBtn: HTMLButtonElement | null = null;

export function createKeyButton(): HTMLButtonElement {
  keyBtn = document.createElement('button');
  keyBtn.className = 'btn-icon';
  keyBtn.id = 'key-btn';
  keyBtn.setAttribute('aria-label', 'API Key Settings');
  keyBtn.textContent = '🔑';
  if (!state.apiKey) keyBtn.classList.add('pulse-amber');
  keyBtn.addEventListener('click', openModal);
  return keyBtn;
}

export function openModal() {
  if (modalEl) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'modal-title');

  backdrop.innerHTML = `
    <div class="modal" id="key-modal">
      <div class="modal-header">
        <span class="modal-title" id="modal-title">🔑 OpenRouter API Key</span>
        <button class="btn-icon" id="modal-close" aria-label="Close">✕</button>
      </div>
      <p style="font-size:0.82rem;color:var(--muted);margin-bottom:1rem">
        Your key is used only in this browser. It never touches a server.
      </p>
      <label class="label" for="key-input">API Key</label>
      <input type="password" id="key-input" placeholder="sk-or-v1-..." value="${state.apiKey}" autocomplete="off" />
      <label class="checkbox-label" style="margin-top:0.75rem">
        <input type="checkbox" id="key-save" ${state.saveKey ? 'checked' : ''} />
        Save to browser memory (localStorage)
      </label>
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem;justify-content:flex-end">
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save">Save Key</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  modalEl = backdrop;

  const input = backdrop.querySelector<HTMLInputElement>('#key-input')!;
  setTimeout(() => input.focus(), 50);

  backdrop.querySelector('#modal-close')!.addEventListener('click', closeModal);
  backdrop.querySelector('#modal-cancel')!.addEventListener('click', closeModal);
  backdrop.querySelector('#modal-save')!.addEventListener('click', () => {
    const key = input.value.trim();
    const save = (backdrop.querySelector<HTMLInputElement>('#key-save'))!.checked;
    state.apiKey = key;
    state.saveKey = save;
    persistKey(key, save);
    if (keyBtn) {
      keyBtn.classList.toggle('pulse-amber', !key);
    }
    closeModal();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', onEsc);
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  modalEl?.remove();
  modalEl = null;
  document.removeEventListener('keydown', onEsc);
}
