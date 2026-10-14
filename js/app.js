/* Роутер и шапка */
const ROUTES = ['home', 'rules', 'team', 'priv', 'voice', 'title', 'media', 'csp', 'ideas', 'tops', 'helper', 'profile', 'admin'];

const App = {
  route(track) {
    clearTimeout(Pages._topsTimer); clearInterval(Pages._admTimer);
    if (Pages._chatOff) { Pages._chatOff(); Pages._chatOff = null; }
    const parts = (location.hash || '#/home').split('/'), page = parts[1] || 'home', sub = parts[2];
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.p === page));
    $('#nav').classList.remove('open');
    document.title = `${CONFIG.name} | ${PAGE_LABEL[page] || 'Страница не найдена'}`;
    if (page === 'ideas' && /^\d+$/.test(sub || '')) $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.p === 'ideas'));
    Analytics.page = page;
    if (track === true && ROUTES.includes(page)) Analytics.track('view', page);
    if (ROUTES.includes(page)) Pages[page](sub); else Pages.notFound();
  },

  /* Название, логотип, меню и подвал — из CONFIG (меняются в панели) */
  applyBrand() {
    $('#logoText').textContent = CONFIG.name;
    $('#logoMark').textContent = CONFIG.logo;
    $('#footName').textContent = CONFIG.name;
    $('#hIp').hidden = !CONFIG.ip;
    $('#nav').innerHTML = NAV.map(([p, t]) => `<a href="#/${p}" data-p="${p}">${t}</a>`).join('')
      + (CONFIG.shop ? `<a href="${Util.esc(CONFIG.shop)}" target="_blank" rel="noopener" class="nav-ext">Магазин <i>↗</i></a>` : '');
    document.title = `${CONFIG.name} | ${PAGE_LABEL[Analytics.page] || ''}`;
    const page = (location.hash || '#/home').split('/')[1] || 'home';
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.p === page));
  },

  refreshHeader() {
    const me = Auth.current(), box = $('#headerUser');
    if (!me) {
      box.innerHTML = `<button class="btn btn-ghost btn-sm" id="hLogin">Вход</button><button class="btn btn-primary btn-sm" id="hReg">Регистрация</button>`;
      $('#hLogin').onclick = () => Auth.openModal('login');
      $('#hReg').onclick = () => Auth.openModal('register');
    } else {
      box.innerHTML = `
        ${(() => { const un = Seen.unread(); return un.total ? `<a class="notif" href="#/ideas/${un.first}" title="Новые ответы в твоих темах">💬 ${un.total}</a>` : ''; })()}
        ${Auth.can('moder') ? '<a class="btn btn-ghost btn-sm" href="#/admin">Панель</a>' : ''}
        <a class="user-chip" href="#/profile">${Head.img(me.nick, 30)}<span>${Util.esc(me.nick)}</span></a>`;
    }
  },

  init() {
    App.applyBrand();
    $('#hIp').onclick = Pages.copyIp;
    $('#burger').onclick = () => $('#nav').classList.toggle('open');
    addEventListener('scroll', () => $('#header').classList.toggle('scrolled', scrollY > 8), { passive: true });
    addEventListener('hashchange', () => App.route(true));
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-legal]');
      if (a && !a.closest('#authForm')) { e.preventDefault(); UI.legal(a.dataset.legal); }
    });
    addEventListener('storage', e => { if (e.key && /^frx_(chat_|ideas)/.test(e.key)) App.refreshHeader(); });
    App.refreshHeader();
    UI.snow();
    UI.cookies();
    Analytics.start();
    App.route(true);
  }
};
App.init();
