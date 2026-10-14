/* Страницы сайта */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const roleBadge = role => `<span class="role role-${role}">${ROLES[role].label}</span>`;

/* ---------- вспомогательное: цвета для титула ---------- */
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
function gradientColors(colors, n) {
  if (colors.length === 1 || n <= 1) return Array(Math.max(n, 1)).fill(colors[0]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * (colors.length - 1), k = Math.min(Math.floor(t), colors.length - 2), f = t - k;
    const a = hex2rgb(colors[k]), b = hex2rgb(colors[k + 1]);
    out.push(rgb2hex(a.map((v, j) => v + (b[j] - v) * f)));
  }
  return out;
}

/* ---------- вспомогательное: ссылки медиа ---------- */
function parseLink(raw) {
  let url; try { url = new URL(raw.trim()); } catch (e) { return null; }
  const h = url.hostname.replace(/^www\.|^m\./, ''); let m;
  if (h === 'youtu.be') { const id = url.pathname.slice(1).split('/')[0]; return id ? { platform: 'YouTube', key: 'yt:' + id } : null; }
  if (h === 'youtube.com') {
    if ((m = url.pathname.match(/^\/shorts\/([\w-]{5,})/))) return { platform: 'YouTube', key: 'yt:' + m[1] };
    if (url.pathname === '/watch' && url.searchParams.get('v')) return { platform: 'YouTube', key: 'yt:' + url.searchParams.get('v') };
    return null;
  }
  if (h === 'tiktok.com') { if ((m = url.pathname.match(/\/video\/(\d+)/))) return { platform: 'TikTok', key: 'tt:' + m[1] }; return null; }
  if (h === 'vm.tiktok.com' || h === 'vt.tiktok.com') { const id = url.pathname.replace(/\//g, ''); return id ? { platform: 'TikTok', key: 'tt:' + id } : null; }
  return null;
}
function mediaMultiplier(user) {
  if (!user) return 1;
  const accepted = DB.media().filter(m => m.userId === user.id && m.status === 'accepted').map(m => m.created);
  const last = accepted.length ? Math.max(...accepted) : user.created;
  const days = (Date.now() - last) / 86400000;
  return Math.round((1 + Math.min(days, 30) / 30) * 10) / 10;
}

const Pages = {
  view(html) {
    $('#app').innerHTML = `<div class="page">${html}</div>`;
    window.scrollTo({ top: 0 });
    return $('#app');
  },
  head(chip, title, sub, action = '') {
    return `<div class="page-head"><div>${chip ? `<span class="chip">${chip}</span>` : ''}<h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${action}</div>`;
  },

  /* ================= ГЛАВНАЯ ================= */
  copyIp() {
    Analytics.track('copy_ip', Analytics.page);
    (navigator.clipboard ? navigator.clipboard.writeText(CONFIG.ip) : Promise.reject())
      .then(() => UI.toast('IP скопирован: ' + CONFIG.ip)).catch(() => UI.toast('IP: ' + CONFIG.ip));
  },

  home() {
    const s = CONFIG.social, ideas = DB.ideas(), teamN = new Set(TEAM.map(m => m.nick.toLowerCase())).size;
    const socials = [['telegram', 'TG', 'Telegram', 'Новости и объявления', 'tg'], ['vk', 'VK', 'ВКонтакте', 'Сообщество проекта', 'vk'], ['discord', 'DS', 'Discord', 'Чаты и тикеты', 'ds']].filter(([k]) => s[k]);
    const active = ideas.filter(i => ['open', 'work', 'accepted'].includes(i.status)).length, done = ideas.filter(i => i.status === 'fixed').length;
    const sections = [
      ['rules', '§', 'Правила', 'Свод положений для всех игроков', `v${RULES_VERSION}`],
      ['ideas', '✦', 'Идеи', 'Предложи идею или сообщи о недочёте', active ? `${active} в ленте` : ''],
      ['team', '♛', 'Команда', 'Досье администрации сервера', `${teamN}`],
      ['tops', '★', 'Топы', 'Главные рейтинги и награды', ''],
      ['priv', '♢', 'Привилегии', 'Свой префикс перед ником', ''],
      ['title', '✎', 'Титул', 'Собери титул с градиентом', ''],
      ['media', '▶', 'Медиа', 'Снимай ролики и получай койны', ''],
      ['voice', '☎', 'Войс-чат', 'Мод для голосового чата', ''],
      ['csp', '⊘', 'ЧСП', 'Чёрный список проекта', ''],
      ['helper', '✚', 'Стать Helper', 'Заявка в команду проекта', '']
    ];
    const recent = [...ideas].sort((x, y) => lastAct(y) - lastAct(x)).slice(0, 5);
    const app = Pages.view(`
      <section class="home-hero">
        <div class="crystal hh-crystal" aria-hidden="true">
          <div class="crystal-ring r1"></div><div class="crystal-ring r2"></div><div class="crystal-ring r3"></div>
          <div class="crystal-core">${Util.esc(CONFIG.logo)}</div>
        </div>
        <div class="hh-text">
          <span class="kicker">Анархия · официальный сайт</span>
          <h1 class="hero-title">Мир ${Util.esc(CONFIG.name)} ждёт тебя</h1>
          <p class="hero-sub">Анархия, где историю пишут сами игроки. Присоединяйся к сообществу, предлагай идеи и строй свой путь вместе с нами.</p>
          <div class="btn-row"><button class="btn btn-primary btn-lg" id="goStart">Как начать играть</button><a class="btn btn-ghost btn-lg" href="#/ideas">Предложить идею</a></div>
        </div>
        <aside class="status-card">
          <div class="status-line"><i class="sdot" id="srvDot"></i><b id="srvState">${CONFIG.showOnline ? 'Проверяем сервер…' : 'Сервер'}</b></div>
          <button class="ip-big" id="copyIp" type="button" title="Скопировать IP"><span class="muted small">IP сервера</span><b>${Util.esc(CONFIG.ip)}</b><span class="ip-copy">Нажми, чтобы скопировать</span></button>
          <div class="status-grid">
            <div><span class="muted small">Java</span><b>${Util.esc(CONFIG.javaVersions)}</b></div>
            <div><span class="muted small">Bedrock</span><b>${Util.esc(CONFIG.bedrockVersions)}</b></div>
          </div>
        </aside>
      </section>

      <section class="stats4">
        <div class="stat"><b id="statOnline">—</b><span>Игроков на сервере</span></div>
        <div class="stat"><b data-count="${DB.users().length}">0</b><span>Участников форума</span></div>
        <div class="stat"><b data-count="${active}">0</b><span>Идей в ленте</span></div>
        <div class="stat stat-gold"><b data-count="${done}">0</b><span>Идей выполнено</span></div>
      </section>

      <div class="home-cols">
        <section class="panel">
          <span class="kicker">Разделы</span><h2 class="home-h">Что здесь есть</h2>
          <div class="sec-grid">
            ${sections.map(([p, ic, t, d, badge]) => `<a class="sec-card" href="#/${p}"><span class="sec-ic">${ic}</span><span class="sec-txt"><b>${t}</b><small>${d}</small></span>${badge ? `<em class="sec-badge">${badge}</em>` : ''}</a>`).join('')}
          </div>
        </section>
        <section class="panel recent">
          <span class="kicker">Лента</span><h2 class="home-h">Последняя активность</h2>
          ${recent.length ? recent.map(i => { const n = Chat.count(i.id); return `<a class="recent-row" href="#/ideas/${i.id}">${Head.img(i.author, 36)}<span><b>${Util.esc(ideaTitle(i))}</b><small class="muted">${Util.esc(i.author)} · ${n} ${Util.plural(n, ['ответ', 'ответа', 'ответов'])} · ${Util.dateTime(lastAct(i))}</small></span>${statusTag(i.status)}</a>`; }).join('') : '<div class="empty">Пока тихо. Создай первую тему.</div>'}
          <a class="btn btn-ghost btn-block" href="#/ideas">Все темы →</a>
        </section>
      </div>

      ${socials.length ? `<section class="social-band">
        <div><span class="kicker">Мы на связи</span><h2 class="home-h">Присоединяйся к сообществу</h2><p class="muted">Новости сервера, объявления и живое общение с игроками.</p></div>
        <div class="social-cards">${socials.map(([k, t, n, d, c]) => `<a class="scard" href="${Util.esc(s[k])}" target="_blank" rel="noopener"><i class="sb-${c}">${t}</i><span><b>${n}</b><small>${d}</small></span><em>↗</em></a>`).join('')}</div>
      </section>` : ''}

      <section class="panel start" id="start">
        <span class="kicker">Быстрый старт</span><h2 class="home-h">Три шага до игры</h2>
        <div class="start-steps">
          <div class="sstep"><span>1</span><div><b>Скопируй IP</b><p class="muted">Java ${Util.esc(CONFIG.javaVersions)} или Bedrock ${Util.esc(CONFIG.bedrockVersions)}.</p><button class="btn btn-primary btn-sm" id="copyIp2" type="button">Скопировать ${Util.esc(CONFIG.ip)}</button></div></div>
          <div class="sstep"><span>2</span><div><b>Прочитай правила</b><p class="muted">Незнание правил не освобождает от ответственности.</p><a class="btn btn-ghost btn-sm" href="#/rules">Открыть правила</a></div></div>
          <div class="sstep"><span>3</span><div><b>Влейся в комьюнити</b><p class="muted">Зарегистрируйся на сайте и расскажи, чего не хватает серверу.</p><a class="btn btn-ghost btn-sm" href="#/ideas">К идеям</a></div></div>
        </div>
      </section>`);
    UI.counters(app);
    $('#copyIp', app).onclick = Pages.copyIp; $('#copyIp2', app).onclick = Pages.copyIp;
    $('#goStart', app).onclick = () => $('#start', app).scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (CONFIG.showOnline) Analytics.server().then(d => {
      const dot = $('#srvDot'), st = $('#srvState'), on = $('#statOnline');
      if (!dot) return;
      if (d && d.online) { dot.className = 'sdot ok'; st.textContent = 'Сервер доступен'; on.textContent = `${d.players} / ${d.max}`; }
      else if (d) { dot.className = 'sdot bad'; st.textContent = 'Сервер недоступен'; on.textContent = '0'; }
      else { st.textContent = 'Статус неизвестен'; }
    });
  },

  /* ================= ПРАВИЛА ================= */
  rules() {
    const pen = p => !p ? '' : `<div class="ladder">${p.map(([a, b]) => `<div class="lstep ${/навсегда/i.test(b) ? 'perm' : ''}"><span>${Util.esc(a)}</span><b>${Util.esc(b)}</b></div>`).join('')}</div>`;
    const item = it => typeof it === 'string' ? `<h3 class="rsub">${Util.esc(it)}</h3>` : `
      <article class="rule">
        <div class="rule-id">${Util.esc(it[0])}</div>
        <div><h3>${Util.esc(it[1])}</h3>${it[2] ? `<p>${Util.esc(it[2])}</p>` : ''}${pen(it[3])}</div>
      </article>`;
    const app = Pages.view(`
      ${Pages.head('Нормативная база', 'Правила сервера', `Свод положений, обязательных для всех игроков и сотрудников проекта ${Util.esc(CONFIG.name)}. Незнание правил не освобождает от ответственности.`)}
      <div class="rules-bar">
        <div class="notice">Версия ${RULES_VERSION} · редакция от ${RULES_UPDATED}</div>
        <input id="ruleSearch" type="search" placeholder="Поиск по правилам…" autocomplete="off">
      </div>
      <div class="doc">
        <aside class="toc" id="toc">
          ${RULES.map(s => `<button data-s="${s.n}"><b>${s.n}</b>${Util.esc(s.title)}</button>`).join('')}
        </aside>
        <div class="doc-body">
          ${RULES.map(s => `
            <section class="rsec" id="rs${s.n}" data-s="${s.n}">
              <h2><span class="num">${s.n}</span>${Util.esc(s.title)}</h2>
              ${s.items.map(item).join('')}
            </section>`).join('')}
          <div class="empty panel" id="noRules" hidden>По вашему запросу ничего не найдено.</div>
        </div>
      </div>
      <button class="to-top" id="toTop" aria-label="Наверх">↑</button>`);
    const tocBtns = $$('#toc button', app);
    tocBtns.forEach(b => b.onclick = () => $('#rs' + b.dataset.s).scrollIntoView({ behavior: 'smooth', block: 'start' }));
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) tocBtns.forEach(b => b.classList.toggle('active', b.dataset.s === e.target.dataset.s));
    }), { rootMargin: '-20% 0px -70% 0px' });
    $$('.rsec', app).forEach(s => spy.observe(s));
    tocBtns[0].classList.add('active');
    $('#ruleSearch', app).oninput = e => {
      const q = e.target.value.trim().toLowerCase();
      $$('.rule', app).forEach(r => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
      $$('.rsub', app).forEach(h => { h.hidden = !!q; });
      let any = false;
      $$('.rsec', app).forEach(sec => { const show = !q || $$('.rule', sec).some(r => !r.hidden); sec.hidden = !show; any = any || show; });
      $('#noRules', app).hidden = any;
    };
    const top = $('#toTop', app);
    top.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const onScroll = () => { if (!document.body.contains(top)) return removeEventListener('scroll', onScroll); top.classList.toggle('show', scrollY > 500); };
    addEventListener('scroll', onScroll, { passive: true });
  },

  /* ================= КОМАНДА ================= */
  team() {
    const groups = TEAM_ROLES.map(r => ({ r, list: TEAM.filter(m => m.role === r.id) })).filter(g => g.list.length);
    const total = new Set(TEAM.map(m => m.nick.toLowerCase())).size;
    const users = DB.users();
    const bioOf = nick => { const u = users.find(x => x.nick.toLowerCase() === nick.toLowerCase()); return u && u.bio ? u.bio : ''; };
    Pages.view(`
      ${Pages.head(`Команда ${Util.esc(CONFIG.name)}`, 'Состав администрации', `Люди, которые следят за порядком и развивают проект. Всего в команде: ${total}.`)}
      ${groups.length ? groups.map(({ r, list }) => `
        <section class="team-group">
          <div class="team-group-h"><span class="trole trole-${r.id}">${Util.esc(r.label)}</span><span class="muted">${list.length}</span></div>
          <div class="team-grid">
            ${list.map(m => { const bio = bioOf(m.nick); return `
              <article class="member member-${r.id}" data-nick="${Util.esc(m.nick)}" tabindex="0" role="button" aria-label="Открыть досье: ${Util.esc(m.nick)}">
                ${Head.img(m.nick, 64)}
                <div class="member-info">
                  <b>${Util.esc(m.nick)}</b>
                  <span class="trole trole-${r.id} sm">${Util.esc(r.label)}</span>
                  ${bio ? `<p class="member-bio">${Util.nl2br(bio)}</p>` : ''}
                  <span class="member-more">Открыть досье →</span>
                </div>
              </article>`; }).join('')}
          </div>
        </section>`).join('') : '<div class="panel empty">Список команды пока пуст.</div>'}`);
    const app = $('#app');
    $$('.member', app).forEach(el => {
      el.onclick = () => Pages.dossier(el.dataset.nick);
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Pages.dossier(el.dataset.nick); } };
    });
  },

  /* ---------- досье участника команды ---------- */
  dossier(nick) {
    const low = nick.toLowerCase(), d = DOSSIERS[low] || {};
    const roles = TEAM.filter(m => m.nick.toLowerCase() === low).map(m => TEAM_ROLES.find(r => r.id === m.role)).filter(Boolean);
    const u = DB.users().find(x => x.nick.toLowerCase() === low);
    const about = d.about || (u && u.bio) || '';
    const duties = String(d.duties || '').split('\n').map(x => x.trim()).filter(Boolean);
    const ideas = DB.ideas(), led = ideas.filter(i => i.assignee && i.assignee.toLowerCase() === low).length;
    const said = Chat.allMessages().filter(m => !m.sys && m.author && m.author.toLowerCase() === low).length;
    const contact = d.contact ? (/^https?:\/\//i.test(d.contact) ? `<a href="${Util.esc(d.contact)}" target="_blank" rel="noopener">${Util.esc(d.contact.replace(/^https?:\/\//i, ''))}</a>` : Util.esc(d.contact)) : '';
    const rows = [['В команде с', d.since ? Util.esc(d.since) : ''], ['Связь', contact], ['На сайте с', u ? Util.date(u.created) : '']].filter(r => r[1]);
    const filled = d.post || about || duties.length || rows.length;
    const rc = roles[0] ? roles[0].id : 'mod';
    UI.modal('', `<div class="dos member-${rc}">
      <div class="dos-top">${Head.img(nick, 112)}
        <div class="dos-id"><h2>${Util.esc(nick)}</h2>
          <div class="dos-roles">${roles.map(r => `<span class="trole trole-${r.id}">${Util.esc(r.label)}</span>`).join('')}</div>
          ${d.post ? `<p class="dos-post">${Util.esc(d.post)}</p>` : ''}</div></div>
      ${about ? `<div class="dos-sec"><h3>О себе</h3><p>${Util.nl2br(about)}</p></div>` : ''}
      ${duties.length ? `<div class="dos-sec"><h3>Чем занимается</h3><ul class="dos-duties">${duties.map(x => `<li>${Util.esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${rows.length ? `<dl class="dos-grid">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
      <div class="dos-stats"><div class="stat"><b>${led}</b><span>Идей ведёт</span></div><div class="stat"><b>${said}</b><span>Сообщений в чатах идей</span></div></div>
      ${filled ? '' : `<p class="muted dos-empty">Досье пока не заполнено.${Auth.can('admin') ? ' Заполнить: Панель → «Команда».' : ''}</p>`}
    </div>`, { wide: true });
  },

  /* ================= ПРИВИЛЕГИИ ================= */
  priv() {
    const P = PRIV_CUSTOM, me = Auth.current(), L = CONFIG.priv || {};
    const label = (url, kind) => {
      const u = String(url || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      return kind === 'telegram' ? '@' + u.replace(/^t\.me\//i, '') : u;
    };
    const links = [['discord', 'Discord', 'DS'], ['telegram', 'Telegram', 'TG']].filter(([k]) => L[k]);
    const nick = Util.esc(me ? me.nick : 'Steve');
    Pages.view(`
      ${Pages.head('Привилегии', P.title, P.tagline)}
      <section class="panel panel-gold priv-hero">
        <div class="priv-copy">
          <h2>${Util.esc(P.tagline)}</h2>
          <p>${Util.esc(P.lead)}</p>
          ${CONFIG.shop ? `<a class="btn btn-primary" href="${Util.esc(CONFIG.shop)}" target="_blank" rel="noopener">Купить в магазине ↗</a>` : ''}
        </div>
        <div class="priv-demo" aria-hidden="true">
          <div class="nameplate priv-plate"><span class="pfx pfx-default">[CUSTOM]</span><em>${nick}</em></div>
          <div class="priv-arrow">↓ меняется на твой текст ↓</div>
          <div class="nameplate priv-plate"><span class="pfx pfx-own">[Твой стиль]</span><em>${nick}</em></div>
        </div>
      </section>

      <div class="priv-cols">
        <section class="panel">
          <h2>${Util.esc(P.whatTitle)}</h2>
          <p>${Util.esc(P.what)}</p>
        </section>
        <section class="panel">
          <h2>${Util.esc(P.howTitle)}</h2>
          <p>${Util.esc(P.how)}</p>
          ${links.length ? `<div class="priv-links">${links.map(([k, n, t]) => `
            <a class="social" href="${Util.esc(L[k])}" target="_blank" rel="noopener"><i>${t}</i><span>${n}<small>${Util.esc(label(L[k], k))}</small></span></a>`).join('')}</div>` : ''}
        </section>
      </div>

      <section class="panel">
        <h2>${Util.esc(P.rulesTitle)}</h2>
        <ul class="checks">${P.rules.map(t => `<li>${Util.esc(t)}</li>`).join('')}</ul>
        <div class="notice priv-tip">${Util.esc(P.tip)}</div>
      </section>`);
  },

  /* ================= ВОЙС-ЧАТ ================= */
  voice() {
    const app = Pages.view(`
      ${Pages.head(`Голосовая связь ${Util.esc(CONFIG.name)}`, 'Simple Voice Chat', 'Выбери версию Minecraft и загрузчик — ссылка на нужный файл подставится сама.')}
      <div class="panel vc-card">
        <h2>Скачать мод</h2>
        <p class="muted">На сервере сейчас используется Minecraft ${Util.esc(CONFIG.serverVersion)}.</p>
        <div class="vc-selects">
          <label>Версия Minecraft
            <select id="vcVer"><option value="">Выбери версию</option>${VC_VERSIONS.map(v => `<option>${v}</option>`).join('')}</select></label>
          <label>Загрузчик
            <select id="vcLoader" disabled><option value="">Сначала выбери версию</option>${VC_LOADERS.map(l => `<option>${l}</option>`).join('')}</select></label>
        </div>
        <div class="vc-result" id="vcResult"></div>
        <p class="muted small">Файлы скачиваются напрямую с Modrinth. Сайт не хранит и не изменяет эти файлы. Перед скачиванием проверь версию игры и загрузчик.</p>
      </div>
      <h2 class="section-h">Как установить</h2>
      <p class="muted">Всего три шага.</p>
      <div class="steps3">
        <div class="step"><span>1</span><b>Выбери свою версию</b><p>Укажи версию Minecraft и загрузчик, которыми пользуешься.</p></div>
        <div class="step"><span>2</span><b>Закинь мод в папку</b><p>Скачай jar и положи его в <code>.minecraft/mods</code>. Распаковывать не надо.</p></div>
        <div class="step"><span>3</span><b>Зайди на сервер</b><p>Нажми <kbd>V</kbd> и выбери свой микрофон.</p></div>
      </div>`);
    const ver = $('#vcVer', app), ld = $('#vcLoader', app), res = $('#vcResult', app);
    const upd = () => {
      ld.disabled = !ver.value;
      if (!ver.value) { ld.value = ''; ld.options[0].textContent = 'Сначала выбери версию'; res.innerHTML = ''; return; }
      ld.options[0].textContent = 'Выбери загрузчик';
      if (!ld.value) { res.innerHTML = ''; return; }
      const url = `https://modrinth.com/plugin/simple-voice-chat/versions?g=${encodeURIComponent(ver.value)}&l=${ld.value.toLowerCase()}`;
      res.innerHTML = `<div class="vc-file"><span class="vc-icon">🎙</span><div><b>Simple Voice Chat · ${Util.esc(ver.value)} · ${Util.esc(ld.value)}</b><span class="muted">Последняя стабильная версия</span></div>
        <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">Скачать Simple Voice Chat</a></div>`;
    };
    ver.onchange = upd; ld.onchange = upd;
  },

  /* ================= ТИТУЛ (конструктор) ================= */
  title() {
    const me = Auth.current();
    const st = { b: false, i: false, u: false, s: false, text: 'ТИТУЛ', colors: ['#f5b301', '#ff7a18'] };
    const app = Pages.view(`
      ${Pages.head('', 'Кастомный титул', 'Собери свой титул: стиль, цвета и градиент. Готовый код вставляется в игре.')}
      <div class="title-grid">
        <div class="panel preview">
          <h2>Превью</h2>
          <div class="nameplate"><span id="tPrev"></span><em>${Util.esc(me ? me.nick : 'Steve')}</em></div>
          <svg class="skin" viewBox="0 0 64 128" shape-rendering="crispEdges" aria-label="Игрок">
            <rect x="16" y="0" width="32" height="32" fill="#c68b5a"/><rect x="16" y="0" width="32" height="10" fill="#4a3322"/>
            <rect x="22" y="16" width="6" height="6" fill="#fff"/><rect x="36" y="16" width="6" height="6" fill="#fff"/>
            <rect x="24" y="17" width="4" height="5" fill="#3b5bdb"/><rect x="36" y="17" width="4" height="5" fill="#3b5bdb"/>
            <rect x="26" y="26" width="12" height="3" fill="#8a5a3b"/>
            <rect x="16" y="32" width="32" height="48" fill="#2fb7c4"/><rect x="0" y="32" width="16" height="48" fill="#c68b5a"/><rect x="48" y="32" width="16" height="48" fill="#c68b5a"/>
            <rect x="16" y="80" width="16" height="48" fill="#3b4a9c"/><rect x="32" y="80" width="16" height="48" fill="#3b4a9c"/>
          </svg>
        </div>
        <div class="panel">
          <h2>Настройка титула</h2>
          <div class="field-label">Оформление текста <span class="muted">можно выбрать несколько</span></div>
          <div class="chips" id="tStyles">
            <button class="chip-btn" data-k="b"><b>Жирный</b></button>
            <button class="chip-btn" data-k="i"><i>Курсив</i></button>
            <button class="chip-btn" data-k="u"><u>Подч.</u></button>
            <button class="chip-btn" data-k="s"><s>Зачёрк.</s></button>
          </div>
          <label class="field">Текст титула <span class="muted" id="tCount"></span>
            <input id="tText" maxlength="${CONFIG.titleMaxLength}" value="${st.text}" autocomplete="off"></label>
          <div class="field-label">Цвета титула <span class="muted">добавь несколько для градиента</span></div>
          <div class="colors" id="tColors"></div>
          <button class="btn btn-ghost btn-sm" id="tAdd">+ Добавить цвет</button>
          <button class="btn btn-primary btn-block mt" id="tMake">Создать титул</button>
          <div class="code-box">
            <label class="field">Код титула (HEX)
              <div class="code-row"><input id="tCode" readonly placeholder="Нажми «Создать титул»"><button class="btn btn-ghost btn-sm" id="tCopy">Копир.</button></div></label>
          </div>
        </div>
      </div>`);

    const prev = $('#tPrev', app), colorsBox = $('#tColors', app), codeInp = $('#tCode', app);
    const chars = () => [...st.text];
    const render = () => {
      const cs = chars(), cols = gradientColors(st.colors, cs.length);
      prev.innerHTML = cs.length ? cs.map((c, i) => `<span style="color:${cols[i]}">${Util.esc(c)}</span>`).join('') : '<span class="muted">пусто</span>';
      prev.style.fontWeight = st.b ? '800' : '500';
      prev.style.fontStyle = st.i ? 'italic' : 'normal';
      prev.style.textDecoration = [st.u && 'underline', st.s && 'line-through'].filter(Boolean).join(' ') || 'none';
      $('#tCount', app).textContent = `${cs.length} / ${CONFIG.titleMaxLength}`;
      $$('#tStyles button', app).forEach(b => b.classList.toggle('active', st[b.dataset.k]));
    };
    const renderColors = () => {
      colorsBox.innerHTML = st.colors.map((c, i) => `
        <div class="color-item"><input type="color" value="${c}" data-i="${i}" aria-label="Цвет ${i + 1}">
        ${st.colors.length > 1 ? `<button class="x" data-rm="${i}" aria-label="Убрать цвет">×</button>` : ''}</div>`).join('');
      $$('input[type=color]', colorsBox).forEach(inp => inp.oninput = () => { st.colors[+inp.dataset.i] = inp.value; render(); });
      $$('[data-rm]', colorsBox).forEach(b => b.onclick = () => { st.colors.splice(+b.dataset.rm, 1); renderColors(); render(); });
      $('#tAdd', app).disabled = st.colors.length >= 6;
    };
    const makeCode = () => {
      const cs = chars(), cols = gradientColors(st.colors, cs.length);
      const styles = (st.b ? '&l' : '') + (st.i ? '&o' : '') + (st.u ? '&n' : '') + (st.s ? '&m' : '');
      return cs.map((c, i) => '&#' + cols[i].slice(1).toUpperCase() + styles + c).join('');
    };
    $$('#tStyles button', app).forEach(b => b.onclick = () => { st[b.dataset.k] = !st[b.dataset.k]; render(); });
    $('#tText', app).oninput = e => { st.text = e.target.value; render(); };
    $('#tAdd', app).onclick = () => { st.colors.push(st.colors[st.colors.length - 1]); renderColors(); render(); };
    $('#tMake', app).onclick = () => {
      if (!chars().length) return UI.toast('Введите текст титула', 'err');
      codeInp.value = makeCode();
      codeInp.classList.remove('flash'); void codeInp.offsetWidth; codeInp.classList.add('flash');
      if (me) { const saved = Store.get('titles_' + me.id, []); saved.unshift({ code: codeInp.value, text: st.text, colors: st.colors.slice(), created: Date.now() }); Store.set('titles_' + me.id, saved.slice(0, 10)); }
      Analytics.track('title', 'title'); UI.toast('Титул создан');
    };
    $('#tCopy', app).onclick = () => {
      if (!codeInp.value) return UI.toast('Сначала создайте титул', 'err');
      (navigator.clipboard ? navigator.clipboard.writeText(codeInp.value) : Promise.reject())
        .then(() => UI.toast('Код скопирован')).catch(() => { codeInp.select(); UI.toast('Выделено — нажмите Ctrl+C'); });
    };
    renderColors(); render();
  },

  /* ================= МЕДИА ================= */
  media() {
    const me = Auth.current(), all = DB.media();
    const count = s => all.filter(m => m.status === s).length;
    const paid = all.filter(m => m.status === 'accepted').reduce((a, m) => a + (m.reward || 0), 0);
    const mult = mediaMultiplier(me);
    const mine = me ? all.filter(m => m.userId === me.id).sort((a, b) => b.created - a.created) : [];
    const stl = { new: 'На проверке', accepted: 'Принята', rejected: 'Отклонена' };
    const app = Pages.view(`
      ${Pages.head('Медиа-программа', 'Снимаешь контент?', '')}
      <p class="lead">Кидай свои ТикТок-видосы и YouTube Shorts про сервер — мы посчитаем просмотры и выдадим награду: <b>1 просмотр = 1 Койн</b>. Чем дольше не снимал — тем выше множитель неактивности (до <b>x2.0</b>)! Обязательно укажи в видео хештег <b>#${Util.tag()}</b>.</p>
      <div class="stats5">
        <div class="stat"><b data-count="${count('new')}">0</b><span>Активных</span></div>
        <div class="stat"><b data-count="${count('accepted')}">0</b><span>Успешных</span></div>
        <div class="stat"><b data-count="${count('rejected')}">0</b><span>Отклонённых</span></div>
        <div class="stat"><b data-count="${paid}">0</b><span>Койнов выплачено</span></div>
        <div class="stat stat-gold"><b>x${mult.toFixed(1)}</b><span>Множитель · обновлено только что</span></div>
      </div>
      <div class="panel">
        <form class="form" id="mForm">
          <label>Твой ник<input name="nick" value="${Util.esc(me ? me.nick : '')}" ${me ? 'readonly' : ''} placeholder="Войдите, чтобы отправить заявку"></label>
          <div class="field-label">Ссылки на видео <span class="muted">макс. 5</span></div>
          <div id="links" class="links"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="addLink">+ Добавить ссылку</button>
          <p class="muted small">Принимаются обычные, короткие и мобильные ссылки YouTube и TikTok. Дубли удаляются автоматически. <a href="#" data-legal="media">Условия программы</a>.</p>
          <div id="checkRes" class="check-res"></div>
          <div class="btn-row">
            <button class="btn btn-primary">Отправить на проверку</button>
            <button type="button" class="btn btn-ghost" id="quick">Быстро проверить ссылки</button>
          </div>
        </form>
      </div>
      ${mine.length ? `<div class="panel"><h2>Мои заявки</h2>${mine.map(m => `
        <div class="row-static"><span>${Util.date(m.created)} · ${m.links.length} шт.</span>
        <span>${m.status === 'accepted' ? `<b>+${Util.num(m.reward)}</b> ` : ''}<span class="status st-${m.status}">${stl[m.status]}</span></span></div>`).join('')}</div>` : ''}`);
    UI.counters(app);

    const box = $('#links', app); let n = 1;
    const addRow = () => {
      const d = document.createElement('div'); d.className = 'link-row';
      d.innerHTML = `<input placeholder="https://www.youtube.com/shorts/…" autocomplete="off"><button type="button" class="x" aria-label="Убрать">×</button>`;
      d.querySelector('.x').onclick = () => { if (box.children.length > 1) { d.remove(); $('#addLink', app).disabled = false; } else d.querySelector('input').value = ''; };
      box.appendChild(d);
    };
    addRow();
    $('#addLink', app).onclick = e => { if (box.children.length < 5) addRow(); if (box.children.length >= 5) e.target.disabled = true; };
    const values = () => $$('input', box).map(i => i.value.trim()).filter(Boolean);
    const analyse = () => {
      const known = new Set(DB.media().flatMap(m => m.links.map(l => l.key))), seen = new Set();
      return values().map(u => {
        const p = parseLink(u);
        if (!p) return { u, ok: false, msg: 'Не похоже на ссылку YouTube или TikTok' };
        if (seen.has(p.key)) return { u, ok: false, msg: 'Дубль в этой заявке' };
        seen.add(p.key);
        if (known.has(p.key)) return { u, ok: false, msg: 'Это видео уже отправлено' };
        return { u, ok: true, p, msg: p.platform + ': всё в порядке' };
      });
    };
    $('#quick', app).onclick = () => {
      const r = analyse(), out = $('#checkRes', app);
      out.innerHTML = r.length ? r.map(x => `<div class="chk ${x.ok ? 'good' : 'bad'}"><i>${x.ok ? '✓' : '✕'}</i><span>${Util.esc(x.msg)}<small>${Util.esc(x.u.slice(0, 60))}</small></span></div>`).join('') : '<div class="chk bad"><i>✕</i><span>Добавь хотя бы одну ссылку</span></div>';
    };
    $('#mForm', app).onsubmit = e => {
      e.preventDefault();
      if (!Auth.require()) return;
      const r = analyse();
      if (!r.length) return UI.toast('Добавь хотя бы одну ссылку', 'err');
      const bad = r.find(x => !x.ok);
      if (bad) { $('#quick', app).click(); return UI.toast(bad.msg, 'err'); }
      const list = DB.media();
      list.push({ id: Util.uid(), userId: me.id, nick: me.nick, links: r.map(x => ({ url: x.u, platform: x.p.platform, key: x.p.key, views: null })), status: 'new', reward: 0, created: Date.now() });
      DB.saveMedia(list); UI.toast('Заявка отправлена модератору'); Pages.media();
    };
  },

  /* ================= ЧСП ================= */
  csp() {
    const list = DB.blacklist().slice().sort((a, b) => b.created - a.created);
    const canDel = Auth.can('moder');
    const app = Pages.view(`
      ${Pages.head('Список проекта', 'ЧСП-игроки', `Игроки, внесённые в чёрный список проекта. Всего записей: ${list.length}.`,
        Auth.can('helper') ? '<button class="btn btn-primary" id="addBl">Добавить игрока</button>' : '')}
      <div class="panel table-wrap">
        <table class="table">
          <thead><tr><th>Игрок</th><th>Причина</th><th>Дата бана</th><th>Модератор</th><th>Связанные аккаунты</th>${canDel ? '<th></th>' : ''}</tr></thead>
          <tbody>${list.length ? list.map(b => `
            <tr><td><span class="player-cell">${Head.img(b.nick, 38)}<b>${Util.esc(b.nick)}</b></span></td>
            <td>${Util.esc(b.reason)}</td><td>${Util.date(b.created)}</td><td>${Util.esc(b.by)}</td>
            <td>${b.linked && b.linked.length ? b.linked.map(Util.esc).join(', ') : '—'}</td>
            ${canDel ? `<td><button class="link-btn" data-del="${b.id}">Убрать</button></td>` : ''}</tr>`).join('')
            : '<tr><td colspan="6" class="empty">Список пуст — это хорошая новость.</td></tr>'}</tbody>
        </table>
      </div>`);
    $$('[data-del]', app).forEach(b => b.onclick = () => {
      if (!confirm('Убрать игрока из ЧСП?')) return;
      const gone = DB.blacklist().find(x => x.id === b.dataset.del); DB.saveBlacklist(DB.blacklist().filter(x => x.id !== b.dataset.del)); Audit.log('Убран из ЧСП: ' + (gone ? gone.nick : '')); UI.toast('Игрок убран из списка'); Pages.csp();
    });
    const add = $('#addBl', app);
    if (add) add.onclick = () => {
      const m = UI.modal('Добавить в ЧСП', `<form class="form" id="bForm">
        <label>Ник игрока<input name="nick" required maxlength="16"></label>
        <label>Причина<input name="reason" required maxlength="140" placeholder="Например: запрещённое ПО (2.4)"></label>
        <label>Связанные аккаунты <span class="muted">через запятую, необязательно</span><input name="linked"></label>
        <button class="btn btn-primary btn-block">Внести в список</button></form>`);
      $('#bForm', m).onsubmit = e => {
        e.preventDefault(); const f = new FormData(e.target), l = DB.blacklist();
        l.push({ id: Util.uid(), nick: f.get('nick').trim(), reason: f.get('reason').trim(), by: Auth.current().nick, created: Date.now(),
          linked: f.get('linked').split(',').map(s => s.trim()).filter(Boolean) });
        DB.saveBlacklist(l); Audit.log('Добавлен в ЧСП: ' + l[l.length - 1].nick); UI.closeModal(); UI.toast('Игрок добавлен в ЧСП'); Pages.csp();
      };
    };
  },

  /* ================= ТОПЫ (слайдер) ================= */
  tops() {
    let idx = 0, mode = 'rating', dir = 1;
    const app = Pages.view(`
      ${Pages.head('Рейтинг сервера', `Лучшие игроки ${Util.esc(CONFIG.name)}`, 'Главные рейтинги сервера. Награды за призовые места выдаются койнами. Лента переключается автоматически раз в 15 секунд.')}
      <div class="panel carousel">
        <div class="car-top">
          <div class="seg" id="modeSeg"><button data-m="rating" class="active">Рейтинг</button><button data-m="rewards">Награды</button></div>
          <div class="car-nav"><button id="prev" aria-label="Назад">‹</button><span class="dots" id="dots"></span><button id="next" aria-label="Вперёд">›</button></div>
        </div>
        <div class="car-timer"><i id="timerBar"></i></div>
        <div class="car-stage" id="stage"></div>
      </div>`);
    const stage = $('#stage', app), bar = $('#timerBar', app);
    const board = () => {
      const b = TOPS[idx], rew = b.rewards && b.rewards.some(r => r > 0);
      stage.innerHTML = `<div class="board ${dir > 0 ? 'in-next' : 'in-prev'}">
        <div class="board-head"><span class="board-icon">${b.icon}</span><div><h2>${Util.esc(b.title)}</h2><p class="muted">${Util.esc(b.sub)}</p></div><span class="tag ${rew ? 'tag-ok' : ''}">${rew ? 'Награды в койнах' : 'Без наград'}</span></div>
        ${b.rows.length ? b.rows.map((r, i) => `
          <div class="rank-row rr${i + 1} ${mode}">
            <span class="rk">${i + 1}</span>
            ${Head.img(r[0], 40)}
            <b class="rn">${Util.esc(r[0])}</b>
            <span class="rv"><em>${Util.num(r[1])} ${Util.esc(b.unit)}</em><small>${rew && b.rewards[i] > 0 ? Util.coins(b.rewards[i]) : 'Награда не предусмотрена'}</small></span>
          </div>`).join('') : '<div class="empty">Рейтинг пока пуст.</div>'}
        ${rew ? '' : '<p class="muted small">* В этом рейтинге награды не выдаются.</p>'}</div>`;
      $('#dots', app).innerHTML = TOPS.map((_, i) => `<i class="${i === idx ? 'on' : ''}" data-i="${i}"></i>`).join('');
      $$('#dots i', app).forEach(d => d.onclick = () => go(+d.dataset.i > idx ? 1 : -1, +d.dataset.i));
    };
    const timer = () => {
      clearTimeout(Pages._topsTimer);
      bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = 'timer 15s linear';
      Pages._topsTimer = setTimeout(() => go(1), 15000);
    };
    const go = (d, to) => { dir = d; idx = to !== undefined ? to : (idx + d + TOPS.length) % TOPS.length; board(); timer(); };
    $('#prev', app).onclick = () => go(-1);
    $('#next', app).onclick = () => go(1);
    $$('#modeSeg button', app).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#modeSeg button', app).forEach(x => x.classList.toggle('active', x === b)); dir = 1; board(); });
    board(); timer();
  },

  /* ================= СТАТЬ HELPER ================= */
  helper() {
    const me = Auth.current();
    const pending = me && DB.apps().some(a => a.userId === me.id && a.status === 'new');
    const app = Pages.view(`
      ${Pages.head(`Команда ${Util.esc(CONFIG.name)}`, 'Заявка на Helper', 'Расскажи о себе и покажи, как бы ты помогал игрокам в сложных ситуациях. Ответы попадут только администрации.')}
      <div class="panel panel-gold before"><h2>Перед отправкой</h2><ul class="checks">${HELPER_BEFORE.map(t => `<li>${Util.esc(t)}</li>`).join('')}</ul></div>
      ${!me ? '<div class="panel empty">Подать заявку могут только зарегистрированные игроки. <a href="#" id="loginLink">Войти или создать аккаунт</a></div>'
      : pending ? '<div class="panel empty">Ваша заявка на рассмотрении. Решение появится в профиле.</div>'
      : `<form id="hForm" class="form hform">
        <div class="panel">
          <div class="sec-h"><span>01</span><h2>О тебе</h2></div>
          <div class="grid2">
            <label>Игровой никнейм *<input name="nick" value="${Util.esc(me.nick)}" required></label>
            <label>Возраст *<input name="age" type="number" min="10" max="99" required></label>
            <label>Telegram для связи *<input name="tg" placeholder="@username" required></label>
            <label>Почта для связи *<input name="mail" type="email" required></label>
            <label>Часовой пояс *<select name="tz" required><option value="">Выбери ответ</option>${TIMEZONES.map(t => `<option>${t}</option>`).join('')}</select></label>
            <label>Играли ли вы с читами? *<select name="cheats" required><option value="">Выбери ответ</option><option>Нет</option><option>Да</option></select></label>
          </div>
          <label>Расскажите о себе * <span class="muted" id="wc">Не менее 30 слов · 0</span><textarea name="about" rows="5" required></textarea></label>
        </div>
        <div class="panel">
          <div class="sec-h"><span>02</span><h2>Ситуации и правила</h2></div>
          <p class="muted">Ответь своими словами. Нам важнее ход мыслей, чем короткие заученные фразы.</p>
          ${HELPER_QUESTIONS.map((q, i) => `<label class="q"><span><i>${i + 1}</i>${Util.esc(q)} *</span><textarea name="q${i}" rows="2" required></textarea></label>`).join('')}
        </div>
        <label class="check"><input type="checkbox" name="consent" required><span>Подтверждаю, что ответы мои и указанный адрес почты принадлежит мне. Согласен на обработку данных для рассмотрения заявки.</span></label>
        <button class="btn btn-primary btn-lg">Отправить заявку →</button>
      </form>`}`);
    const ll = $('#loginLink', app); if (ll) ll.onclick = e => { e.preventDefault(); Auth.openModal(); };
    const f = $('#hForm', app);
    if (f) {
      const about = f.elements.about, wc = $('#wc', app);
      about.oninput = () => { const n = Util.words(about.value); wc.textContent = `Не менее 30 слов · ${n}`; wc.classList.toggle('okc', n >= 30); };
      f.onsubmit = e => {
        e.preventDefault();
        if (Util.words(about.value) < 30) { about.focus(); return UI.toast('В рассказе о себе нужно не менее 30 слов', 'err'); }
        const d = Object.fromEntries(new FormData(f)); const answers = HELPER_QUESTIONS.map((q, i) => ({ q, a: d['q' + i] }));
        const l = DB.apps();
        l.push({ id: Util.uid(), userId: me.id, nick: d.nick, age: d.age, tg: d.tg, mail: d.mail, tz: d.tz, cheats: d.cheats, about: d.about, answers, status: 'new', created: Date.now() });
        DB.saveApps(l); UI.toast('Заявка отправлена'); Pages.helper();
      };
    }
  },

  /* ================= ПРОФИЛЬ ================= */
  profile() {
    const me = Auth.current();
    if (!me) { location.hash = '#/home'; return Auth.openModal(); }
    const apps = DB.apps().filter(a => a.userId === me.id), titles = Store.get('titles_' + me.id, []);
    const st = { new: 'На рассмотрении', accepted: 'Принята', rejected: 'Отклонена' };
    const hasAv = !!Head.custom(me.nick);
    const app = Pages.view(`
      <div class="profile panel">
        ${Head.img(me.nick, 74)}
        <div><h1>${Util.esc(me.nick)}</h1>${roleBadge(me.role)}<p class="muted">На форуме с ${Util.date(me.created)}</p>
          ${me.bio ? `<p class="profile-bio">${Util.nl2br(me.bio)}</p>` : ''}</div>
        <button class="btn btn-ghost" id="logout">Выйти</button>
      </div>
      <div class="panel"><h2>Редактирование профиля</h2>
        <div class="edit-profile">
          <div class="avatar-edit">
            <div id="avPrev">${Head.img(me.nick, 112)}</div>
            <div class="avatar-btns">
              <button class="btn btn-primary btn-sm" id="avPick" type="button">Загрузить фото</button>
              <button class="btn btn-ghost btn-sm" id="avDel" type="button" ${hasAv ? '' : 'hidden'}>Убрать</button>
              <input type="file" id="avFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
            </div>
            <p class="muted small">PNG, JPG, WebP или GIF до 5 МБ. Фото обрежется до квадрата. Если фото нет, показывается голова из Minecraft.</p>
          </div>
          <form class="form" id="bioForm">
            <label>О себе <span class="muted" id="bioCnt"></span>
              <textarea name="bio" rows="5" maxlength="${Auth.BIO_MAX}" placeholder="Расскажи о себе в паре предложений: чем играешь, что любишь на сервере…">${Util.esc(me.bio || '')}</textarea></label>
            <div class="form-error" id="bioErr"></div>
            <div><button class="btn btn-primary">Сохранить</button></div>
          </form>
        </div>
      </div>
      <div class="panel pwa" id="pwaBox"><h2>Приложение на компьютер</h2><div id="pwaBody"></div></div>
      <div class="panel"><h2>Мои заявки на Helper</h2>
        ${apps.length ? apps.map(a => `<div class="row-static"><span>${Util.date(a.created)}</span><span class="status st-${a.status}">${st[a.status]}</span></div>`).join('')
        : '<div class="empty">Заявок пока нет. <a href="#/helper">Подать заявку</a></div>'}</div>
      <div class="panel"><h2>Мои титулы</h2>
        ${titles.length ? titles.map(t => `<div class="row-static"><span class="mono">${Util.esc(t.code)}</span><button class="link-btn ok" data-copy="${Util.esc(t.code)}">Копировать</button></div>`).join('')
        : '<div class="empty">Вы ещё не создавали титулы. <a href="#/title">Открыть конструктор</a></div>'}</div>
      <div class="panel"><h2>Смена пароля</h2>
        <form class="form" id="pwForm" autocomplete="off">
          <label>Текущий пароль<input name="old" type="password" required></label>
          <label>Новый пароль<input name="n1" type="password" required placeholder="Минимум 6 символов"></label>
          <label>Повторите новый пароль<input name="n2" type="password" required></label>
          <div class="form-error" id="pwErr"></div>
          <button class="btn btn-primary">Сменить пароль</button>
        </form></div>`);
    Pages.pwaBox($('#pwaBody', app));
    /* аватарка */
    const file = $('#avFile', app);
    $('#avPick', app).onclick = () => file.click();
    file.onchange = () => {
      const f = file.files[0]; file.value = '';
      Avatar.fromFile(f).then(url => {
        const err = Auth.setAvatar(url);
        if (err) return UI.toast(err, 'err');
        UI.toast('Аватарка обновлена'); App.refreshHeader(); Pages.profile();
      }).catch(msg => UI.toast(msg, 'err'));
    };
    $('#avDel', app).onclick = () => { Auth.setAvatar(null); UI.toast('Аватарка убрана'); App.refreshHeader(); Pages.profile(); };
    /* о себе */
    const bio = $('#bioForm', app).elements.bio, cnt = $('#bioCnt', app);
    const upd = () => { cnt.textContent = `${bio.value.length} / ${Auth.BIO_MAX}`; };
    bio.oninput = upd; upd();
    $('#bioForm', app).onsubmit = e => {
      e.preventDefault();
      const err = Auth.setBio(bio.value);
      if (err) { $('#bioErr', app).textContent = err; return; }
      UI.toast('Профиль сохранён'); Pages.profile();
    };
    $('#pwForm', app).onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target);
      const err = Auth.changePassword(f.get('old'), f.get('n1'), f.get('n2'));
      if (err) { $('#pwErr', app).textContent = err; return; }
      e.target.reset(); $('#pwErr', app).textContent = ''; UI.toast('Пароль изменён');
    };
    $('#logout', app).onclick = () => { Auth.logout(); App.refreshHeader(); UI.toast('Вы вышли из аккаунта'); location.hash = '#/home'; };
    $$('[data-copy]', app).forEach(b => b.onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(() => UI.toast('Код скопирован')).catch(() => UI.toast('Не удалось скопировать', 'err')); });
  },

  /* ---------- «Установить как приложение» ---------- */
  pwaBox(box) {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const intro = `<div class="pwa-row"><img src="icons/icon-192.png" alt="" class="pwa-icon"><div>
      <b>Сайт как программа</b>
      <p class="muted">Своя иконка на рабочем столе и в меню «Пуск», отдельное окно без вкладок браузера и работа даже без сети (кроме голов игроков и онлайна сервера).</p></div></div>`;
    const draw = () => {
      if (!document.body.contains(box)) return;
      const standaloneNow = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      let st;
      if (standaloneNow) st = '<p class="pwa-ok">✓ Ты уже открыл сайт как приложение.</p>';
      else if (location.protocol === 'file:') st = '<p class="pwa-warn">Сейчас сайт открыт как файл, а браузер разрешает установку только с адреса. Запусти сайт через <code>start.bat</code> (откроется <code>http://localhost:8080</code>) и вернись сюда.</p>';
      else if (window.__pwa && __pwa.prompt) st = '<button class="btn btn-primary" id="pwaInstall">Установить приложение</button>';
      else st = '<p class="muted">Нажми значок установки в правой части адресной строки Chrome или Edge либо меню ⋮ → «Установить…» / «Приложения». В Firefox установка на ПК не поддерживается.</p>';
      box.innerHTML = intro + st;
      const b = $('#pwaInstall', box);
      if (b) b.onclick = async () => {
        const ev = __pwa.prompt; if (!ev) return;
        ev.prompt(); const r = await ev.userChoice; __pwa.prompt = null;
        if (r.outcome === 'accepted') UI.toast('Приложение устанавливается…'); draw();
      };
    };
    draw();
    document.addEventListener('pwa-ready', draw, { once: true });
    document.addEventListener('pwa-installed', () => { UI.toast('Приложение установлено'); draw(); }, { once: true });
  },

  notFound() {
    Pages.view(`<div class="empty-page"><h1>404</h1><p class="muted">Такой страницы нет.</p><a class="btn btn-primary" href="#/home">На главную</a></div>`);
  }
};
