/**
 * Skin Code — Toast notifications
 * Self-contained, dependency-free (no bundler / no npm needed by the dc-runtime).
 * Mirrors the Sonner API (https://sonner.emilkowal.ski) so calls read the same:
 *
 *   toast('Zapisano')
 *   toast.success('Kupon zastosowany', { description: '-20% na Skin Code' })
 *   toast.error('Nieprawidłowy kod')
 *   const id = toast.loading('Wysyłanie…'); toast.success('Wysłano', { id })
 *   toast.promise(fetch(...), { loading: 'Ładowanie…', success: 'Gotowe', error: 'Błąd' })
 *
 * Styled with the Industry design-system tokens (blueprint corners, hairline
 * borders, Barlow Condensed headings) so toasts look native to Skin Code.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.toast) return;

  var CONTAINER_ID = 'skin-code-toaster';
  var STYLE_ID = 'skin-code-toaster-styles';
  var DEFAULT_DURATION = 4000;
  var GAP = 10;

  var toasts = new Map(); // id -> { el, timer, options }
  var seq = 0;

  function nextId() {
    seq += 1;
    return 'sc-toast-' + Date.now() + '-' + seq;
  }

  function ensureContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Powiadomienia');
    document.body.appendChild(el);
    return el;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + CONTAINER_ID + '{position:fixed;z-index:9999;bottom:24px;right:24px;',
      'display:flex;flex-direction:column-reverse;gap:' + GAP + 'px;',
      'width:min(380px,calc(100vw - 32px));pointer-events:none;}',

      '@media (max-width:600px){#' + CONTAINER_ID + '{bottom:16px;right:16px;left:16px;width:auto;}}',

      '.sc-toast{pointer-events:auto;position:relative;display:flex;gap:12px;align-items:flex-start;',
      'padding:14px 16px;background:var(--color-bg,#f2f2f3);color:var(--color-text,#1d1f20);',
      'border:1px solid var(--color-divider,rgba(29,31,32,.16));border-left:3px solid var(--sc-toast-accent,var(--color-accent,#5980a6));',
      'box-shadow:var(--shadow-lg,0 12px 32px rgba(0,0,0,.18));',
      'font-family:var(--font-body,"Barlow",system-ui,sans-serif);font-size:14px;line-height:1.4;',
      'transform:translateX(0);opacity:1;transition:transform .25s var(--ease-spring, cubic-bezier(0.32,0.72,0,1)),opacity .25s ease,max-height .25s ease,margin .25s ease,padding .25s ease;',
      'max-height:200px;}',

      '.sc-toast.sc-toast-enter{transform:translateX(24px);opacity:0;}',
      '.sc-toast.sc-toast-exit{transform:translateX(24px);opacity:0;max-height:0;margin:0;padding-top:0;padding-bottom:0;border-width:0;overflow:hidden;}',

      '.sc-toast-icon{flex:none;width:18px;height:18px;display:flex;align-items:center;justify-content:center;',
      'margin-top:1px;color:var(--sc-toast-accent,var(--color-accent,#5980a6));}',
      '.sc-toast-icon svg{display:block;width:16px;height:16px;}',
      '.sc-toast-icon.sc-spin svg{animation:sc-toast-spin 0.9s linear infinite;}',
      '@keyframes sc-toast-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}',

      '.sc-toast-body{flex:1;min-width:0;}',
      '.sc-toast-title{font-family:var(--font-heading,"Barlow Condensed",system-ui,sans-serif);',
      'font-weight:600;font-size:14px;letter-spacing:0.01em;margin:0;word-wrap:break-word;}',
      '.sc-toast-description{margin:3px 0 0;font-size:12.5px;line-height:1.45;',
      'color:color-mix(in srgb, var(--color-text,#1d1f20) 68%, transparent);word-wrap:break-word;}',

      '.sc-toast-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}',
      '.sc-toast-action,.sc-toast-cancel{font-family:var(--font-heading,"Barlow Condensed",system-ui,sans-serif);',
      'font-weight:600;font-size:12px;letter-spacing:0.02em;cursor:pointer;border-radius:0;',
      'padding:6px 12px;min-height:28px;line-height:1;border:1px solid var(--color-divider,rgba(29,31,32,.16));',
      'background:transparent;color:var(--color-text,#1d1f20);}',
      '.sc-toast-action{border-color:var(--sc-toast-accent,var(--color-accent,#5980a6));',
      'color:var(--sc-toast-accent,var(--color-accent,#5980a6));}',
      '.sc-toast-action:hover{background:color-mix(in srgb, var(--sc-toast-accent, var(--color-accent,#5980a6)) 10%, transparent);}',
      '.sc-toast-cancel:hover{background:color-mix(in srgb, var(--color-text,#1d1f20) 6%, transparent);}',

      '.sc-toast-close{flex:none;appearance:none;border:0;background:transparent;cursor:pointer;',
      'width:20px;height:20px;padding:0;display:flex;align-items:center;justify-content:center;',
      'color:color-mix(in srgb, var(--color-text,#1d1f20) 55%, transparent);opacity:.7;margin:-2px -4px 0 0;}',
      '.sc-toast-close:hover{opacity:1;}',
      '.sc-toast-close svg{width:13px;height:13px;display:block;}',

      '.sc-toast > .corner{position:absolute;width:9px;height:9px;color:color-mix(in srgb, var(--color-text,#1d1f20) 45%, transparent);}',
      '.sc-toast > .corner::before,.sc-toast > .corner::after{content:"";position:absolute;background:currentColor;}',
      '.sc-toast > .corner::before{left:4px;top:0;width:1px;height:100%;}',
      '.sc-toast > .corner::after{top:4px;left:0;width:100%;height:1px;}',
      '.sc-toast > .corner.tl{top:-5px;left:-5px;}',
      '.sc-toast > .corner.tr{top:-5px;right:-5px;}',
      '.sc-toast > .corner.bl{bottom:-5px;left:-5px;}',
      '.sc-toast > .corner.br{bottom:-5px;right:-5px;}',

      '@media (prefers-reduced-motion: reduce){.sc-toast{transition:opacity .15s ease;}',
      '.sc-toast.sc-toast-enter,.sc-toast.sc-toast-exit{transform:none;}}'
    ].join('');
    document.head.appendChild(style);
  }

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="10"/></svg>',
    loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>'
  };

  var ACCENTS = {
    success: 'var(--color-success, #4c8f5f)',
    error: 'var(--color-error, #c05a4c)',
    warning: 'var(--color-warning, #b9863a)',
    info: 'var(--color-accent, #5980a6)',
    loading: 'var(--color-accent, #5980a6)',
    default: 'var(--color-accent, #5980a6)'
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function clearTimer(entry) {
    if (entry && entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
  }

  function scheduleAutoClose(id, duration) {
    var entry = toasts.get(id);
    if (!entry) return;
    clearTimer(entry);
    if (duration === Infinity || duration == null) return;
    entry.timer = setTimeout(function () {
      dismiss(id, true);
    }, duration);
  }

  function buildToastEl(id, type, message, options) {
    options = options || {};
    var el = document.createElement('div');
    el.className = 'sc-toast sc-toast-enter';
    el.dataset.type = type;
    el.dataset.id = id;
    el.style.setProperty('--sc-toast-accent', ACCENTS[type] || ACCENTS.default);

    ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
      var corner = document.createElement('i');
      corner.className = 'corner ' + pos;
      el.appendChild(corner);
    });

    var iconWrap = document.createElement('div');
    iconWrap.className = 'sc-toast-icon' + (type === 'loading' ? ' sc-spin' : '');
    var iconSvg = options.icon != null ? options.icon : ICONS[type];
    if (iconSvg) iconWrap.innerHTML = iconSvg;
    if (iconSvg) el.appendChild(iconWrap);

    var body = document.createElement('div');
    body.className = 'sc-toast-body';

    var title = document.createElement('p');
    title.className = 'sc-toast-title';
    if (typeof message === 'function') {
      var result = message();
      // A function may return a real Node (for links/components in the
      // text, per the toast(() => <jsx/>) pattern) — that's inserted as-is.
      // Anything else it returns is treated as untrusted text, same as the
      // plain-string path below: escaped, never raw-innerHTML'd. A toast
      // that echoes a server error or user-entered value back (e.g. a
      // buyer's own name) must not become an HTML-injection sink just
      // because it arrived via the function form instead of a string.
      if (result instanceof Node) title.appendChild(result);
      else title.innerHTML = escapeHtml(result);
    } else {
      title.innerHTML = escapeHtml(message);
    }
    body.appendChild(title);

    if (options.description) {
      var desc = document.createElement('p');
      desc.className = 'sc-toast-description';
      if (typeof options.description === 'function') {
        var dResult = options.description();
        if (dResult instanceof Node) desc.appendChild(dResult);
        else desc.innerHTML = escapeHtml(dResult);
      } else {
        desc.innerHTML = escapeHtml(options.description);
      }
      body.appendChild(desc);
    }

    if (options.action || options.cancel) {
      var actions = document.createElement('div');
      actions.className = 'sc-toast-actions';
      if (options.cancel) {
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'sc-toast-cancel';
        cancelBtn.textContent = options.cancel.label;
        cancelBtn.addEventListener('click', function () {
          if (options.cancel.onClick) options.cancel.onClick();
          dismiss(id);
        });
        actions.appendChild(cancelBtn);
      }
      if (options.action) {
        var actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'sc-toast-action';
        actionBtn.textContent = options.action.label;
        actionBtn.addEventListener('click', function (evt) {
          var prevented = false;
          var fakeEvent = evt;
          fakeEvent.preventDefault = function () { prevented = true; };
          if (options.action.onClick) options.action.onClick(fakeEvent);
          if (!prevented) dismiss(id);
        });
        actions.appendChild(actionBtn);
      }
      body.appendChild(actions);
    }

    el.appendChild(body);

    if (options.dismissible !== false) {
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'sc-toast-close';
      closeBtn.setAttribute('aria-label', 'Zamknij powiadomienie');
      closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      closeBtn.addEventListener('click', function () {
        if (options.onDismiss) options.onDismiss();
        dismiss(id);
      });
      el.appendChild(closeBtn);
    }

    return el;
  }

  function render(id, type, message, options) {
    injectStyles();
    var container = ensureContainer();
    options = options || {};
    var existing = toasts.get(id);

    var el = buildToastEl(id, type, message, options);

    if (existing) {
      clearTimer(existing);
      if (existing.el && existing.el.parentNode) {
        existing.el.parentNode.replaceChild(el, existing.el);
      } else {
        container.appendChild(el);
      }
    } else {
      container.appendChild(el);
    }

    // Force reflow so the enter transition plays.
    void el.offsetWidth;
    el.classList.remove('sc-toast-enter');

    var duration = options.duration != null ? options.duration
      : (type === 'loading' ? Infinity : DEFAULT_DURATION);

    toasts.set(id, { el: el, timer: null, options: options });
    scheduleAutoClose(id, duration);

    return id;
  }

  function dismiss(id, isAuto) {
    if (id == null) {
      toasts.forEach(function (_entry, tid) { dismiss(tid); });
      return;
    }
    var entry = toasts.get(id);
    if (!entry) return;
    clearTimer(entry);
    var el = entry.el;
    if (isAuto && entry.options && entry.options.onAutoClose) entry.options.onAutoClose();
    toasts.delete(id);
    if (!el) return;
    el.classList.add('sc-toast-exit');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 260);
  }

  function toast(message, options) {
    options = options || {};
    var id = options.id || nextId();
    return render(id, 'default', message, Object.assign({}, options, { id: id }));
  }

  ['success', 'error', 'warning', 'info', 'loading'].forEach(function (type) {
    toast[type] = function (message, options) {
      options = options || {};
      var id = options.id || nextId();
      return render(id, type, message, Object.assign({}, options, { id: id }));
    };
  });

  toast.promise = function (promiseOrFn, messages, options) {
    messages = messages || {};
    options = options || {};
    var id = options.id || nextId();
    var p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;

    render(id, 'loading', messages.loading || 'Ładowanie…', Object.assign({}, options, { id: id, duration: Infinity }));

    Promise.resolve(p).then(
      function (value) {
        var msg = typeof messages.success === 'function' ? messages.success(value) : (messages.success || 'Gotowe');
        render(id, 'success', msg, Object.assign({}, options, { id: id }));
      },
      function (err) {
        var msg = typeof messages.error === 'function' ? messages.error(err) : (messages.error || 'Coś poszło nie tak');
        render(id, 'error', msg, Object.assign({}, options, { id: id }));
      }
    );

    return id;
  };

  toast.custom = function (renderFn, options) {
    options = options || {};
    var id = options.id || nextId();
    var node = typeof renderFn === 'function' ? renderFn(id) : renderFn;
    return render(id, 'default', function () { return node; }, Object.assign({}, options, { id: id, description: undefined }));
  };

  toast.dismiss = dismiss;

  toast.getActiveToasts = function () {
    return Array.from(toasts.keys());
  };

  window.toast = toast;
  window.SkinCodeToast = toast;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      ensureContainer();
    });
  } else {
    injectStyles();
    ensureContainer();
  }
})();
