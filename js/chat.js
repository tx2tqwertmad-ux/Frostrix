/* Идеи с чатами: у каждой идеи/недочёта своя переписка с фото.
   Автор, игроки и администрация общаются прямо в карточке, админ меняет статус. */
const Chat = {
  IMG_RE: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/,
  list: id => Store.get('chat_' + id, []),
  /* сохранение с проверкой: localStorage может переполниться */
  save(id, arr) { try { localStorage.setItem('frx_chat_' + id, JSON.stringify(arr)); return true; } catch (e) { return false; } },
  count: id => Chat.list(id).filter(m => !m.sys).length,
  ideaImg: id => { const v = Store.get('ideaimg_' + id, null); return v && Chat.IMG_RE.test(v) ? v : null; },
  saveIdeaImg(id, url) { try { localStorage.setItem('frx_ideaimg_' + id, JSON.stringify(url)); return true; } catch (e) { return false; } },
  wipe(id) { localStorage.removeItem('frx_chat_' + id); localStorage.removeItem('frx_ideaimg_' + id); },
  allMessages: () => DB.ideas().flatMap(i => Chat.list(i.id)),

  /* картинка → уменьшенный JPEG (до 1100 px по большей стороне) */
  image(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject('Подойдёт PNG, JPG, WebP или GIF');
      if (file.size > 12 * 1024 * 1024) return reject('Файл больше 12 МБ');
      const fr = new FileReader();
      fr.onerror = () => reject('Не удалось прочитать файл');
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject('Не удалось открыть картинку');
        img.onload = () => {
          const k = Math.min(1, 1100 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  },

  /* поле «прикрепить фото»: возвращает объект с get()/clear() */
  attach(root, { btn, file, prev, drop }) {
    let url = null;
    const show = () => {
      prev.hidden = !url;
      prev.innerHTML = url ? `<img src="${url}" alt=""><button type="button" aria-label="Убрать фото">×</button>` : '';
      if (url) prev.querySelector('button').onclick = () => { url = null; show(); };
    };
    const take = f => Chat.image(f).then(u => { url = u; show(); }).catch(m => UI.toast(m, 'err'));
    $(btn, root).onclick = () => $(file, root).click();
    $(file, root).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) take(f); };
    const zone = $(drop, root);
    zone.addEventListener('paste', e => {
      const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(x => x.type.startsWith('image/'));
      if (it) { e.preventDefault(); take(it.getAsFile()); }
    });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag');
      const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) take(f);
    });
    return { get: () => url, clear: () => { url = null; show(); } };
  },

  lightbox(src) { UI.modal('', `<img class="lightbox-img" src="${src}" alt="">`, { wide: true, layer: 2 }); }
};

