document.addEventListener('alpine:init', function () {
  var S = window.DSSI_STRINGS;
  var T = S.teacher;
  var local = window.safeStore('local');
  var session = window.safeStore('session');
  var KEY_TOKEN = 'dssi_teacher_token';
  var KEY_NAME = 'dssi_teacher_name';

  Alpine.data('teacherPage', function () {
    return {
      S: S,
      T: T,
      view: 'login', // login | main
      teachers: [],
      teachersLoaded: false,
      form: { name: '', password: '', round: '' },
      token: '',
      state: null,
      meetInput: '',
      busy: false,
      error: '',
      offline: false,
      timer: null,

      init: function () {
        var self = this;
        this.form.name = local.get(KEY_NAME);
        this.loadTeachers();
        var saved = session.get(KEY_TOKEN);
        if (saved) {
          this.token = saved;
          this.view = 'main';
          this.poll(true);
        }
        this.timer = setInterval(function () { self.poll(false); }, window.DSSI_CONFIG.POLL_MS);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.poll(false);
        });
      },

      // ---------------------------------------------------------- login
      loadTeachers: async function () {
        var res = await window.apiGet({ action: 'teachers' });
        if (res.ok) {
          this.teachers = res.teachers || [];
          this.teachersLoaded = true;
          if (this.form.name && this.teachers.indexOf(this.form.name) < 0) this.form.name = '';
        } else {
          this.offline = !!res.network;
          if (!res.network) this.error = res.error;
          var self = this;
          setTimeout(function () { self.loadTeachers(); }, window.DSSI_CONFIG.POLL_MS);
        }
      },

      login: async function () {
        if (this.busy) return;
        var f = this.form;
        if (!f.name || !f.password || !f.round.trim()) {
          this.error = S.err.needLogin;
          return;
        }
        this.busy = true;
        this.error = '';
        var res = await window.apiPost({
          action: 'login',
          name: f.name,
          password: f.password,
          round: f.round.trim(),
        });
        this.busy = false;
        if (!res.ok) {
          this.handleFail(res);
          return;
        }
        this.offline = false;
        local.set(KEY_NAME, f.name);
        session.set(KEY_TOKEN, res.token);
        this.token = res.token;
        this.form.password = '';
        this.applyState(res.state, true);
        this.view = 'main';
      },

      logout: async function () {
        if (this.busy) return;
        this.busy = true;
        await window.apiPost({ action: 'logout', token: this.token });
        this.busy = false;
        this.backToLogin('');
      },

      backToLogin: function (msg) {
        session.remove(KEY_TOKEN);
        this.token = '';
        this.state = null;
        this.meetInput = '';
        this.view = 'login';
        this.error = msg || '';
      },

      // ---------------------------------------------------------- actions
      act: async function (action) {
        if (this.busy) return;
        var body = { action: action, token: this.token };
        if (action === 'free') {
          var meet = this.meetInput.trim();
          if (!window.isMeetUrl(meet)) {
            this.error = S.err.needMeet;
            return;
          }
          body.meet = meet;
        }
        this.busy = true;
        this.error = '';
        var res = await window.apiPost(body);
        this.busy = false;
        if (!res.ok) {
          this.handleFail(res);
          return;
        }
        this.offline = false;
        this.applyState(res.state, true);
      },

      poll: async function (force) {
        if (this.view !== 'main' || !this.token) return;
        if (!force && (document.hidden || this.busy)) return;
        var res = await window.apiPost({ action: 'state', token: this.token });
        if (this.busy) return; // ผู้ใช้กดปุ่มระหว่างรอ ให้ผลของปุ่มมาก่อน
        if (!res.ok) {
          this.handleFail(res);
          return;
        }
        this.offline = false;
        this.applyState(res.state, false);
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

      applyState: function (st, setMeet) {
        this.state = st;
        // ไม่เขียนทับช่อง Meet ที่กำลังพิมพ์ตอนพัก
        if (st.status !== 'พัก' && st.meet) this.meetInput = st.meet;
        else if (setMeet && st.meet && !this.meetInput) this.meetInput = st.meet;
      },

      // ---------------------------------------------------------- view helpers
      get status() { return this.state ? this.state.status : ''; },
      get isBusy() { return this.status === 'สัมภาษณ์อยู่'; },
      get isFree() { return this.status === 'ว่าง'; },
      get isRest() { return this.status === 'พัก'; },
      get roundFinished() {
        return this.isFree && this.state.waiting === 0 && this.state.done > 0;
      },
      get badgeText() {
        var b = T.badge;
        return (this.isBusy ? b.busy : this.isFree ? b.free : b.rest) + ' · ' + T.roundTag(this.state.round);
      },
      get dotClass() {
        return this.isFree ? 'dot-go' : this.isRest ? 'dot-rest' : '';
      },
      get headTop() {
        if (this.isBusy) return T.busyTop;
        if (this.roundFinished) return T.doneTop;
        return this.isFree ? T.freeTop : T.restTop;
      },
      get headGrad() {
        if (this.isBusy) return this.state.student ? this.state.student.name : '';
        if (this.roundFinished) return T.doneGrad;
        return this.isFree ? T.freeGrad : T.restGrad;
      },
      get leadText() {
        if (this.isBusy) return this.state.student ? T.studentId(this.state.student.id) : '';
        if (this.roundFinished) return T.allDone;
        if (this.isFree) return this.state.waiting > 0 ? T.freeWaiting(this.state.waiting) : T.freeEmpty;
        return T.restLead;
      },
      get meetOk() { return window.isMeetUrl(this.state && this.state.meet); },
      get meetHref() { return this.meetOk ? this.state.meet : '#'; },
    };
  });
});
