/* Авторизация (локальная, localStorage) */
const Auth = {
  current() {
    const id = Store.get('session');
    if (!id) return null;
    return DB.users().find(u => u.id === id) || null;
  },
  rank() { const u = Auth.current(); return u ? ROLES[u.role].rank : -1; },
  can(role) { return Auth.rank() >= ROLES[role].rank; },

  register(nick, pass, pass2, consent) {
    nick = nick.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) return 'Ник: 3–16 символов, только латиница, цифры и _';
    if (pass.length < 6) return 'Пароль должен быть не короче 6 символов';
    if (pass !== pass2) return 'Пароли не совпадают';
    if (!consent) return 'Нужно принять соглашение и политику конфиденциальности';
    const users = DB.users();
    if (users.some(u => u.nick.toLowerCase() === nick.toLowerCase())) return 'Этот ник уже занят';
    const user = { id: Util.uid(), nick, pass: Util.hash(pass), role: 'player', created: Date.now() };
    users.push(user); DB.saveUsers(users);
    Store.set('session', user.id);
    return null;
  },

  login(nick, pass) {
    const u = DB.users().find(u => u.nick.toLowerCase() === nick.trim().toLowerCase());
    if (!u || u.pass !== Util.hash(pass)) return 'Неверный ник или пароль';
    Store.set('session', u.id);
    Analytics.track('login');
    return null;
  },

  logout() { localStorage.removeItem('frx_session'); },

  changePassword(old, n1, n2) {
    const us = DB.users(), me = Auth.current();
    if (!me) return 'Сначала войдите в аккаунт';
    if (me.pass !== Util.hash(old)) return 'Текущий пароль указан неверно';
    if (n1.length < 6) return 'Новый пароль должен быть не короче 6 символов';
    if (n1 !== n2) return 'Новые пароли не совпадают';
    us.find(u => u.id === me.id).pass = Util.hash(n1); DB.saveUsers(us);
    return null;
  },
  BIO_MAX: 200,
  /* аватарка: dataUrl или null (убрать) */
  setAvatar(dataUrl) {
    const us = DB.users(), me = Auth.current();
    if (!me) return 'Сначала войдите в аккаунт';
    if (dataUrl && !Head.AV_RE.test(dataUrl)) return 'Некорректная картинка';
    const u = us.find(x => x.id === me.id);
    if (dataUrl) u.avatar = dataUrl; else delete u.avatar;
    try { DB.saveUsers(us); } catch (e) { return 'Не удалось сохранить картинку'; }
    return Head.custom(me.nick) === (dataUrl || null) ? null : 'Не удалось сохранить: не хватает места в браузере';
  },
  setBio(text) {
    const us = DB.users(), me = Auth.current();
    if (!me) return 'Сначала войдите в аккаунт';
    text = String(text).replace(/\r/g, '').trim();
    if (text.length > Auth.BIO_MAX) return `Максимум ${Auth.BIO_MAX} символов`;
    text = text.replace(/\n{3,}/g, '\n\n');
    const u = us.find(x => x.id === me.id);
    if (text) u.bio = text; else delete u.bio;
    DB.saveUsers(us);
    return null;
  },
  isDefaultAdmin() { return DB.users().some(u => u.id === 'u_admin' && u.pass === Util.hash('admin123')); },

  /* Окно входа/регистрации */
  openModal(tab = 'login') {
    const m = UI.modal('', `
      <div class="auth-tabs">
        <button data-tab="login" class="${tab === 'login' ? 'active' : ''}">Вход</button>
        <button data-tab="register" class="${tab === 'register' ? 'active' : ''}">Регистрация</button>
        <span class="auth-ink"></span>
      </div>
      <form id="authForm" class="form" autocomplete="off"></form>`);
    const form = m.querySelector('#authForm');
    const ink = m.querySelector('.auth-ink');

    const render = t => {
      m.querySelectorAll('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
      ink.style.transform = t === 'login' ? 'translateX(0)' : 'translateX(100%)';
      form.dataset.mode = t;
      form.innerHTML = `
        <label>Игровой ник<input name="nick" required maxlength="16" placeholder="Steve_2009"></label>
        <label>Пароль<input name="pass" type="password" required placeholder="Минимум 6 символов"></label>
        ${t === 'register' ? `<label>Повторите пароль<input name="pass2" type="password" required></label>
        <label class="check"><input type="checkbox" name="consent"><span>Принимаю <a href="#" data-legal="terms">соглашение</a> и <a href="#" data-legal="privacy">политику конфиденциальности</a></span></label>` : ''}
        <div class="form-error" id="authErr"></div>
        <button class="btn btn-primary btn-block" type="submit">${t === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
`;
      form.querySelector('input').focus();
      $$('[data-legal]', form).forEach(a => a.onclick = e => { e.preventDefault(); UI.legal(a.dataset.legal); });
    };
    m.querySelectorAll('.auth-tabs button').forEach(b => b.onclick = () => render(b.dataset.tab));
    form.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(form);
      const err = form.dataset.mode === 'login'
        ? Auth.login(f.get('nick'), f.get('pass'))
        : Auth.register(f.get('nick'), f.get('pass'), f.get('pass2'), f.get('consent'));
      if (err) { form.querySelector('#authErr').textContent = err; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
      UI.closeModal();
      UI.toast(form.dataset.mode === 'login' ? 'С возвращением, ' + Auth.current().nick + '!' : 'Аккаунт создан. Добро пожаловать!');
      App.refreshHeader(); App.route();
    };
    render(tab);
  },

  require(role = 'player') {
    if (!Auth.current()) { UI.toast('Сначала войдите в аккаунт', 'err'); Auth.openModal('login'); return false; }
    if (!Auth.can(role)) { UI.toast('Недостаточно прав', 'err'); return false; }
    return true;
  }
};