const IDEA_STATUS = {
  open:     ['На рассмотрении', 'tag-new'],
  work:     ['В работе',        'tag-work'],
  accepted: ['Одобрено',        'tag-ok'],
  rejected: ['Отклонено',       'tag-bad'],
  fixed:    ['Выполнено',       'tag-ok']
};
const ideaTitle = i => i.title || (i.text.length > 70 ? i.text.slice(0, 70).trim() + '…' : i.text);
const statusTag = s => { const t = IDEA_STATUS[s] || IDEA_STATUS.open; return `<span class="tag ${t[1]}">${t[0]}</span>`; };
const roleOf = nick => { const u = DB.users().find(x => x.nick.toLowerCase() === String(nick).toLowerCase()); return u ? u.role : 'player'; };
/* подпись под ником: роль в команде (если есть), иначе роль на сайте */
const userLabel = nick => {
  const t = TEAM.find(m => m.nick.toLowerCase() === String(nick).toLowerCase());
  const tr = t && TEAM_ROLES.find(r => r.id === t.role);
  return tr ? { text: tr.label, staff: true } : { text: ROLES[roleOf(nick)].label, staff: roleOf(nick) !== 'player' };
};
const stamp = ts => { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const ideaScore = i => Object.values(i.votes || {}).reduce((a, v) => a + v, 0);
const isClosed = i => !!i.locked || i.status === 'fixed' || i.status === 'rejected';
/* текст поста: строки «> цитата» превращаются в блок цитаты */
const fmtText = t => {
  const out = []; let norm = [], q = [];
  const flush = () => {
    if (norm.length) { out.push(`<p>${norm.join('<br>')}</p>`); norm = []; }
    if (q.length) { out.push(`<blockquote>${q.join('<br>')}</blockquote>`); q = []; }
  };
  String(t || '').replace(/\r/g, '').split('\n').forEach(l => {
    if (/^>\s?/.test(l)) { if (norm.length) flush(); q.push(Util.esc(l.replace(/^>\s?/, ''))); }
    else { if (q.length) flush(); norm.push(Util.esc(l)); }
  });
  flush();
  return out.join('');
};
const lastAct = i => Chat.list(i.id).reduce((a, m) => Math.max(a, m.ts || 0), i.created);
/* «новые ответы» для автора темы */
const Seen = {
  others: (id, nick) => Chat.list(id).filter(m => !m.sys && m.author.toLowerCase() !== nick.toLowerCase()).length,
  mark(id) { const me = Auth.current(); if (!me) return; const k = 'seen_' + me.id, m = Store.get(k, {}); m[id] = Seen.others(id, me.nick); Store.set(k, m); },
  unread() {
    const me = Auth.current(), r = { total: 0, first: null, by: {} };
    if (!me) return r;
    const m = Store.get('seen_' + me.id, {});
    DB.ideas().filter(i => i.author.toLowerCase() === me.nick.toLowerCase()).forEach(i => {
      const n = Seen.others(i.id, me.nick) - (m[i.id] || 0);
      if (n > 0) { r.by[i.id] = n; r.total += n; if (!r.first) r.first = i.id; }
    });
    return r;
  }
};
const onlineNicks = () => new Set(Analytics.online().map(x => (x.n || '').toLowerCase()).filter(Boolean));

Object.assign(Pages, {
  /* ================= РАЗДЕЛ «ИДЕИ» (как форум) ================= */
  ideas(tab = 'idea', sort = 'new') {
    if (/^\d+$/.test(String(tab))) return Pages.ideaChat(+tab);
    const all = DB.ideas(), me = Auth.current();
    const live = i => ['open', 'work', 'accepted'].includes(i.status);
    const list = all.filter(i => tab === 'fixed' ? (i.status === 'fixed' || i.status === 'rejected') : i.type === tab && live(i))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (sort === 'top' ? ideaScore(b) - ideaScore(a) || b.created - a.created : b.created - a.created));
    const cnt = { idea: all.filter(i => i.type === 'idea' && live(i)).length, bug: all.filter(i => i.type === 'bug' && live(i)).length, fixed: all.filter(i => i.status === 'fixed' || i.status === 'rejected').length };
    const empty = { idea: 'Пока нет идей. Создай первую тему.', bug: 'Пока нет недочётов в работе', fixed: 'Закрытых тем пока нет' }[tab];
    const un = Seen.unread().by;
    const rowsHtml = q => {
      q = (q || '').trim().toLowerCase();
      const rows = q ? list.filter(i => (ideaTitle(i) + ' ' + i.text + ' ' + i.author).toLowerCase().includes(q)) : list;
      return rows.length ? rows.map(i => { const sc = ideaScore(i), n = Chat.count(i.id), img = Chat.ideaImg(i.id), ul = userLabel(i.author); return `
            <a class="topic ${i.pinned ? 'pinned' : ''}" href="#/ideas/${i.id}">
              <span class="vote-box ${sc > 0 ? 'pos' : sc < 0 ? 'neg' : ''}">${sc > 0 ? '+' + sc : sc}</span>
              <span class="topic-main">
                <span class="topic-title">${i.pinned ? '<span title="Закреплено">📌</span>' : ''}<b>${Util.esc(ideaTitle(i))}</b>${statusTag(i.status)}${img ? '<span class="topic-photo" title="Есть фото">🖼</span>' : ''}${un[i.id] ? `<span class="new-dot">+${un[i.id]} нов.</span>` : ''}</span>
                <span class="topic-prev">${Util.esc(i.text)}</span>
              </span>
              <span class="topic-author"><b>${Util.esc(i.author)}</b><span class="muted small">${Util.esc(ul.text)} · ${n} ${Util.plural(n, ['ответ', 'ответа', 'ответов'])}</span></span>
              <span class="topic-date"><b>${stamp(lastAct(i))}</b><span class="muted small">${isClosed(i) ? 'Закрыта' : 'Открыта'} · активность</span></span>
            </a>`; }).join('') : `<div class="empty">${q ? 'Ничего не найдено' : empty}</div>`;
    };
    const app = Pages.view(`
      <section class="panel forum-head">
        <div>
          <span class="forum-kicker">Раздел форума</span>
          <h1>Идеи и недочёты</h1>
          <p class="muted">Предложения по улучшению сервера: баланс, механики, ивенты, экономика и удобство игры${CONFIG.reportBot ? `. Срочные проблемы — через <a href="${Util.esc(CONFIG.reportBot)}" target="_blank" rel="noopener">бота обращений</a>` : ''}.</p>
        </div>
        <button class="btn btn-primary" id="newIdea">${me ? 'Создать тему' : 'Войти для публикации'}</button>
      </section>
      <section class="panel topics">
        <div class="topics-top">
          <div><h2>Темы раздела</h2><p class="muted small">Список тем со статусами и последней активностью</p></div>
          <input type="search" id="topicQ" class="topic-search" placeholder="Поиск по темам…" aria-label="Поиск по темам">
          <div class="seg" id="sortSeg"><button data-s="top" class="${sort === 'top' ? 'active' : ''}">Популярные</button><button data-s="new" class="${sort === 'new' ? 'active' : ''}">Новые</button></div>
        </div>
        <div class="seg seg-wide" id="ideaTabs">
          <button data-t="idea" class="${tab === 'idea' ? 'active' : ''}">Идеи · ${cnt.idea}</button>
          <button data-t="bug" class="${tab === 'bug' ? 'active' : ''}">Недочёты · ${cnt.bug}</button>
          <button data-t="fixed" class="${tab === 'fixed' ? 'active' : ''}">Закрытые · ${cnt.fixed}</button>
        </div>
        <div class="topic-list">
          ${rowsHtml('')}
        </div>
      </section>`);
    $$('#ideaTabs button', app).forEach(b => b.onclick = () => Pages.ideas(b.dataset.t, sort));
    $('#topicQ', app).oninput = e => { $('.topic-list', app).innerHTML = rowsHtml(e.target.value); };
    $$('#sortSeg button', app).forEach(b => b.onclick = () => Pages.ideas(tab, b.dataset.s));
    $('#newIdea', app).onclick = () => {
      if (!me) return Auth.openModal('login');
      const m = UI.modal('Новая тема', `<form class="form" id="iForm">
        <div class="seg" id="typeSeg"><button type="button" data-v="idea" class="active">Идея</button><button type="button" data-v="bug">Недочёт</button></div>
        <label>Название <input name="title" required maxlength="80" placeholder="Например: крутая кирка на бур"></label>
        <label>Опиши подробно<textarea name="text" rows="5" required maxlength="2000" placeholder="Что предлагаешь или что сломалось? Для недочёта укажи команду и координаты."></textarea></label>
        <div class="chat-preview" id="iPrev" hidden></div>
        <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="iAttach">📎 Прикрепить фото</button><span class="muted small">или вставь скриншот через Ctrl+V</span></div>
        <input type="file" id="iFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
        <button class="btn btn-primary btn-block">Опубликовать тему</button></form>`, { wide: true });
      let type = 'idea';
      $$('#typeSeg button', m).forEach(b => b.onclick = () => { type = b.dataset.v; $$('#typeSeg button', m).forEach(x => x.classList.toggle('active', x === b)); });
      const att = Chat.attach(m, { btn: '#iAttach', file: '#iFile', prev: '#iPrev', drop: '#iForm' });
      $('#iForm', m).onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target), l = DB.ideas(), id = l.reduce((a, x) => Math.max(a, x.id), 0) + 1;
        if (att.get() && !Chat.saveIdeaImg(id, att.get())) return UI.toast('Не хватило места в браузере — возьми фото поменьше', 'err');
        l.push({ id, type, status: 'open', author: me.nick, created: Date.now(), title: f.get('title').trim(), text: f.get('text').trim(), votes: {} });
        DB.saveIdeas(l); Analytics.track('msg', 'ideas'); UI.closeModal(); UI.toast('Тема опубликована');
        location.hash = '#/ideas/' + id;
      };
    };
  },

  /* ================= ТЕМА (пост + ответы) ================= */
  ideaChat(id) {
    const find = () => DB.ideas().find(x => x.id === id);
    if (!find()) return Pages.notFound();
    const me = Auth.current(), mod = Auth.can('moder');
    const app = Pages.view(`
      <a class="back-link" href="#/ideas">← Все темы раздела</a>
      <section class="panel thread-head" id="thHead"></section>
      <div id="thPosts" class="posts"></div>
      <section class="panel reply-box" id="thReply"></section>`);
    const headEl = $('#thHead', app), postsEl = $('#thPosts', app), replyEl = $('#thReply', app);
    const sys = text => { const l = Chat.list(id); l.push({ id: Util.uid(), sys: 1, text, ts: Date.now() }); Chat.save(id, l); };

    const renderHead = () => {
      const i = find(); if (!i) return;
      const n = Chat.count(id) + 1;
      headEl.innerHTML = `
        <div class="thread-title">
          <span class="forum-kicker">${i.type === 'bug' ? 'Недочёты' : 'Идеи'}</span>
          <h1>${i.pinned ? '📌 ' : ''}${Util.esc(ideaTitle(i))}</h1>
          <div class="thread-sub">${statusTag(i.status)}${i.assignee ? `<span class="tag">Ведёт: ${Util.esc(i.assignee)}</span>` : ''}<span class="tag">${isClosed(i) ? 'Закрыта' : 'Открыта'}</span></div>
        </div>
        <span class="thread-count">— ${n} ${Util.plural(n, ['сообщение', 'сообщения', 'сообщений'])}</span>
        ${mod ? `<div class="thread-admin">
          <select id="stSel" aria-label="Статус">${Object.entries(IDEA_STATUS).map(([k, v]) => `<option value="${k}" ${k === i.status ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
          ${i.assignee === me.nick ? '' : '<button class="btn btn-primary btn-sm" id="takeBtn">Взять в работу</button>'}
          <button class="btn btn-ghost btn-sm" id="pinBtn">${i.pinned ? 'Открепить' : 'Закрепить'}</button>
          <button class="btn btn-ghost btn-sm" id="lockBtn">${i.locked ? 'Открыть тему' : 'Закрыть тему'}</button>
          <button class="btn btn-ghost btn-sm" id="delIdea">Удалить</button>
        </div>` : ''}`;
      if (!mod) return;
      const upd = fn => { const l = DB.ideas(), it = l.find(x => x.id === id); fn(it); DB.saveIdeas(l); return it; };
      $('#stSel', headEl).onchange = e => {
        const it = upd(x => { x.status = e.target.value; });
        sys(`${me.nick} изменил статус: ${IDEA_STATUS[it.status][0]}`); Audit.log(`Статус темы #${id}: ${IDEA_STATUS[it.status][0]}`);
        renderAll();
      };
      const tb = $('#takeBtn', headEl);
      if (tb) tb.onclick = () => {
        upd(x => { x.status = 'work'; x.assignee = me.nick; });
        sys(`${me.nick} взял тему в работу`); Audit.log(`Тема #${id} взята в работу`); UI.toast('Тема у тебя в работе'); renderAll();
      };
      $('#pinBtn', headEl).onclick = () => { const it = upd(x => { x.pinned = !x.pinned; }); UI.toast(it.pinned ? 'Тема закреплена' : 'Тема откреплена'); renderAll(); };
      $('#lockBtn', headEl).onclick = () => {
        const it = upd(x => { x.locked = !x.locked; });
        sys(`${me.nick} ${it.locked ? 'закрыл' : 'открыл'} тему`); renderAll();
      };
      $('#delIdea', headEl).onclick = () => {
        if (!confirm('Удалить тему вместе со всеми ответами?')) return;
        DB.saveIdeas(DB.ideas().filter(x => x.id !== id)); Chat.wipe(id); Audit.log('Удалена тема #' + id + ' в «Идеях»');
        UI.toast('Тема удалена'); location.hash = '#/ideas';
      };
    };

    const post = (n, p, extra = {}) => {
      const ul = userLabel(p.author), online = onlineNicks().has(p.author.toLowerCase());
      const mine = me && p.author.toLowerCase() === me.nick.toLowerCase();
      const canDel = !extra.op && me && (mine || mod);
      const it = find(), qid = extra.op ? 'op' : p.id, canEdit = me && (mine || mod), canQuote = me && !(isClosed(it) && !mod);
      return `<article class="post ${ul.staff ? 'post-staff' : ''}" data-pid="${qid}">
        <aside class="post-side">${Head.img(p.author, 76)}<b>${Util.esc(p.author)}</b>
          <span class="post-role">${Util.esc(ul.text)}</span>
          <span class="post-online ${online ? 'on' : ''}">● ${online ? 'В сети' : 'Не в сети'}</span></aside>
        <div class="post-main">
          <div class="post-top"><span class="muted">${stamp(p.ts)}${p.edited ? ` · изменено ${stamp(p.edited)}` : ''}${ul.staff && !extra.op ? ' · <b class="official">ответ администрации</b>' : ''}</span>
            <span class="post-actions">${canQuote ? `<button class="link-btn" data-quote="${qid}">Цитировать</button>` : ''}${canEdit ? `<button class="link-btn" data-edit="${qid}">Изменить</button>` : ''}${canDel ? `<button class="msg-del" data-del="${p.id}" title="Удалить" aria-label="Удалить ответ">×</button>` : ''}<span class="muted">#${n}</span></span></div>
          <div class="post-text">${p.text ? fmtText(p.text) : ''}${p.img && Chat.IMG_RE.test(p.img) ? `<img class="msg-img" src="${p.img}" alt="Фото" data-zoom>` : ''}</div>
          ${extra.vote ? extra.vote : ''}
        </div></article>`;
    };

    const renderPosts = () => {
      const i = find(); if (!i) return;
      const votes = i.votes || {}, mine = me ? votes[me.nick.toLowerCase()] || 0 : 0, sc = ideaScore(i);
      const vote = `<div class="post-foot">
        <button class="vote-btn ${mine === 1 ? 'on' : ''}" data-v="1">⌃ Поддержать</button>
        <b class="vote-score ${sc > 0 ? 'pos' : sc < 0 ? 'neg' : ''}">${sc}</b>
        <button class="vote-btn ${mine === -1 ? 'on neg' : ''}" data-v="-1">⌄ Против</button>
        ${me ? '' : '<span class="muted small vote-hint">Войдите, чтобы проголосовать</span>'}</div>`;
      const msgs = Chat.list(id); let n = 1;
      postsEl.innerHTML = post(1, { author: i.author, text: i.text, img: Chat.ideaImg(id), ts: i.created, edited: i.edited }, { op: true, vote })
        + (msgs.length ? msgs.map(m => m.sys ? `<div class="msg-sys"><span>${Util.esc(m.text)} · ${stamp(m.ts)}</span></div>` : post(++n, m)).join('') : '')
        + (Chat.count(id) ? '' : '<div class="panel empty">Ответов пока нет.</div>');
      $$('[data-zoom]', postsEl).forEach(im => im.onclick = () => Chat.lightbox(im.src));
      $$('[data-del]', postsEl).forEach(b => b.onclick = () => {
        if (!confirm('Удалить ответ?')) return;
        Chat.save(id, Chat.list(id).filter(x => x.id !== b.dataset.del)); renderAll();
      });
      $$('[data-quote]', postsEl).forEach(b => b.onclick = () => {
        const ta = $('#rpText', replyEl); if (!ta) return;
        const q = b.dataset.quote, src = q === 'op' ? { author: i.author, text: i.text } : Chat.list(id).find(x => x.id === q);
        if (!src) return;
        const short = (src.text || '(фото)').split('\n').filter(l => !/^>/.test(l)).join(' ').trim().slice(0, 220);
        ta.value += `${ta.value && !ta.value.endsWith('\n') ? '\n' : ''}> ${src.author}: ${short}\n\n`; ta.focus();
        if (replyEl.scrollIntoView) replyEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      $$('[data-edit]', postsEl).forEach(b => b.onclick = () => {
        const pid = b.dataset.edit, box = $('.post-text', b.closest('.post')), msg = Chat.list(id).find(x => x.id === pid);
        const cur = pid === 'op' ? i.text : msg ? msg.text || '' : '';
        box.innerHTML = `<textarea rows="5" maxlength="${pid === 'op' ? 2000 : 1500}">${Util.esc(cur)}</textarea>
          <div class="btn-row"><button class="btn btn-primary btn-sm" data-save>Сохранить</button><button class="btn btn-ghost btn-sm" data-cancel>Отмена</button></div>`;
        const ta = box.querySelector('textarea'); ta.focus();
        box.querySelector('[data-cancel]').onclick = () => renderPosts();
        box.querySelector('[data-save]').onclick = () => {
          const v = ta.value.replace(/\r/g, '').trim();
          if (pid === 'op') {
            if (!v) return UI.toast('Текст не может быть пустым', 'err');
            const l = DB.ideas(), it = l.find(x => x.id === id); it.text = v; it.edited = Date.now(); DB.saveIdeas(l);
          } else {
            if (!v && !(msg && msg.img)) return UI.toast('Ответ не может быть пустым', 'err');
            const l = Chat.list(id), m = l.find(x => x.id === pid); m.text = v; m.edited = Date.now(); Chat.save(id, l);
          }
          UI.toast('Сохранено'); renderPosts();
        };
      });
      $$('.vote-btn', postsEl).forEach(b => b.onclick = () => {
        if (!me) return Auth.openModal('login');
        const v = +b.dataset.v, key = me.nick.toLowerCase(), l = DB.ideas(), it = l.find(x => x.id === id);
        it.votes = it.votes || {}; if (it.votes[key] === v) delete it.votes[key]; else it.votes[key] = v;
        DB.saveIdeas(l); renderPosts();
      });
      if (me && i.author.toLowerCase() === me.nick.toLowerCase()) { Seen.mark(id); App.refreshHeader(); }
    };

    const renderReply = () => {
      const i = find(); if (!i) return;
      if (!me) { replyEl.innerHTML = '<h2>Ответить в тему</h2><p class="muted">Чтобы отвечать в темы, войдите в аккаунт.</p><button class="btn btn-ghost btn-block" id="rpLogin">Войти</button>'; $('#rpLogin', replyEl).onclick = () => Auth.openModal('login'); return; }
      if (isClosed(i) && !mod) { replyEl.innerHTML = '<h2>Ответить в тему</h2><p class="muted">Тема закрыта — отвечать нельзя.</p>'; return; }
      replyEl.innerHTML = `<h2>Ответить в тему</h2><form class="form" id="rpForm">
        <textarea id="rpText" rows="4" maxlength="1500" placeholder="Напиши ответ… Enter — отправить, Shift+Enter — новая строка"></textarea>
        <div class="chat-preview" id="rpPrev" hidden></div>
        <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="rpAttach">📎 Прикрепить фото</button><span class="muted small">или вставь скриншот через Ctrl+V</span><button class="btn btn-primary" style="margin-left:auto">Отправить ответ</button></div>
        <input type="file" id="rpFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden></form>`;
      const att = Chat.attach(replyEl, { btn: '#rpAttach', file: '#rpFile', prev: '#rpPrev', drop: '#rpForm' }), ta = $('#rpText', replyEl);
      ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#rpForm', replyEl).requestSubmit(); } };
      $('#rpForm', replyEl).onsubmit = e => {
        e.preventDefault();
        const text = ta.value.trim(), img = att.get();
        if (!text && !img) return;
        const l = Chat.list(id); l.push({ id: Util.uid(), author: me.nick, text, img: img || undefined, ts: Date.now() });
        if (!Chat.save(id, l)) return UI.toast('Не хватило места в браузере — попробуй фото поменьше', 'err');
        Analytics.track('msg', 'ideas'); ta.value = ''; att.clear(); renderHead(); renderPosts();
        const last = postsEl.querySelector('.post:last-of-type'); if (last && last.scrollIntoView) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    };

    const renderAll = () => { renderHead(); renderPosts(); renderReply(); };
    renderAll();
    /* ответ админа в другой вкладке появится сам */
    const onStore = e => {
      if (!document.body.contains(app) || !location.hash.startsWith('#/ideas/')) return;
      if (e.key === 'frx_ideas' && !find()) { location.hash = '#/ideas'; return; }
      if (e.key === 'frx_chat_' + id || e.key === 'frx_ideas') { renderHead(); renderPosts(); }
    };
    addEventListener('storage', onStore);
    Pages._chatOff = () => removeEventListener('storage', onStore);
  }
});
