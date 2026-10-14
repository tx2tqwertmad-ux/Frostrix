/* Панель управления: обзор, аналитика, онлайн, заявки, пользователи, журнал, настройки, топы */
const PAGE_LABEL = Object.assign(Object.fromEntries(NAV), { profile: 'Профиль', admin: 'Панель' });
const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const countBy = (list, ts) => { const m = {}; list.forEach(x => { const k = dayKey(new Date(ts(x))); m[k] = (m[k] || 0) + 1; }); return m; };
function daysList(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) });
  }
  return out;
}
const ago = t => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s} с назад` : s < 3600 ? `${Math.floor(s / 60)} мин назад` : s < 86400 ? `${Math.floor(s / 3600)} ч назад` : Util.dateTime(t);
};
const statCard = (label, value, id = '', cls = '') => `<div class="stat ${cls}"><b ${id ? `id="${id}"` : ''}>${value}</b><span>${label}</span></div>`;

function barChart(title, items, map, step = 1) {
  const vals = items.map(d => map[d.key] || 0), max = Math.max(1, ...vals), sum = vals.reduce((a, b) => a + b, 0);
  return `<div class="panel chart"><div class="chart-head"><h2>${title}</h2><b>${Util.num(sum)}</b></div>
    <div class="bars">${items.map((d, i) => `<div class="bar" title="${d.label}: ${vals[i]}"><em>${vals[i] || ''}</em><i style="height:${vals[i] ? Math.max(vals[i] / max * 100, 4) : 1}%"></i><span>${i % step === 0 ? d.label : ''}</span></div>`).join('')}</div></div>`;
}

Pages.admin = function (tab) {
  clearInterval(Pages._admTimer);
  if (!Auth.can('moder')) { UI.toast('Недостаточно прав', 'err'); location.hash = '#/home'; return; }
  const isAdmin = Auth.can('admin');
  const pendApps = DB.apps().filter(a => a.status === 'new').length, pendMedia = DB.media().filter(m => m.status === 'new').length;
  const TABS = [['overview', 'Обзор', '▦', 0], ['analytics', 'Аналитика', '▤', 0], ['online', 'Онлайн', '●', 0],
    ['apps', 'Заявки Helper', '✎', pendApps], ['media', 'Медиа-заявки', '▶', pendMedia], ['users', 'Пользователи', '☺', 0], ['log', 'Журнал действий', '☰', 0]];
  if (isAdmin) TABS.push(['team', 'Команда', '♛', 0], ['settings', 'Настройки сайта', '⚙', 0], ['tops', 'Топы', '★', 0]);
  if (!TABS.some(t => t[0] === tab)) tab = 'overview';
  const app = Pages.view(`
    <div class="adm">
      <aside class="adm-nav">${TABS.map(([k, t, i, c]) => `<a href="#/admin/${k}" class="${k === tab ? 'active' : ''}"><i>${i}</i><span>${t}</span>${c ? `<b>${c}</b>` : ''}</a>`).join('')}</aside>
      <section class="adm-main" id="admMain"></section>
    </div>`);
  const reload = () => { const y = scrollY; Pages.admin(tab); scrollTo(0, y); };
  AdminTabs[tab]($('#admMain', app), reload, isAdmin);
};

const AdminTabs = {
  /* ---------- ОБЗОР ---------- */
  overview(main) {
    const users = DB.users(), ideas = DB.ideas(), apps = DB.apps(), media = DB.media();
    const today = dayKey(new Date());
    const viewsToday = Analytics.events().filter(e => e.k === 'view' && dayKey(new Date(e.t)) === today).length;
    const pend = apps.filter(a => a.status === 'new').length + media.filter(m => m.status === 'new').length;
    const log = Audit.list().slice(0, 8);
    main.innerHTML = `
      ${Auth.isDefaultAdmin() ? '<div class="alert">Пароль администратора всё ещё стандартный. Смени его в <a href="#/profile">профиле</a>.</div>' : ''}
      <h1 class="adm-h">Обзор</h1>
      <div class="cards">
        ${statCard('Сейчас на сайте', Analytics.online().length, 'ovOnline', 'stat-gold')}
        ${statCard('Игроков на сервере', CONFIG.ip ? '…' : '—', 'ovMc')}
        ${statCard('Пользователей', Util.num(users.length))}
        ${statCard('Просмотров сегодня', Util.num(viewsToday))}
        ${statCard('Сообщений всего', Util.num(ideas.length + apps.length + media.length + Chat.allMessages().filter(m => !m.sys).length))}
        ${statCard('Ждут проверки', pend)}
      </div>
      <p class="muted small adm-note">Статистика сайта собирается в этом браузере. Чтобы видеть всех посетителей сразу, сайту нужен серверный бэкенд.</p>
      <div class="adm-cols">
        <div class="panel"><h2>Очередь модерации</h2>
          <div class="row-static"><span>Заявки на Helper</span><a class="btn btn-ghost btn-sm" href="#/admin/apps">${apps.filter(a => a.status === 'new').length} новых</a></div>
          <div class="row-static"><span>Медиа-заявки</span><a class="btn btn-ghost btn-sm" href="#/admin/media">${media.filter(m => m.status === 'new').length} новых</a></div>
          <div class="row-static"><span>Идеи и недочёты открыты</span><a class="btn btn-ghost btn-sm" href="#/ideas">${ideas.filter(i => ['open', 'work', 'accepted'].includes(i.status)).length}</a></div>
        </div>
        <div class="panel"><h2>Последние действия</h2>
          ${log.length ? log.map(l => `<div class="row-static"><span><b>${Util.esc(l.by)}</b> · ${Util.esc(l.text)}</span><span class="muted small">${ago(l.t)}</span></div>`).join('') : '<div class="empty">Действий пока не было.</div>'}
        </div>
      </div>`;
    Analytics.server().then(s => { const el = $('#ovMc'); if (el) el.textContent = s ? (s.online ? `${s.players} / ${s.max}` : 'Офлайн') : 'нет данных'; });
    Pages._admTimer = setInterval(() => { const el = $('#ovOnline'); if (el) el.textContent = Analytics.online().length; }, 5000);
  },

  /* ---------- АНАЛИТИКА ---------- */
  analytics(main, reload) {
    const n = AdminTabs._days || 14, days = daysList(n), keys = new Set(days.map(d => d.key));
    const inP = ts => keys.has(dayKey(new Date(ts)));
    const ev = Analytics.events().filter(e => inP(e.t)), views = ev.filter(e => e.k === 'view');
    const ideas = DB.ideas().filter(i => i.type === 'idea'), bugs = DB.ideas().filter(i => i.type === 'bug'), apps = DB.apps(), media = DB.media(), users = DB.users();
    const msgTs = [...DB.ideas().map(i => i.created), ...Chat.allMessages().filter(m => !m.sys).map(m => m.ts), ...apps.map(a => a.created), ...media.map(m => m.created)];
    const cnt = (list, f) => list.filter(x => inP(f(x))).length;
    const byPage = {}; views.forEach(e => { byPage[e.p] = (byPage[e.p] || 0) + 1; });
    const pages = Object.entries(byPage).sort((a, b) => b[1] - a[1]), topV = pages.length ? pages[0][1] : 1;
    const hours = Array.from({ length: 24 }, (_, h) => ({ key: h, label: String(h) })), hMap = {};
    views.forEach(e => { const h = new Date(e.t).getHours(); hMap[h] = (hMap[h] || 0) + 1; });
    main.innerHTML = `
      <div class="adm-top"><h1 class="adm-h">Аналитика</h1>
        <div class="seg" id="period">${[7, 14, 30].map(d => `<button data-d="${d}" class="${d === n ? 'active' : ''}">${d} дн.</button>`).join('')}</div></div>
      <div class="cards">
        ${statCard('Просмотров страниц', Util.num(views.length), '', 'stat-gold')}
        ${statCard('Уникальных посетителей', new Set(views.map(e => e.v)).size)}
        ${statCard('Регистраций', cnt(users, u => u.created))}
        ${statCard('Идей', cnt(ideas, i => i.created))}
        ${statCard('Недочётов', cnt(bugs, i => i.created))}
        ${statCard('Заявок на Helper', cnt(apps, a => a.created))}
        ${statCard('Медиа-заявок', cnt(media, m => m.created))}
        ${statCard('Входов в аккаунт', ev.filter(e => e.k === 'login').length)}
        ${statCard('Копирований IP', ev.filter(e => e.k === 'copy_ip').length)}
        ${statCard('Создано титулов', ev.filter(e => e.k === 'title').length)}
      </div>
      <div class="adm-cols">
        ${barChart('Просмотры страниц', days, countBy(views, e => e.t), Math.ceil(n / 7))}
        ${barChart('Сообщения: идеи, недочёты и заявки', days, countBy(msgTs, t => t), Math.ceil(n / 7))}
      </div>
      <div class="adm-cols">
        ${barChart('Регистрации', days, countBy(users, u => u.created), Math.ceil(n / 7))}
        ${barChart('Активность по часам', hours, hMap, 3)}
      </div>
      <div class="panel"><h2>Популярные страницы</h2>
        ${pages.length ? pages.map(([p, c]) => `<div class="pg-row"><span>${Util.esc(PAGE_LABEL[p] || p)}</span><div class="pg-bar"><i style="width:${c / topV * 100}%"></i></div><b>${Util.num(c)}</b></div>`).join('') : '<div class="empty">За этот период просмотров нет.</div>'}
      </div>
      <p class="muted small adm-note">Данные собираются в этом браузере. Журнал просмотров хранит до 12 000 последних событий.</p>`;
    $$('#period button', main).forEach(b => b.onclick = () => { AdminTabs._days = +b.dataset.d; reload(); });
  },

  /* ---------- ОНЛАЙН ---------- */
  online(main) {
    main.innerHTML = `
      <div class="adm-top"><h1 class="adm-h">Онлайн</h1><button class="btn btn-ghost btn-sm" id="mcRefresh">Обновить сервер</button></div>
      <div class="cards">
        ${statCard('Сейчас на сайте', 0, 'olCount', 'stat-gold')}
        ${statCard('Игроков на сервере', CONFIG.ip ? '…' : '—', 'mcCount')}
        ${statCard('Статус сервера', '…', 'mcState')}
        ${statCard('Версия сервера', '—', 'mcVer')}
      </div>
      <div class="adm-cols">
        <div class="panel"><h2>Сейчас на сайте</h2>
          <div class="table-wrap"><table class="table"><thead><tr><th>Кто</th><th>Страница</th><th>Активность</th></tr></thead><tbody id="olBody"></tbody></table></div>
          <p class="muted small">Обновляется каждые 5 секунд. Считаются вкладки, активные за последние 45 секунд.</p></div>
        <div class="panel"><h2>Игроки на сервере</h2><div id="mcList" class="empty">Загрузка…</div>
          <p class="muted small">Данные берутся с адреса ${Util.esc(CONFIG.ip || '—')} через публичный сервис mcsrvstat.us.</p></div>
      </div>`;
    const draw = () => {
      const list = Analytics.online(); $('#olCount').textContent = list.length;
      $('#olBody').innerHTML = list.length ? list.map(x => `<tr><td>${x.n ? `<span class="player-cell">${Head.img(x.n, 28)}<b>${Util.esc(x.n)}</b></span>` : '<span class="muted">Гость</span>'}</td><td>${Util.esc(PAGE_LABEL[x.p] || x.p)}</td><td>${ago(x.t)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">Никого нет.</td></tr>';
    };
    const loadMc = force => Analytics.server(force).then(s => {
      if (!$('#mcCount')) return;
      $('#mcCount').textContent = s ? (s.online ? `${s.players} / ${s.max}` : '0') : '—';
      $('#mcState').textContent = s ? (s.online ? 'Онлайн' : 'Офлайн') : 'нет данных';
      $('#mcVer').textContent = s && s.version ? s.version : '—';
      $('#mcList').innerHTML = !s ? 'Не удалось получить данные. Проверь IP в настройках сайта.' : !s.online ? 'Сервер сейчас выключен или недоступен.'
        : s.list.length ? `<div class="chips">${s.list.map(n => `<span class="player-cell tag">${Head.img(n, 20)}${Util.esc(n)}</span>`).join('')}</div>`
        : s.players ? 'Сервер не отдаёт список ников.' : 'На сервере никого нет.';
    });
    draw(); loadMc();
    let tick = 0;
    Pages._admTimer = setInterval(() => { draw(); if (++tick % 12 === 0) loadMc(); }, 5000);
    $('#mcRefresh', main).onclick = () => { loadMc(true); UI.toast('Обновляю данные сервера'); };
  },

  /* ---------- ЗАЯВКИ НА HELPER ---------- */
  apps(main, reload) {
    const apps = DB.apps().slice().sort((a, b) => b.created - a.created), st = { new: 'Новая', accepted: 'Принята', rejected: 'Отклонена' };
    main.innerHTML = `<h1 class="adm-h">Заявки на Helper</h1>
      <div class="panel">${apps.length ? apps.map(a => `
        <div class="app-card">
          <div class="app-top"><b>${Util.esc(a.nick)}</b><span class="status st-${a.status}">${st[a.status]}</span></div>
          <div class="muted">Возраст: ${Util.esc(a.age)} · ${Util.esc(a.tg)} · ${Util.esc(a.mail)} · ${Util.esc(a.tz)} · Читы: ${Util.esc(a.cheats)} · ${Util.dateTime(a.created)}</div>
          <p>${Util.nl2br(a.about)}</p>
          <details><summary>Ответы на ситуации</summary>${(a.answers || []).map((x, i) => `<div class="qa"><b>${i + 1}. ${Util.esc(x.q)}</b><p>${Util.nl2br(x.a)}</p></div>`).join('')}</details>
          ${a.status === 'new' ? `<div class="app-actions"><button class="btn btn-primary btn-sm" data-ok="${a.id}">Принять</button><button class="btn btn-ghost btn-sm" data-no="${a.id}">Отклонить</button></div>` : ''}
        </div>`).join('') : '<div class="empty">Заявок нет.</div>'}</div>`;
    const decide = (id, status) => {
      const l = DB.apps(), a = l.find(x => x.id === id); a.status = status; DB.saveApps(l);
      if (status === 'accepted') { const us = DB.users(), u = us.find(x => x.id === a.userId); if (u && u.role === 'player') { u.role = 'helper'; DB.saveUsers(us); } }
      Audit.log(`${status === 'accepted' ? 'Принята' : 'Отклонена'} заявка на Helper от ${a.nick}`);
      UI.toast(status === 'accepted' ? 'Заявка принята, роль Helper выдана' : 'Заявка отклонена'); reload();
    };
    $$('[data-ok]', main).forEach(b => b.onclick = () => decide(b.dataset.ok, 'accepted'));
    $$('[data-no]', main).forEach(b => b.onclick = () => decide(b.dataset.no, 'rejected'));
  },

  /* ---------- МЕДИА-ЗАЯВКИ ---------- */
  media(main, reload) {
    const all = DB.media().slice().sort((a, b) => b.created - a.created), st = { new: 'На проверке', accepted: 'Принята', rejected: 'Отклонена' };
    main.innerHTML = `<h1 class="adm-h">Медиа-заявки</h1>
      <div class="panel">${all.length ? all.map(m => `
        <div class="app-card"><div class="app-top"><b>${Util.esc(m.nick)}</b><span><span class="muted">${Util.dateTime(m.created)}</span> <span class="status st-${m.status}">${st[m.status]}</span></span></div>
          ${m.links.map(l => `<div><span class="tag">${Util.esc(l.platform)}</span> <a href="${Util.esc(l.url)}" target="_blank" rel="noopener">${Util.esc(l.url.slice(0, 70))}</a></div>`).join('')}
          ${m.status === 'accepted' ? `<div class="muted">Начислено: <b>${Util.coins(m.reward || 0)}</b></div>` : ''}
          ${m.status === 'new' ? `<div class="app-actions"><button class="btn btn-primary btn-sm" data-mok="${m.id}">Принять и начислить</button><button class="btn btn-ghost btn-sm" data-mno="${m.id}">Отклонить</button></div>` : ''}</div>`).join('') : '<div class="empty">Медиа-заявок нет.</div>'}</div>`;
    $$('[data-mno]', main).forEach(b => b.onclick = () => {
      const l = DB.media(), m = l.find(x => x.id === b.dataset.mno); m.status = 'rejected'; DB.saveMedia(l);
      Audit.log(`Отклонена медиа-заявка от ${m.nick}`); UI.toast('Медиа-заявка отклонена'); reload();
    });
    $$('[data-mok]', main).forEach(b => b.onclick = () => {
      const l = DB.media(), m = l.find(x => x.id === b.dataset.mok);
      const views = parseInt(prompt('Сколько всего просмотров у роликов в заявке?'), 10);
      if (!(views >= 0)) return;
      const user = DB.users().find(u => u.id === m.userId), mult = mediaMultiplier(user);
      m.status = 'accepted'; m.reward = Math.round(views * mult); m.links[0].views = views; DB.saveMedia(l);
      Audit.log(`Принята медиа-заявка от ${m.nick}: ${Util.coins(m.reward)} (x${mult.toFixed(1)})`);
      UI.toast(`Начислено ${Util.coins(m.reward)} (x${mult.toFixed(1)})`); reload();
    });
  },

  /* ---------- ПОЛЬЗОВАТЕЛИ ---------- */
  users(main, reload, isAdmin) {
    const me = Auth.current(), ideas = DB.ideas(), apps = DB.apps(), media = DB.media();
    const cnt = u => ideas.filter(i => i.author === u.nick).length + apps.filter(a => a.userId === u.id).length + media.filter(m => m.userId === u.id).length;
    main.innerHTML = `<h1 class="adm-h">Пользователи</h1>
      <div class="panel"><input id="uSearch" type="search" placeholder="Поиск по нику…" autocomplete="off" class="u-search">
        <div class="table-wrap"><table class="table"><thead><tr><th>Ник</th><th>Регистрация</th><th>Сообщений</th><th>Роль</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody id="uBody"></tbody></table></div></div>`;
    const draw = () => {
      const q = $('#uSearch', main).value.trim().toLowerCase();
      const list = DB.users().filter(u => u.nick.toLowerCase().includes(q)).sort((a, b) => b.created - a.created);
      $('#uBody', main).innerHTML = list.length ? list.map(u => `<tr>
        <td><span class="player-cell">${Head.img(u.nick, 28)}<b>${Util.esc(u.nick)}</b></span></td><td>${Util.date(u.created)}</td><td>${cnt(u)}</td>
        <td>${isAdmin ? `<select data-role="${u.id}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>` : roleBadge(u.role)}</td>
        ${isAdmin ? `<td>${u.id !== me.id ? `<button class="link-btn" data-del="${u.id}">Удалить</button>` : ''}</td>` : ''}</tr>`).join('') : '<tr><td colspan="5" class="empty">Никого не найдено.</td></tr>';
      $$('[data-role]', main).forEach(s => s.onchange = () => {
        const us = DB.users(), u = us.find(x => x.id === s.dataset.role);
        if (u.role === 'admin' && s.value !== 'admin' && us.filter(x => x.role === 'admin').length < 2) { UI.toast('Нельзя снять роль с последнего админа', 'err'); s.value = 'admin'; return; }
        const old = ROLES[u.role].label; u.role = s.value; DB.saveUsers(us);
        Audit.log(`Роль ${u.nick}: ${old} → ${ROLES[u.role].label}`); UI.toast('Роль изменена');
      });
      $$('[data-del]', main).forEach(b => b.onclick = () => {
        const us = DB.users(), u = us.find(x => x.id === b.dataset.del);
        if (!confirm(`Удалить аккаунт ${u.nick}? Это действие нельзя отменить.`)) return;
        DB.saveUsers(us.filter(x => x.id !== u.id)); Audit.log(`Удалён аккаунт ${u.nick}`); UI.toast('Аккаунт удалён'); reload();
      });
    };
    $('#uSearch', main).oninput = draw; draw();
  },

  /* ---------- ЖУРНАЛ ---------- */
  log(main, reload, isAdmin) {
    const l = Audit.list();
    main.innerHTML = `<div class="adm-top"><h1 class="adm-h">Журнал действий</h1>${isAdmin && l.length ? '<button class="btn btn-ghost btn-sm" id="logClear">Очистить журнал</button>' : ''}</div>
      <div class="panel table-wrap"><table class="table"><thead><tr><th>Когда</th><th>Кто</th><th>Действие</th></tr></thead><tbody>
        ${l.length ? l.map(x => `<tr><td>${Util.dateTime(x.t)}</td><td><b>${Util.esc(x.by)}</b></td><td>${Util.esc(x.text)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">Журнал пуст.</td></tr>'}
      </tbody></table></div><p class="muted small adm-note">Хранятся последние 500 записей: заявки, роли, настройки, топы, ЧСП.</p>`;
    const c = $('#logClear', main);
    if (c) c.onclick = () => { if (confirm('Очистить журнал действий?')) { Store.set('audit', []); reload(); } };
  },

  /* ---------- КОМАНДА (админ) ---------- */
  team(main) {
    const byRole = id => TEAM.filter(m => m.role === id).map(m => m.nick).join('\n');
    const nicks = [...new Map(TEAM.map(m => [m.nick.toLowerCase(), m.nick])).values()];
    main.innerHTML = `<h1 class="adm-h">Команда</h1>
      <p class="muted adm-note">Впиши ники по одному в строке — они появятся на странице «Команда». Один ник можно указать в нескольких ролях (например, владелец и тех. администратор). Аватарка берётся из профиля игрока, а если он не зарегистрирован — голова из Minecraft.</p>
      <form id="teamForm" class="form">
        ${TEAM_ROLES.map(r => `<div class="panel top-ed"><div class="top-ed-h"><h2>${Util.esc(r.label)}</h2></div>
          <label>Ники <span class="muted">по одному в строке</span>
            <textarea rows="4" data-role="${r.id}" spellcheck="false">${Util.esc(byRole(r.id))}</textarea></label></div>`).join('')}
        <div class="btn-row"><button class="btn btn-primary">Сохранить команду</button><button type="button" class="btn btn-ghost" id="teamReset">Вернуть список из data.js</button></div>
      </form>
      <h1 class="adm-h adm-h2">Досье участников</h1>
      <p class="muted adm-note">Открывается на странице «Команда» по клику на человека. Пустые поля просто не показываются. «О себе» можно не заполнять — тогда возьмётся текст из его профиля.</p>
      <form id="dosForm" class="form">
        ${nicks.length ? nicks.map(n => { const d = DOSSIERS[n.toLowerCase()] || {}; return `<div class="panel top-ed" data-nick="${Util.esc(n)}">
          <div class="top-ed-h"><h2>${Head.img(n, 34)} ${Util.esc(n)}</h2></div>
          <label>Должность<input data-f="post" maxlength="80" value="${Util.esc(d.post || '')}" placeholder="Например: Куратор модерации"></label>
          <label>Чем занимается <span class="muted">каждый пункт с новой строки</span><textarea rows="4" data-f="duties" maxlength="800" spellcheck="false" placeholder="Следит за чатом\nРазбирает жалобы\nПроводит ивенты">${Util.esc(d.duties || '')}</textarea></label>
          <label>О себе<textarea rows="2" data-f="about" maxlength="300" placeholder="Пару слов о человеке">${Util.esc(d.about || '')}</textarea></label>
          <div class="grid2"><label>В команде с<input data-f="since" maxlength="40" value="${Util.esc(d.since || '')}" placeholder="Март 2026"></label>
          <label>Связь (Discord, Telegram или ссылка)<input data-f="contact" maxlength="120" value="${Util.esc(d.contact || '')}" placeholder="@nick или https://t.me/nick"></label></div>
        </div>`; }).join('') : '<div class="panel empty">Сначала добавь людей в состав выше.</div>'}
        ${nicks.length ? '<div class="btn-row"><button class="btn btn-primary">Сохранить досье</button></div>' : ''}
      </form>`;
    $('#dosForm', main).onsubmit = e => {
      e.preventDefault();
      const out = {};
      $$('[data-nick]', e.target).forEach(box => {
        const d = {};
        $$('[data-f]', box).forEach(el => { const v = el.value.replace(/\r/g, '').trim(); if (v) d[el.dataset.f] = v; });
        if (Object.keys(d).length) out[box.dataset.nick.toLowerCase()] = d;
      });
      DOSSIERS = out; Store.set('dossiers', out); Audit.log('Обновлены досье команды'); UI.toast('Досье сохранены');
    };
    $('#teamForm', main).onsubmit = e => {
      e.preventDefault();
      const next = [];
      for (const r of TEAM_ROLES) {
        const lines = $(`[data-role="${r.id}"]`, main).value.split('\n').map(x => x.trim()).filter(Boolean), seen = new Set();
        for (const nick of lines) {
          if (!/^[A-Za-z0-9_.\-]{1,20}$/.test(nick)) return UI.toast(`«${r.label}»: ник «${nick.slice(0, 20)}» не подходит — латиница, цифры, _ . -`, 'err');
          if (seen.has(nick.toLowerCase())) continue;
          seen.add(nick.toLowerCase()); next.push({ nick, role: r.id });
        }
      }
      TEAM = next; Store.set('team', next); Audit.log('Обновлён состав команды'); UI.toast('Команда сохранена'); AdminTabs.team(main);
    };
    $('#teamReset', main).onclick = () => {
      if (!confirm('Вернуть список команды из файла data.js? Твои изменения будут стёрты.')) return;
      localStorage.removeItem('frx_team'); Audit.log('Состав команды сброшен'); location.reload();
    };
  },

  /* ---------- НАСТРОЙКИ САЙТА (админ) ---------- */
  settings(main) {
    const groups = [
      ['Проект', [['name', 'Название проекта', 'Например: MyServer', 24], ['logo', 'Символ в логотипе (1–2 знака)', '❄', 2]]],
      ['Подключение', [['ip', 'Айпи сервера', 'play.example.com', 60], ['javaVersions', 'Версии Java', '1.19.4 — 1.21.8', 40], ['bedrockVersions', 'Версии Bedrock', '1.21.100 — 1.26+', 40], ['serverVersion', 'Версия сервера (для войс-чата)', '1.21.8', 20]]],
      ['Ссылки', [['vk', 'ВКонтакте', 'https://vk.com/…', 200], ['telegram', 'Telegram', 'https://t.me/…', 200], ['discord', 'Discord', 'https://dsc.gg/…', 200], ['shop', 'Магазин (вкладка в меню)', 'https://…', 200], ['reportBot', 'Бот обращений (Telegram)', 'https://t.me/…', 200]]],
      ['Страница «Привилегии»', [['priv_discord', 'Discord для тикетов', 'https://dsc.gg/…', 200], ['priv_telegram', 'Telegram поддержки', 'https://t.me/…', 200]]]
    ];
    const val = k => ['vk', 'telegram', 'discord'].includes(k) ? CONFIG.social[k] : k.startsWith('priv_') ? CONFIG.priv[k.slice(5)] : CONFIG[k];
    main.innerHTML = `<h1 class="adm-h">Настройки сайта</h1>
      <form id="setForm" class="form">
        ${groups.map(([t, f]) => `<div class="panel"><h2>${t}</h2><div class="grid2">${f.map(([k, l, ph, max]) => `<label>${l}<input name="${k}" value="${Util.esc(val(k))}" placeholder="${Util.esc(ph)}" maxlength="${max}" autocomplete="off"></label>`).join('')}</div>
          ${t === 'Ссылки' || t.startsWith('Страница') ? '<p class="muted small">Пустое поле — кнопка или вкладка с этой ссылкой пропадает с сайта. Ссылка должна начинаться с https://</p>' : ''}</div>`).join('')}
        <div class="panel"><h2>Главная страница</h2>
          <label class="check"><input type="checkbox" name="showOnline" ${CONFIG.showOnline ? 'checked' : ''}><span>Показывать онлайн сервера на главной (данные берутся с mcsrvstat.us)</span></label></div>
        <div class="btn-row"><button class="btn btn-primary">Сохранить</button><button type="button" class="btn btn-ghost" id="setReset">Сбросить к стандартным</button></div>
      </form>`;
    $('#setForm', main).onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target)), s = {};
      f.name = f.name.trim(); f.ip = f.ip.trim().toLowerCase();
      if (!f.name) return UI.toast('Название проекта не может быть пустым', 'err');
      if (!/^[a-z0-9.\-:_]+$/.test(f.ip)) return UI.toast('Айпи: только латиница, цифры, точки и порт, без https:// и пробелов', 'err');
      for (const k of ['vk', 'telegram', 'discord', 'shop', 'reportBot', 'priv_discord', 'priv_telegram']) {
        f[k] = f[k].trim();
        if (f[k] && !/^https?:\/\/\S+$/i.test(f[k])) return UI.toast(`Ссылка «${k}» должна начинаться с https://`, 'err');
      }
      ['name', 'logo', 'ip', 'javaVersions', 'bedrockVersions', 'serverVersion', 'shop', 'reportBot', 'vk', 'telegram', 'discord', 'priv_discord', 'priv_telegram'].forEach(k => { s[k] = f[k].trim(); });
      s.logo = s.logo || '❄'; s.showOnline = !!f.showOnline;
      Store.set('settings', s);
      ['name', 'logo', 'ip', 'javaVersions', 'bedrockVersions', 'serverVersion', 'shop', 'reportBot'].forEach(k => { CONFIG[k] = s[k]; });
      ['vk', 'telegram', 'discord'].forEach(k => { CONFIG.social[k] = s[k]; });
      ['discord', 'telegram'].forEach(k => { CONFIG.priv[k] = s['priv_' + k]; });
      CONFIG.showOnline = s.showOnline; Analytics._srv = null;
      Audit.log('Изменены настройки сайта (название, IP и ссылки)');
      App.applyBrand(); UI.toast('Настройки сохранены');
    };
    $('#setReset', main).onclick = () => {
      if (!confirm('Вернуть название, IP и ссылки к стандартным значениям?')) return;
      localStorage.removeItem('frx_settings'); Audit.log('Настройки сайта сброшены'); location.reload();
    };
  },

  /* ---------- ТОПЫ (админ) ---------- */
  tops(main) {
    main.innerHTML = `<h1 class="adm-h">Топы</h1>
      <p class="muted adm-note">Впиши игроков и значения из игры — сайт сам расставит места по убыванию. Награды выдаются койнами за места по порядку; если поле наград пустое, у топа наград нет.</p>
      <form id="topForm" class="form">
        ${TOPS.map((b, i) => `<div class="panel top-ed">
          <div class="top-ed-h"><span class="board-icon sm">${b.icon}</span><h2>${Util.esc(b.title)}</h2><span class="tag">значение: ${Util.esc(b.unit)}</span></div>
          <label>Игроки — по одному в строке: ник; значение <span class="muted">до 10 строк</span>
            <textarea rows="10" data-rows="${i}" spellcheck="false">${b.rows.map(r => r[0] + '; ' + r[1]).join('\n')}</textarea></label>
          <label>Награды по местам, койнов — через запятую <span class="muted">пусто — награды не выдаются</span>
            <input data-rew="${i}" value="${Util.esc((b.rewards || []).join(', '))}" placeholder="например: 5000, 3500, 2500"></label>
        </div>`).join('')}
        <div class="btn-row"><button class="btn btn-primary">Сохранить топы</button><button type="button" class="btn btn-ghost" id="topReset">Вернуть примеры</button></div>
      </form>`;
    $('#topForm', main).onsubmit = e => {
      e.preventDefault();
      const next = [];
      for (let i = 0; i < TOPS.length; i++) {
        const b = TOPS[i], rows = [], lines = $(`[data-rows="${i}"]`, main).value.split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length > 10) return UI.toast(`«${b.title}»: максимум 10 строк`, 'err');
        for (let j = 0; j < lines.length; j++) {
          const parts = lines[j].split(/[;|\t]/).map(s => s.trim()), nick = parts[0], v = Number((parts[1] || '').replace(/[\s_]/g, '').replace(',', '.'));
          if (!/^[A-Za-z0-9_.\-]{1,20}$/.test(nick) || parts.length < 2 || !isFinite(v) || v < 0) return UI.toast(`«${b.title}», строка ${j + 1}: нужен формат «ник; число»`, 'err');
          rows.push([nick, v]);
        }
        rows.sort((a, b2) => b2[1] - a[1]);
        const rawRew = $(`[data-rew="${i}"]`, main).value.split(/[,;\s]+/).filter(Boolean), rewards = rawRew.map(Number);
        if (rewards.some(r => !isFinite(r) || r < 0)) return UI.toast(`«${b.title}»: награды — только числа через запятую`, 'err');
        next.push(Object.assign({}, b, { rows, rewards: rewards.map(Math.round) }));
      }
      TOPS = next; Store.set('tops', next); Audit.log('Обновлены топы'); UI.toast('Топы сохранены'); AdminTabs.tops(main);
    };
    $('#topReset', main).onclick = () => {
      if (!confirm('Вернуть примеры из файла data.js? Твои данные топов будут стёрты.')) return;
      localStorage.removeItem('frx_tops'); Audit.log('Топы сброшены к примерам'); location.reload();
    };
  }
};
