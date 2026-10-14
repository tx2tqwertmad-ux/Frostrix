/* Хранилище на localStorage + вспомогательные функции */
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem('frx_' + key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  },
  set(key, val) { try { localStorage.setItem('frx_' + key, JSON.stringify(val)); } catch (e) {} },
  reset() { Object.keys(localStorage).filter(k => k.startsWith('frx_')).forEach(k => localStorage.removeItem(k)); }
};

const Util = {
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  },
  hash(str) { // простой хэш — это локальный сайт
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  },
  date(ts) { return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); },
  dateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  },
  num: n => Number(n).toLocaleString('ru-RU'),
  nl2br: s => Util.esc(s).replace(/\n/g, '<br>'),
  words: s => s.trim().split(/\s+/).filter(Boolean).length,
  plural(n, f) { n = Math.abs(n) % 100; const d = n % 10; if (n > 10 && n < 20) return f[2]; if (d > 1 && d < 5) return f[1]; if (d === 1) return f[0]; return f[2]; },
  coins: n => Util.num(n) + ' ' + Util.plural(n, ['койн', 'койна', 'койнов']),
  tag: () => (CONFIG.name || 'server').toLowerCase().replace(/[^a-zа-яё0-9_]/gi, ''),
  t: s => String(s).split('{name}').join(CONFIG.name).split('{tag}').join(Util.tag())
};

const ROLES = {
  player: { label: 'Игрок',     rank: 0 },
  helper: { label: 'Helper',    rank: 1 },
  moder:  { label: 'Модератор', rank: 2 },
  admin:  { label: 'Админ',     rank: 3 }
};

/* Стартовые данные при первом запуске */
(function seed() {
  if (Store.get('seeded_v2')) return;
  const now = Date.now(), day = 86400000;
  Store.set('users', [
    { id: 'u_admin', nick: 'admin', pass: Util.hash('admin123'), role: 'admin', created: now - 90 * day },
    { id: 'u_ice',   nick: 'IceWalker', pass: Util.hash('123456'), role: 'moder', created: now - 60 * day },
    { id: 'u_kry',   nick: 'Kryogen', pass: Util.hash('123456'), role: 'player', created: now - 30 * day }
  ]);
  Store.set('blacklist', [
    { id: 'b1', nick: 'TestPlayer', reason: 'Тестовая запись', by: 'admin', created: now - 10 * day, linked: [] },
    { id: 'b2', nick: 'xXCheaterXx', reason: 'Запрещённое ПО (2.4)', by: 'IceWalker', created: now - 6 * day, linked: ['xXCheater2'] }
  ]);
  Store.set('ideas', [
    { id: 1, type: 'idea', status: 'open', author: 'Kryogen', created: now - 9 * day,
      text: 'Добавить особые спавнеры, которые спавнят больше мобов за раз, а лимит можно повышать за артефакты. Тогда фарма на спавнерах сможет конкурировать с пасеками.' },
    { id: 2, type: 'idea', status: 'open', author: 'IceWalker', created: now - 4 * day,
      text: 'Переработать магазин скупщика: сменный ассортимент раз в сутки и особые товары за монеты + очки скупщика.' },
    { id: 3, type: 'bug', status: 'fixed', author: 'Kryogen', created: now - 14 * day, text: 'Команда /rtp long телепортирует на слишком маленькие координаты.' },
    { id: 4, type: 'bug', status: 'fixed', author: 'DeadPixel', created: now - 12 * day, text: 'В /daily ключ от минного поля не приходит после покупки.' }
  ]);
  Store.set('applications', []);
  Store.set('media', [
    { id: 'm1', userId: 'u_kry', nick: 'Kryogen', links: [{ url: 'https://www.youtube.com/shorts/abc123', platform: 'YouTube', key: 'yt:abc123', views: 18200 }], status: 'accepted', reward: 21840, created: now - 20 * day },
    { id: 'm2', userId: 'u_ice', nick: 'IceWalker', links: [{ url: 'https://www.tiktok.com/@ice/video/7712345', platform: 'TikTok', key: 'tt:7712345', views: 9400 }], status: 'accepted', reward: 9400, created: now - 11 * day }
  ]);
  Store.set('seeded_v2', 1);
})();

const DB = {
  users: () => Store.get('users', []),            saveUsers: v => Store.set('users', v),
  blacklist: () => Store.get('blacklist', []),    saveBlacklist: v => Store.set('blacklist', v),
  ideas: () => Store.get('ideas', []),            saveIdeas: v => Store.set('ideas', v),
  apps: () => Store.get('applications', []),      saveApps: v => Store.set('applications', v),
  media: () => Store.get('media', []),            saveMedia: v => Store.set('media', v)
};

/* Настройки и топы, изменённые через панель (поверх значений из data.js) */
(function applyOverrides() {
  const s = Store.get('settings', null);
  if (s) {
    ['name', 'logo', 'ip', 'javaVersions', 'bedrockVersions', 'serverVersion', 'shop', 'reportBot'].forEach(k => { if (typeof s[k] === 'string') CONFIG[k] = s[k]; });
    ['vk', 'telegram', 'discord'].forEach(k => { if (typeof s[k] === 'string') CONFIG.social[k] = s[k]; });
    ['discord', 'telegram'].forEach(k => { if (typeof s['priv_' + k] === 'string') CONFIG.priv[k] = s['priv_' + k]; });
    if (typeof s.showOnline === 'boolean') CONFIG.showOnline = s.showOnline;
  }
  const t = Store.get('tops', null);
  if (Array.isArray(t) && t.length) TOPS = t;
  const ds = Store.get('dossiers', null);
  if (ds && typeof ds === 'object' && !Array.isArray(ds)) DOSSIERS = ds;
  const tm = Store.get('team', null);
  if (Array.isArray(tm)) TEAM = tm.filter(x => x && typeof x.nick === 'string' && TEAM_ROLES.some(r => r.id === x.role));
})();
