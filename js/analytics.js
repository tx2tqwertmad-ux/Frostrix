/* Аналитика, присутствие на сайте, статус сервера и журнал действий.
   ВАЖНО: сайт хранит данные в localStorage, поэтому статистика собирается
   в ЭТОМ браузере. Чтобы видеть всех посетителей сразу, нужен серверный бэкенд —
   вся работа с данными собрана здесь, так что заменить хранилище будет просто. */
const Analytics = {
  page: 'home',

  vid() {
    let v = null;
    try { v = localStorage.getItem('frx_vid'); if (!v) { v = Util.uid(); localStorage.setItem('frx_vid', v); } } catch (e) { v = 'anon'; }
    return v;
  },
  sid() {
    try { let s = sessionStorage.getItem('frx_sid'); if (!s) { s = Util.uid(); sessionStorage.setItem('frx_sid', s); } return s; }
    catch (e) { return 'nosid'; }
  },

  /* событие: view — просмотр страницы; login; copy_ip; title */
  track(k, p) {
    const me = Auth.current(), ev = Store.get('events', []);
    ev.push({ t: Date.now(), k, p: p || '', v: Analytics.vid(), n: me ? me.nick : '' });
    Store.set('events', ev.length > 15000 ? ev.slice(-12000) : ev);
  },
  events() { return Store.get('events', []); },

  /* присутствие: каждая открытая вкладка раз в 15 с отмечается в списке */
  beat() {
    const me = Auth.current(), m = Store.get('presence', {}), now = Date.now();
    Object.keys(m).forEach(k => { if (now - m[k].t > 60000) delete m[k]; });
    m[Analytics.sid()] = { n: me ? me.nick : '', p: Analytics.page, t: now };
    Store.set('presence', m);
  },
  leave() { const m = Store.get('presence', {}); delete m[Analytics.sid()]; Store.set('presence', m); },
  online() {
    const now = Date.now(), m = Store.get('presence', {});
    return Object.entries(m).filter(([, x]) => now - x.t < 45000).map(([id, x]) => ({ id, n: x.n, p: x.p, t: x.t })).sort((a, b) => b.t - a.t);
  },
  start() {
    Analytics.beat();
    setInterval(Analytics.beat, 15000);
    addEventListener('pagehide', Analytics.leave);
  },

  /* онлайн Minecraft-сервера через публичный API mcsrvstat.us */
  _srv: null,
  async server(force) {
    const ip = (CONFIG.ip || '').trim();
    if (!ip) return null;
    const c = Analytics._srv;
    if (!force && c && c.ip === ip && Date.now() - c.t < 60000) return c.data;
    let data = null;
    try {
      const r = await fetch('https://api.mcsrvstat.us/3/' + encodeURIComponent(ip), { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        data = { online: !!d.online, players: d.players ? d.players.online || 0 : 0, max: d.players ? d.players.max || 0 : 0,
          list: ((d.players && d.players.list) || []).map(x => x.name).filter(Boolean), version: d.version || '' };
      }
    } catch (e) { data = null; }
    Analytics._srv = { ip, t: Date.now(), data };
    return data;
  }
};

/* Журнал действий персонала */
const Audit = {
  log(text) {
    const me = Auth.current(), l = Store.get('audit', []);
    l.unshift({ t: Date.now(), by: me ? me.nick : '—', text });
    Store.set('audit', l.slice(0, 500));
  },
  list() { return Store.get('audit', []); }
};
