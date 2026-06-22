(function () {
  const STYLE_ID = 'eden-dialog-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .eden-dialog-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        animation: edenFadeIn 0.15s ease;
      }
      @keyframes edenFadeIn { from { opacity:0 } to { opacity:1 } }
      @keyframes edenSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }

      .eden-dialog {
        background: #fff;
        border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.18);
        min-width: 320px; max-width: 440px; width: 90%;
        padding: 2rem;
        animation: edenSlideUp 0.18s ease;
        font-family: 'Noto Sans KR', sans-serif;
      }

      .eden-dialog-icon {
        width: 48px; height: 48px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem;
        margin: 0 auto 1rem;
      }
      .eden-dialog-icon.info    { background: #eff6ff; }
      .eden-dialog-icon.success { background: #f0fdf4; }
      .eden-dialog-icon.warning { background: #fff7ed; }
      .eden-dialog-icon.error   { background: #fef2f2; }
      .eden-dialog-icon.confirm { background: #f5f3ff; }

      .eden-dialog-message {
        text-align: center;
        font-size: 0.975rem;
        color: #1f2937;
        line-height: 1.6;
        margin-bottom: 1.5rem;
        white-space: pre-wrap;
      }

      .eden-dialog-actions {
        display: flex; gap: 0.75rem; justify-content: center;
      }

      .eden-dialog-btn {
        flex: 1; padding: 0.625rem 1rem;
        border: none; border-radius: 0.5rem;
        font-size: 0.9rem; font-weight: 600;
        cursor: pointer; transition: all 0.15s;
        font-family: inherit;
      }
      .eden-dialog-btn.primary {
        background: #16a34a; color: #fff;
      }
      .eden-dialog-btn.primary:hover { background: #15803d; }
      .eden-dialog-btn.secondary {
        background: #f3f4f6; color: #374151;
        border: 1px solid #e5e7eb;
      }
      .eden-dialog-btn.secondary:hover { background: #e5e7eb; }
      .eden-dialog-btn.danger {
        background: #dc2626; color: #fff;
      }
      .eden-dialog-btn.danger:hover { background: #b91c1c; }
    `;
    document.head.appendChild(s);
  }

  function getIcon(type) {
    const icons = { info: '💬', success: '✅', warning: '⚠️', error: '❌', confirm: '❓' };
    return icons[type] || '💬';
  }

  function showDialog({ type = 'info', message, buttons }) {
    injectStyle();
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'eden-dialog-backdrop';

      const btnsHtml = buttons.map((b, i) =>
        `<button class="eden-dialog-btn ${b.style || 'primary'}" data-idx="${i}">${b.label}</button>`
      ).join('');

      backdrop.innerHTML = `
        <div class="eden-dialog">
          <div class="eden-dialog-icon ${type}">${getIcon(type)}</div>
          <div class="eden-dialog-message">${message}</div>
          <div class="eden-dialog-actions">${btnsHtml}</div>
        </div>
      `;

      backdrop.querySelectorAll('.eden-dialog-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          backdrop.remove();
          resolve(buttons[+btn.dataset.idx].value);
        });
      });

      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          backdrop.remove();
          resolve(buttons.find(b => b.style === 'secondary')?.value ?? false);
        }
      });

      document.body.appendChild(backdrop);
      backdrop.querySelector('.eden-dialog-btn').focus();
    });
  }

  window.edenAlert = function (message, type = 'info') {
    return showDialog({
      type,
      message,
      buttons: [{ label: '확인', style: 'primary', value: true }]
    });
  };

  window.edenConfirm = function (message, { danger = false } = {}) {
    return showDialog({
      type: 'confirm',
      message,
      buttons: [
        { label: '취소', style: 'secondary', value: false },
        { label: '확인', style: danger ? 'danger' : 'primary', value: true }
      ]
    });
  };

  window.alert   = msg => window.edenAlert(String(msg));
  window.confirm = msg => window.edenConfirm(String(msg));
})();
