document.addEventListener('alpine:init', function () {
  var S = window.DSSI_STRINGS;
  var T = S.teacher;
  var local = window.safeStore('local');
  var session = window.safeStore('session');
  var KEY_TOKEN = 'dssi_teacher_token';
  var KEY_EMAIL = 'dssi_teacher_email';
  var KEY_ROUND = 'dssi_teacher_round';

  Alpine.data('teacherPage', function () {
    return {
      S: S,
      T: T,
      view: 'login', // login | main
      rounds: [],
      roundsLoaded: false,
      form: { email: '', password: '', round: '' },
      token: '',
      state: null,
      meetInput: '',
      busy: false,
      polling: false,
      error: '',
      pollProblem: false,
      offline: false,
      confirmSkip: false,
      timer: null,

      init: function () {
        var self = this;
        this.form.email = local.get(KEY_EMAIL);
        this.form.round = local.get(KEY_ROUND);
        this.loadRounds();
        var saved = session.get(KEY_TOKEN);
        if (saved) {
          this.token = saved;
          this.view = 'main';
          this.poll(true);
        }
        // อาจารย์ต้องโพลล์ต่อแม้แท็บถูกซ่อน (เปิดหน้า Meet อยู่อีกแท็บ) ไม่งั้นถูกตัดเป็นออฟไลน์
        this.timer = setInterval(function () { self.poll(false); }, window.DSSI_CONFIG.TEACHER_POLL_MS);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.poll(false);
        });
      },

      // ---------------------------------------------------------- login
      loadRounds: async function () {
        var res = await window.apiGet({ action: 'rounds' });
        if (res.ok) {
          this.rounds = res.rounds || [];
          this.roundsLoaded = true;
          var code = this.form.round;
          if (code && !this.rounds.some(function (r) { return r.code === code; })) this.form.round = '';
        } else {
          this.offline = !!res.network;
          if (!res.network) this.error = res.error || S.err.loadRounds;
          var self = this;
          setTimeout(function () { self.loadRounds(); }, window.DSSI_CONFIG.TEACHER_POLL_MS);
        }
      },

      login: async function () {
        if (this.busy) return;
        var f = this.form;
        if (!f.email.trim() || !f.password || !f.round) {
          this.error = S.err.needLogin;
          return;
        }
        this.busy = true;
        this.error = '';
        var res = await window.apiPost({
          action: 'teacherLogin',
          email: f.email.trim(),
          password: f.password,
          round: f.round,
        });
        this.busy = false;
        if (!res.ok) {
          this.handleFail(res);
          return;
        }
        this.offline = false;
        // จำอีเมลกับรอบล่าสุด ไม่จำรหัสผ่าน
        local.set(KEY_EMAIL, f.email.trim());
        local.set(KEY_ROUND, f.round);
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
        this.confirmSkip = false;
        this.pollProblem = false;
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
        this.confirmSkip = false;
        var res = await window.apiPost(body);
        this.busy = false;
        if (!res.ok) {
          this.handleFail(res);
          return;
        }
        this.offline = false;
        this.pollProblem = false;
        this.applyState(res.state, true);
      },

      poll: async function (force) {
        if (this.view !== 'main' || !this.token || this.polling) return;
        if (!force && this.busy) return;
        this.polling = true;
        var res = await window.apiPost({ action: 'state', token: this.token });
        this.polling = false;
        if (this.busy) return; // ผู้ใช้กดปุ่มระหว่างรอ ให้ผลของปุ่มมาก่อน
        if (!res.ok) {
          if (res.auth) {
            this.handleFail(res);
          } else if (res.network) {
            this.offline = true;
          } else {
            this.offline = false;
            this.pollProblem = true; // error ชั่วคราว (เช่น ระบบยุ่ง) ลองใหม่รอบหน้า
          }
          return;
        }
        this.offline = false;
        this.pollProblem = false;
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
        if (st.status !== 'สัมภาษณ์อยู่') this.confirmSkip = false;
        // ไม่เขียนทับช่อง Meet ที่กำลังพิมพ์ตอนพักหรือออฟไลน์
        var editing = st.status === 'พัก' || st.status === 'ออฟไลน์';
        if (!editing && st.meet) this.meetInput = st.meet;
        else if (setMeet && st.meet && !this.meetInput) this.meetInput = st.meet;
      },

      // ---------------------------------------------------------- view helpers
      get status() { return this.state ? this.state.status : ''; },
      get isBusy() { return this.status === 'สัมภาษณ์อยู่'; },
      get isFree() { return this.status === 'ว่าง'; },
      get isRest() { return this.status === 'พัก'; },
      get isOffline() { return this.status === 'ออฟไลน์'; },
      get canFree() { return this.isRest || this.isOffline; },
      get roundFinished() {
        return this.isFree && this.state.waiting === 0 && this.state.doneCount > 0;
      },
      get badgeText() {
        var b = T.badge;
        var s = this.isBusy ? b.busy : this.isFree ? b.free : this.isOffline ? b.offline : b.rest;
        return s + ' · ' + (this.state.roundName || this.state.round);
      },
      get dotClass() {
        return this.isFree ? 'dot-go' : (this.isRest || this.isOffline) ? 'dot-rest' : '';
      },
      get headTop() {
        if (this.isBusy) return T.busyTop;
        if (this.roundFinished) return T.doneTop;
        if (this.isOffline) return T.offlineTop;
        return this.isFree ? T.freeTop : T.restTop;
      },
      get headGrad() {
        if (this.isBusy) return this.state.student ? this.state.student.name : '';
        if (this.roundFinished) return T.doneGrad;
        if (this.isOffline) return T.offlineGrad;
        return this.isFree ? T.freeGrad : T.restGrad;
      },
      get leadText() {
        if (this.isBusy) return T.busyLead;
        if (this.roundFinished) return T.allDone;
        if (this.isOffline) return T.offlineLead;
        if (this.isFree) return this.state.waiting > 0 ? T.freeWaiting(this.state.waiting) : T.freeEmpty;
        return T.restLead;
      },
      get mineText() {
        var n = this.state && this.state.myDoneCount;
        return typeof n === 'number' ? T.statMine(n) : '';
      },
      get meetOk() { return window.isMeetUrl(this.state && this.state.meet); },
      get meetHref() { return this.meetOk ? this.state.meet : '#'; },
    };
  });
});
