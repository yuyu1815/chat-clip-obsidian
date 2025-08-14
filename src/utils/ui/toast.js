// Minimal toast notification utility for content pages and popup/options

function ensureContainer() {
  let container = document.getElementById('chatvault-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'chatvault-toast-container';
    container.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'z-index:2147483647',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(container);
  }
  return container;
}

function show(message, type = 'info', duration = 3000) {
  try {
    const container = ensureContainer();
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = [
      'min-width:220px',
      'max-width:420px',
      'background:' + (type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#374151'),
      'color:white',
      'border-radius:8px',
      'padding:10px 14px',
      'box-shadow:0 6px 20px rgba(0,0,0,0.2)',
      'font-size:14px',
      'pointer-events:auto',
      'opacity:0',
      'transform:translateY(6px)',
      'transition:opacity .18s ease, transform .18s ease',
    ].join(';');
    el.textContent = message;
    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    const remove = () => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 180);
    };
    const t = setTimeout(remove, duration);
    el.addEventListener('click', () => {
      clearTimeout(t);
      remove();
    });
  } catch (_e) {
    // Fallback
    if (type === 'error') alert(message);
    else console.log('[Toast]', message);
  }
}

export const toast = { show };


