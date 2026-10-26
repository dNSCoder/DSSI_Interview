// ข้อความภาษาไทยทั้งหมดอยู่ที่นี่ เปลี่ยนคำศัพท์ (เช่น นักเรียน → ผู้สมัคร) ที่เดียว
window.DSSI_STRINGS = {
  course: 'หลักสูตร Data Science and Software Innovation · มหาวิทยาลัยอุบลราชธานี',
  logoAlt: 'DSSI',
  siteName: 'ระบบคิวสอบสัมภาษณ์ DSSI',
  examinee: 'นักเรียน',
  interviewer: 'อาจารย์',

  err: {
    network: 'เชื่อมต่อไม่ได้ กำลังลองใหม่...',
    generic: 'ระบบมีปัญหา ลองใหม่อีกครั้ง',
    needName: 'กรอกชื่อ-สกุลก่อน',
    needPhone: 'กรอกเบอร์โทรศัพท์ก่อน',
    needRound: 'เลือกรอบก่อน',
    needLogin: 'กรอกอีเมล รหัสผ่าน และเลือกรอบให้ครบ',
    needMeet: 'วางลิงก์ Google Meet ที่ขึ้นต้นด้วย https://meet.google.com/',
    sessionExpired: 'เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง',
    loadRounds: 'โหลดรายการรอบไม่ได้ กำลังลองใหม่...',
  },

  student: {
    navTeacher: 'สำหรับอาจารย์',
    // ฟอร์มเข้าคิว
    joinTop: 'คิวสอบ',
    joinGrad: 'สัมภาษณ์',
    joinLead: 'พิมพ์ชื่อและเบอร์โทรศัพท์ตามที่กรอกในฟอร์ม แล้วกดเข้าคิว',
    nameLabel: 'ชื่อ-สกุล',
    nameHint: 'ตามที่กรอกในฟอร์ม ไม่ต้องใส่คำนำหน้า',
    phoneLabel: 'เบอร์โทรศัพท์',
    phoneHint: 'ตามที่กรอกในฟอร์ม ระบบตรวจจาก 4 ตัวท้าย',
    joinSubmit: 'เข้าคิว',
    // เลือกรอบ (ชื่ออยู่หลายรอบ)
    pickTop: 'เลือก',
    pickGrad: 'รอบสอบ',
    pickLead: 'ชื่อนี้อยู่ในหลายรอบ เลือกรอบที่คุณจะสัมภาษณ์',
    pickBack: 'กลับไปแก้ชื่อ',
    // กำลังโหลดสถานะ
    loading: 'กำลังตรวจสอบคิว...',
    // รอคิว
    badgeWait: function (round, n) { return round + ' มีอาจารย์ว่าง ' + n + ' ท่าน'; },
    youAre: 'คุณอยู่',
    queueNo: function (n) { return 'คิวที่ ' + n; },
    waitLead: 'รออาจารย์ว่าง หน้านี้อัปเดตเอง ไม่ต้องรีเฟรช',
    you: 'คุณ',
    aheadLabel: function (n) { return 'ข้างหน้า ' + n + ' คน'; },
    behindLabel: function (n) { return 'ข้างหลัง ' + n + ' คน'; },
    changeName: 'เปลี่ยนชื่อที่ใช้เข้าคิว',
    changeWarn: 'ถ้าเปลี่ยน คุณจะออกจากหน้านี้ และเข้าคิวซ้ำเองไม่ได้ ต้องแจ้งเจ้าหน้าที่',
    changeConfirm: 'ยืนยันเปลี่ยน',
    cancel: 'ยกเลิก',
    pollProblem: 'อ่านสถานะคิวไม่ได้ชั่วคราว กำลังลองใหม่...',
    // ถึงคิว
    badgeBusy: 'อาจารย์รออยู่ในห้องแล้ว',
    busyTop: 'ถึงคิว',
    busyGrad: 'คุณแล้ว',
    busyLead: 'กดปุ่มเพื่อเข้าห้อง Meet ของอาจารย์ผู้สัมภาษณ์',
    teacherLabel: 'อาจารย์ผู้สัมภาษณ์',
    meetRoom: 'ห้อง Google Meet',
    joinMeet: 'เข้าห้อง Meet',
    meetInvalid: 'ลิงก์ห้อง Meet ไม่ถูกต้อง ติดต่อเจ้าหน้าที่',
    // เสร็จ
    badgeDone: 'สัมภาษณ์เสร็จแล้ว',
    doneTop: 'เสร็จสิ้น',
    doneGrad: 'ขอบคุณ',
    doneLead: 'คุณสัมภาษณ์เสร็จแล้ว ปิดหน้านี้ได้เลย',
    // ถูกข้าม
    badgeSkipped: 'ถูกข้ามคิว',
    skippedTop: 'คุณ',
    skippedGrad: 'ถูกข้ามคิว',
    skippedLead: 'คุณถูกข้ามคิว ติดต่อเจ้าหน้าที่',
    newEntry: 'กลับไปหน้าเข้าคิว',
  },

  teacher: {
    navStudent: 'หน้านักเรียน',
    // login
    loginTop: 'สำหรับ',
    loginGrad: 'อาจารย์',
    loginLead: 'กรอกอีเมลและรหัสผ่าน แล้วเลือกรอบที่คุณสัมภาษณ์',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    round: 'รอบ',
    roundPlaceholder: 'เลือกรอบ',
    loadingRounds: 'กำลังโหลดรอบ...',
    noRounds: 'ยังไม่มีรอบที่เปิดรับ ติดต่อผู้ดูแล',
    login: 'เข้าสู่ระบบ',
    // หลังล็อกอิน
    badge: { free: 'ว่าง พร้อมรับคิว', busy: 'สัมภาษณ์อยู่', rest: 'พัก ไม่รับคิว', offline: 'ออฟไลน์ ไม่รับคิว' },
    busyTop: 'กำลังสัมภาษณ์',
    busyLead: 'นักเรียนจะเข้าห้อง Meet ของคุณ เมื่อสัมภาษณ์เสร็จให้กดปุ่มด้านล่าง',
    freeTop: 'พร้อมรับ',
    freeGrad: 'คิวถัดไป',
    restTop: 'พักอยู่',
    restGrad: 'ยังไม่รับคิว',
    offlineTop: 'ออฟไลน์',
    offlineGrad: 'ไม่รับคิว',
    doneTop: 'สัมภาษณ์',
    doneGrad: 'ครบแล้ว',
    freeWaiting: function (n) { return 'มีคนรอ ' + n + ' คน ระบบจะจับคู่ให้ทันที'; },
    freeEmpty: 'ยังไม่มีคนรอ หน้านี้อัปเดตเอง',
    restLead: 'วางลิงก์ Meet แล้วกด "ว่าง รับคิวต่อไป" เมื่อพร้อม',
    offlineLead: 'ระบบไม่ได้รับสัญญาณจากหน้านี้นานเกินไป จึงหยุดรับคิวให้ กด "ว่าง รับคิวต่อไป" เพื่อรับคิวอีกครั้ง',
    allDone: 'ไม่มีนักเรียนเหลือในรอบนี้แล้ว',
    meetLabel: 'ลิงก์ Google Meet',
    meetPlaceholder: 'https://meet.google.com/abc-defg-hij',
    statWaiting: 'คนรอ',
    statDone: 'สัมภาษณ์เสร็จแล้ว',
    statMine: function (n) { return 'ของคุณ ' + n + ' คน'; },
    openMeet: 'เปิดห้อง Meet',
    finish: 'สัมภาษณ์เสร็จ รับคนถัดไป',
    skip: 'ข้าม',
    skipWarn: 'ข้ามเมื่อนักเรียนไม่เข้าห้อง นักเรียนที่ถูกข้ามเข้าคิวเองไม่ได้ ต้องให้เจ้าหน้าที่ล้างคิวในชีต',
    skipConfirm: 'ยืนยันข้าม',
    cancel: 'ยกเลิก',
    rest: 'พัก',
    free: 'ว่าง รับคิวต่อไป',
    logout: 'ออกจากระบบ',
    pollProblem: 'อ่านสถานะไม่ได้ชั่วคราว กำลังลองใหม่...',
  },

  admin: {
    navTeacher: 'หน้าอาจารย์',
    // login
    loginTop: 'สำหรับ',
    loginGrad: 'ผู้ดูแล',
    loginLead: 'กรอกอีเมลและรหัสผ่านของบัญชีผู้ดูแล',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    login: 'เข้าสู่ระบบ',
    needLogin: 'กรอกอีเมลและรหัสผ่านให้ครบ',
    logout: 'ออกจากระบบ',
    // หลังล็อกอิน
    badge: 'ภาพรวมระบบ',
    headTop: 'ภาพรวม',
    headGrad: 'วันสอบ',
    lead: 'หน้านี้อัปเดตเอง ไม่แสดงชื่อหรือเบอร์นักเรียน',
    pollProblem: 'อ่านข้อมูลไม่ได้ชั่วคราว กำลังลองใหม่...',
    // ซิงก์รายชื่อ
    syncTitle: 'ซิงก์รายชื่อนักเรียน',
    syncOn: 'ซิงก์อัตโนมัติ: เปิด',
    syncOff: 'ซิงก์อัตโนมัติ: ปิด',
    syncNever: 'ยังไม่เห็นการซิงก์ในช่วงหกชั่วโมงที่ผ่านมา ตรวจว่ามี trigger syncRosterAuto หรือไม่',
    syncLast: function (sec, added, filled) {
      var when = sec < 60 ? sec + ' วินาที' : Math.round(sec / 60) + ' นาที';
      var what = 'เพิ่ม ' + added + ' คน';
      if (filled) what += ' เติมเบอร์ ' + filled + ' แถว';
      return 'ซิงก์ล่าสุดเมื่อ ' + when + 'ที่แล้ว (' + what + ')';
    },
    noRoster: 'ยังไม่ได้ตั้ง ROSTER_SHEET_ID ใน Script properties',
    turnOn: 'เปิดซิงก์อัตโนมัติ',
    turnOff: 'ปิดซิงก์อัตโนมัติ',
    syncNow: 'ซิงก์ทันที',
    syncDone: function (added, filled) {
      if (!added && !filled) return 'ซิงก์แล้ว ไม่มีรายชื่อใหม่';
      var t = 'ซิงก์แล้ว เพิ่มนักเรียนใหม่ ' + added + ' คน';
      if (filled) t += ' เติมเบอร์ให้แถวเดิม ' + filled + ' แถว';
      return t;
    },
    // รอบ
    roundsTitle: 'รอบสอบ',
    noRounds: 'ยังไม่มีรอบในแท็บ Rounds',
    open: 'เปิดรับ',
    closed: 'ปิดรับ',
    waiting: 'รอ',
    busy: 'กำลังสัมภาษณ์',
    done: 'เสร็จ',
    skipped: 'ถูกข้าม',
    // อาจารย์
    teachersTitle: 'อาจารย์',
    noTeachers: 'ยังไม่มีอาจารย์เข้าสู่ระบบ',
    seen: function (sec) {
      if (sec === null) return 'ไม่เห็นสัญญาณ';
      if (sec < 60) return 'ล่าสุด ' + sec + ' วินาทีที่แล้ว';
      return 'ล่าสุด ' + Math.round(sec / 60) + ' นาทีที่แล้ว';
    },
  },
};
