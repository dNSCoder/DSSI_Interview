document.addEventListener('alpine:init', function () {
  var S = window.DSSI_STRINGS;
  var T = S.student;
  var local = window.safeStore('local');
  var KEY_ID = 'dssi_student_id';
  var MAX_DOTS = 8;

  Alpine.data('studentPage', function () {
    return {
      S: S,
      T: T,
      idInput: '',
      id: '',
      info: null, // คำตอบล่าสุดจาก action=student
      busy: false,
      error: '',
      offline: false,
      timer: null,

      init: function () {
        var self = this;
        var saved = local.get(KEY_ID);
        if (saved) {
          this.id = saved;
          this.idInput = saved;
          this.poll(true);
        }
        this.timer = setInterval(function () { self.poll(false); }, window.DSSI_CONFIG.POLL_MS);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) self.poll(false);
        });
      },

      submitId: async function () {
        if (this.busy) return;
        var id = this.idInput.trim();
        if (!id) {
          this.error = S.err.needId;
          return;
        }
        this.busy = true;
        this.error = '';
        var res = await window.apiGet({ action: 'student', id: id });
        this.busy = false;
        if (!res.ok) {
          if (res.network) this.offline = true;
          else this.error = res.error || S.err.generic;
          return;
        }
        this.offline = false;
        this.id = id;
        local.set(KEY_ID, id);
        this.info = res;
      },

      changeId: function () {
        this.id = '';
        this.info = null;
        this.error = '';
        local.remove(KEY_ID);
      },

      poll: async function (force) {
        if (!this.id) return;
        if (!force && (document.hidden || this.busy)) return;
        if (this.info && this.info.status === 'done') return; // หยุดเมื่อเสร็จ
        var res = await window.apiGet({ action: 'student', id: this.id });
        if (!res.ok) {
          if (res.network) {
            this.offline = true;
          } else {
            // รหัสที่จำไว้ใช้ไม่ได้แล้ว กลับไปหน้ากรอกรหัส
            this.offline = false;
            this.changeId();
            this.error = res.error || S.err.generic;
          }
          return;
        }
        this.offline = false;
        this.info = res;
      },

      // ---------------------------------------------------------- view helpers
      get status() { return this.info ? this.info.status : ''; },
      get isWait() { return this.status === 'wait'; },
      get isBusy() { return this.status === 'busy'; },
      get isDone() { return this.status === 'done'; },
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
