document.addEventListener('alpine:init', function () {
  var S = window.DSSI_STRINGS;
  var T = S.admin;
  var local = window.safeStore('local');
  var session = window.safeStore('session');
  var KEY_TOKEN = 'dssi_admin_token';
  var KEY_EMAIL = 'dssi_admin_email';

  Alpine.data('adminPage', function () {
    return {
      S: S,
      T: T,
      view: 'login', // login | main
      form: { email: '', password: '' },
      token: '',
      state: null,
      busy: false,
      polling: false,
      error: '',
      notice: '',
      pollProblem: false,
      offline: false,
      timer: null,

      init: function () {
        var self = this;
        this.form.email = local.get(KEY_EMAIL);
        var saved = session.get(KEY_TOKEN);
        if (saved) {
          this.token = saved;
          this.view = 'main';
          this.poll(true);
        }
        var ms = window.DSSI_CONFIG.ADMIN_POLL_MS || window.DSSI_CONFIG.TEACHER_POLL_MS || 5000;
        this.timer = setInterval(function () { self.poll(false); }, ms);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.poll(false);
        });
      },

      // ---------------------------------------------------------- login
      login: async function () {
        if (this.busy) return;
        var f = this.form;
        if (!f.email.trim() || !f.password) {
          this.error = T.needLogin;
          return;
        }
        this.busy = true;
        this.error = '';
        var res = await window.apiPost({ action: 'adminLogin', email: f.email.trim(), password: f.password });
        this.busy = false;
        if (!res.ok) {
          this.handleFail(res);
          return;
        }
        this.offline = false;
        local.set(KEY_EMAIL, f.email.trim()); // จำอีเมล ไม่จำรหัสผ่าน
        session.set(KEY_TOKEN, res.token);
        this.token = res.token;
        this.form.password = '';
        this.state = res.state;
        this.view = 'main';
      },

      logout: async function () {
        if (this.busy) return;
        this.busy = true;
        await window.apiPost({ action: 'adminLogout', token: this.token });
        this.busy = false;
        this.backToLogin('');
      },

      backToLogin: function (msg) {
        session.remove(KEY_TOKEN);
        this.token = '';
        this.state = null;
        this.notice = '';
        this.pollProblem = false;
        this.view = 'login';
        this.error = msg || '';
      },

      // ---------------------------------------------------------- actions
      toggleSync: async function () {
        if (this.busy || !this.state) return;
        this.busy = true;
        this.error = '';
        this.notice = '';
        var res = await window.apiPost({
          action: 'adminSetSync',
          token: this.token,
          enabled: !this.state.sync.enabled,
        });
        this.busy = false;
        if (!res.ok) { this.handleFail(res); return; }
        this.offline = false;
        this.state = res.state;
      },

      syncNow: async function () {
        if (this.busy) return;
        this.busy = true;
        this.error = '';
        this.notice = '';
        var res = await window.apiPost({ action: 'adminSync', token: this.token });
        this.busy = false;
        if (!res.ok) { this.handleFail(res); return; }
        this.offline = false;
        this.state = res.state;
        this.notice = T.syncDone(res.added || 0, res.filled || 0);
      },

      poll: async function (force) {
        if (this.view !== 'main' || !this.token || this.polling) return;
        if (!force && (document.hidden || this.busy)) return;
        this.polling = true;
        var res = await window.apiPost({ action: 'adminState', token: this.token });
        this.polling = false;
        if (this.busy) return;
        if (!res.ok) {
          if (res.auth) {
            this.handleFail(res);
          } else if (res.network) {
            this.offline = true;
          } else {
            this.offline = false;
            this.pollProblem = true;
          }
          return;
        }
        this.offline = false;
        this.pollProblem = false;
        this.state = res.state;
      },

      handleFail: function (res) {
        if (res.auth) {
          this.backToLogin(res.error || S.err.sessionExpired);
        } else if (res.network) {
          this.offline = true;
        } else {
          this.offline = false;
          this.error = res.error || S.err.generic;
        }
      },

      // ---------------------------------------------------------- view helpers
      get sync() { return this.state ? this.state.sync : null; },
      get syncLine() {
        var s = this.sync;
        if (!s) return '';
        if (!s.hasRoster) return T.noRoster;
        if (s.lastAgeSec === null) return T.syncNever;
        return T.syncLast(s.lastAgeSec, s.lastAdded || 0, s.lastFilled || 0);
      },
      dotClass: function (status) {
        if (status === 'ว่าง') return 'dot-go';
        if (status === 'พัก' || status === 'ออฟไลน์') return 'dot-rest';
        return '';
      },
    };
  });
});
