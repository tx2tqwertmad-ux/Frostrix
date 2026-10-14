/* Интерфейсные штуки: тосты, модалки, снег, счётчики, анимации */
const UI = {
  toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 2800);
    setTimeout(() => el.remove(), 3200);
  },

  /* layer 1 — обычное окно, layer 2 — поверх него (например, соглашение) */
  modal(title, html, opts = {}) {
    const layer = opts.layer || 1;
    const root = document.getElementById(layer === 2 ? 'modal-root2' : 'modal-root');
    root.innerHTML = `
      <div class="overlay" id="overlay${layer}">
        <div class="modal ${opts.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
          <button class="modal-close" aria-label="Закрыть">×</button>
          ${title ? `<h2 class="modal-title">${title}</h2>` : ''}
          <div class="modal-body">${html}</div>
        </div>
      </div>`;
    const close = () => UI.closeModal(layer);
    root.querySelector('.modal-close').onclick = close;
    root.querySelector('.overlay').addEventListener('mousedown', e => { if (e.target.classList.contains('overlay')) close(); });
    UI._esc = UI._esc || [];
    UI._esc[layer] = close;
    document.onkeydown = e => { if (e.key === 'Escape') (UI._esc[2] && document.getElementById('overlay2') ? UI._esc[2] : UI._esc[1])(); };
    return root.querySelector('.modal');
  },

  closeModal(layer = 1) {
    const o = document.getElementById('overlay' + layer);
    if (!o) return;
    o.classList.add('closing');
    setTimeout(() => { document.getElementById(layer === 2 ? 'modal-root2' : 'modal-root').innerHTML = ''; }, 180);
  },

  /* Юридические окна с вкладками */
  legal(tab = 'terms') {
    const keys = ['terms', 'privacy', 'media'];
    const m = UI.modal('', `
      <div class="seg" id="legalTabs">${keys.map(k => `<button data-k="${k}">${k === 'terms' ? 'Соглашение' : k === 'privacy' ? 'Политика' : 'Медиа'}</button>`).join('')}</div>
      <div class="legal" id="legalBody"></div>`, { wide: true, layer: 2 });
    const show = k => {
      $$('#legalTabs button', m).forEach(b => b.classList.toggle('active', b.dataset.k === k));
      $('#legalBody', m).innerHTML = `<h2>${LEGAL[k][0]}</h2>` + LEGAL[k][1].map(p => `<p>${Util.esc(Util.t(p))}</p>`).join('');
    };
    $$('#legalTabs button', m).forEach(b => b.onclick = () => show(b.dataset.k));
    show(tab);
  },

  /* Баннер cookie */
  cookies() {
    if (Store.get('cookie_consent')) return;
    const el = document.createElement('div');
    el.className = 'cookie';
    el.innerHTML = `<p>Сайт использует только необходимые данные браузера для входа и корректной работы. <a href="#" id="ckMore">Подробнее</a></p><button class="btn btn-primary btn-sm" id="ckOk">Понятно</button>`;
    document.body.appendChild(el);
    el.querySelector('#ckOk').onclick = () => { Store.set('cookie_consent', 1); el.classList.add('out'); setTimeout(() => el.remove(), 350); };
    el.querySelector('#ckMore').onclick = e => { e.preventDefault(); UI.legal('privacy'); };
  },

  counters(root = document) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const target = +el.dataset.count, dur = 1100, start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ru-RU');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },

  /* Падающий снег */
  snow() {
    const c = document.getElementById('snow'), ctx = c.getContext('2d');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { c.style.display = 'none'; return; }
    let w, h; const flakes = [];
    const resize = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    const n = Math.min(90, Math.floor(innerWidth / 18));
    for (let i = 0; i < n; i++) flakes.push(UI._flake(true));
    (function loop() {
      ctx.clearRect(0, 0, w, h);
      flakes.forEach(f => {
        f.y += f.v; f.x += Math.sin((f.y + f.p) / 40) * 0.4;
        if (f.y > h + 10) Object.assign(f, UI._flake(false));
        ctx.beginPath(); ctx.fillStyle = `rgba(${f.c}, ${f.a})`; ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(loop);
    })();
  },
  _flake(anywhere) {
    const gold = Math.random() < 0.55;
    return { x: Math.random() * innerWidth, y: anywhere ? Math.random() * innerHeight : -10,
      r: Math.random() * 2.6 + 0.8, v: Math.random() * 0.9 + 0.35, p: Math.random() * 200,
      c: gold ? '245,179,1' : '150,190,230', a: gold ? Math.random() * 0.35 + 0.2 : Math.random() * 0.4 + 0.25 };
  }
};

/* Голова игрока: своя аватарка (если игрок загрузил её в профиле) или голова из Minecraft.
   Без интернета показывается буква. */
const Head = {
  AV_RE: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/,
  _raw: null, _map: {},
  /* аватарка зарегистрированного пользователя по нику (или null) */
  custom(nick) {
    let raw = null;
    try { raw = localStorage.getItem('frx_users'); } catch (e) {}
    if (raw !== Head._raw) {
      Head._raw = raw; Head._map = {};
      try { (JSON.parse(raw) || []).forEach(u => { if (u.avatar && Head.AV_RE.test(u.avatar)) Head._map[u.nick.toLowerCase()] = u.avatar; }); } catch (e) {}
    }
    return Head._map[String(nick).toLowerCase()] || null;
  },
  letter(nick) {
    const hue = [...nick].reduce((a, c) => a + c.charCodeAt(0), 0) % 40 + 25;
    return `<span class="avatar" style="background:hsl(${hue} 90% 62%)">${Util.esc((nick[0] || '?').toUpperCase())}</span>`;
  },
  img(nick, size = 40) {
    const mine = Head.custom(nick);
    if (mine) return `<span class="head head-custom" style="width:${size}px;height:${size}px"><img src="${mine}" alt=""></span>`;
    const safe = encodeURIComponent(nick);
    return `<span class="head" style="width:${size}px;height:${size}px"><img src="https://mc-heads.net/avatar/${safe}/${size * 2}" alt="" loading="lazy" onerror="Head.fail(this)" data-nick="${Util.esc(nick)}"></span>`;
  },
  fail(img) { img.parentElement.outerHTML = Head.letter(img.dataset.nick); }
};

/* Загрузка своей аватарки: файл → квадрат 160×160 → маленькая картинка в localStorage */
const Avatar = {
  MAX_FILE: 5 * 1024 * 1024,
  fromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject('Файл не выбран');
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject('Подойдёт PNG, JPG, WebP или GIF');
      if (file.size > Avatar.MAX_FILE) return reject('Файл слишком большой — максимум 5 МБ');
      const fr = new FileReader();
      fr.onerror = () => reject('Не удалось прочитать файл');
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject('Не удалось открыть картинку');
        img.onload = () => {
          const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
          const ctx = c.getContext('2d'), side = Math.min(img.width, img.height);
          ctx.fillStyle = '#fff7de'; ctx.fillRect(0, 0, S, S);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
          resolve(c.toDataURL('image/jpeg', 0.88));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
};
