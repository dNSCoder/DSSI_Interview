document.addEventListener('alpine:init', function () {
  var S = window.DSSI_STRINGS;
  var T = S.student;
  var local = window.safeStore('local');
  var KEY_TICKET = 'dssi_student_ticket';
  var MAX_DOTS = 8;

  Alpine.data('studentPage', function () {
    return {
      S: S,
      T: T,
      step: 'form', // form | pick (เลือกรอบเมื่อชื่ออยู่หลายรอบ)
      nameInput: '',
      phoneInput: '',
      rounds: [],
      ticket: '',
      info: null, // คำตอบล่าสุดจาก action=status
      busy: false,
      polling: false,
      error: '',
      pollProblem: false,
      offline: false,
      confirmChange: false,
      timer: null,

      init: function () {
        var self = this;
        var saved = local.get(KEY_TICKET);
        if (saved) {
          this.ticket = saved;
          this.poll(true);
        }
        this.timer = setInterval(function () { self.poll(false); }, window.DSSI_CONFIG.STUDENT_POLL_MS);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.poll(false);
        });
      },

      // ---------------------------------------------------------- เข้าคิว
      join: async function (round) {
        if (this.busy) return;
        var name = this.nameInput.trim();
        var phone = this.phoneInput.trim();
        if (!name) { this.error = S.err.needName; return; }
        if (!phone) { this.error = S.err.needPhone; return; }
        var body = { action: 'join', name: name, phone: phone };
        if (round) body.round = round;

        this.busy = true;
        this.error = '';
        var res = await window.apiPost(body);
        this.busy = false;
        if (!res.ok) {
          if (res.network) this.offline = true;
          else this.error = res.error || S.err.generic;
          return;
        }
        this.offline = false;
        if (res.needRound) {
          this.rounds = res.rounds || [];
          this.step = 'pick';
          return;
        }
        // เก็บเฉพาะตั๋ว ไม่เก็บชื่อหรือเบอร์
        local.set(KEY_TICKET, res.ticket);
        this.ticket = res.ticket;
        this.nameInput = '';
        this.phoneInput = '';
        this.rounds = [];
        this.step = 'form';
        this.poll(true);
      },

      pickRound: function (code) {
        this.join(code);
      },

      backToForm: function () {
        this.step = 'form';
        this.rounds = [];
        this.error = '';
      },

      // ---------------------------------------------------------- ออกจากตั๋วเดิม
      askChange: function () {
        // นักเรียนที่รออยู่ต้องยืนยันก่อน เพราะเข้าคิวซ้ำเองไม่ได้
        if (this.isWait) this.confirmChange = true;
        else this.changeName();
      },

      changeName: function () {
        this.ticket = '';
        this.info = null;
        this.error = '';
        this.pollProblem = false;
        this.confirmChange = false;
        this.step = 'form';
        local.remove(KEY_TICKET);
      },

      // ---------------------------------------------------------- สถานะ
      poll: async function (force) {
        if (!this.ticket || this.polling) return;
        if (!force && (document.hidden || this.busy)) return;
        if (this.info && (this.info.status === 'done' || this.info.status === 'skipped')) return;
        var ticket = this.ticket;
        this.polling = true;
        var res = await window.apiPost({ action: 'status', ticket: ticket });
        this.polling = false;
        if (this.ticket !== ticket) return; // ผู้ใช้เปลี่ยนชื่อระหว่างรอคำตอบ
        if (!res.ok) {
          if (res.network) {
            this.offline = true;
          } else if (res.gone) {
            // ระบบยืนยันว่าไม่มีตั๋วนี้แล้ว จึงกลับไปหน้าเข้าคิว
            this.offline = false;
            this.changeName();
            this.error = res.error || S.err.generic;
          } else {
            // error ชั่วคราวของระบบ เก็บตั๋วไว้และลองใหม่รอบหน้า
            this.offline = false;
            this.pollProblem = true;
          }
          return;
        }
        this.offline = false;
        this.pollProblem = false;
        this.info = res;
      },

      // ---------------------------------------------------------- view helpers
      get status() { return this.info ? this.info.status : ''; },
      get showForm() { return !this.ticket && this.step === 'form'; },
      get showPick() { return !this.ticket && this.step === 'pick'; },
      get showLoading() { return !!this.ticket && !this.info; },
      get isWait() { return this.status === 'wait'; },
      get isBusy() { return this.status === 'busy'; },
      get isDone() { return this.status === 'done'; },
      get isSkipped() { return this.status === 'skipped'; },
      get meetOk() { return this.isBusy && window.isMeetUrl(this.info.meet); },
      get meetHref() { return this.meetOk ? this.info.meet.trim() : '#'; },
      get aheadDots() { return Math.min(this.info ? this.info.ahead || 0 : 0, MAX_DOTS); },
      get behindDots() { return Math.min(this.info ? this.info.behind || 0 : 0, MAX_DOTS); },
      range: function (n) {
        var a = [];
        for (var i = 0; i < n; i++) a.push(i);
        return a;
      },
    };
  });
});
