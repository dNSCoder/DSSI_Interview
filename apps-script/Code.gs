/**
 * Code.gs v2 — backend ระบบคิวสอบสัมภาษณ์ DSSI (Google Apps Script Web App)
 * ผูกกับ Google Sheet หลัก (Extensions > Apps Script) Deploy: Execute as Me / Who has access: Anyone
 *
 * ชีต (สร้างด้วย Setup.gs):
 *   Teachers:     A ชื่อ | B อีเมล | C รหัสผ่าน        (ผู้ดูแลกรอก ตั้งคอลัมน์ C เป็นข้อความธรรมดา)
 *   Rounds:       A รหัสรอบ | B ชื่อรอบ | C เปิดรับ | D ถาม Portfolio | E ลิงก์ฟอร์ม
 *   Students:     A ตั๋ว | B ชื่อ | C รอบ | D สถานะ | E เวลาเข้าคิว | F อาจารย์ | G ลิงก์ Meet | H เวลารับคิว | I เบอร์ท้าย 4 หลัก
 *   TeacherState: A อีเมล | B รอบ | C สถานะ | D ลิงก์ Meet | E ตั๋วปัจจุบัน
 *
 * ชื่อฟังก์ชัน/ค่าคงที่ในไฟล์นี้ขึ้นต้นด้วย Q / q เพื่อไม่ชนกับ Setup.gs, Roster.gs, RosterForm.gs, Diagnose.gs
 * ไฟล์นี้ไม่ประกาศ onOpen (อยู่ใน Roster.gs)
 *
 * รหัสผ่านและข้อมูลนักเรียนอยู่ในชีตเท่านั้น หน้าเว็บไม่เคยได้รับรายชื่ออาจารย์ รหัสผ่าน หรือรายชื่อนักเรียนทั้งหมด
 */

const Q = {
  TEACHERS: 'Teachers',
  ROUNDS: 'Rounds',
  STUDENTS: 'Students',
  STATE: 'TeacherState',

  S_WAIT: 'รอ',
  S_BUSY: 'กำลังสัมภาษณ์',
  S_DONE: 'เสร็จ',
  S_SKIP: 'ข้าม',
  T_FREE: 'ว่าง',
  T_BUSY: 'สัมภาษณ์อยู่',
  T_REST: 'พัก',
  T_OFF: 'ออฟไลน์',

  MEET_RE: /^https:\/\/meet\.google\.com\/(?:(?:meet|lookup)\/)?[a-z0-9-]+(\?.*)?$/i,

  TOKEN_TTL: 21600,                    // 6 ชั่วโมง
  // อาจารย์ที่สถานะ "ว่าง" แต่เงียบเกินเวลานี้ จะถูกตัดเป็น "ออฟไลน์" ตั้งไว้ 2 นาที เพราะเบราว์เซอร์ลดความถี่
  // ของแท็บที่อยู่เบื้องหลัง (ตอนอาจารย์สลับไปหน้า Meet) เหลือประมาณนาทีละครั้ง
  TEACHER_STALE_MS: 120000,
  // นักเรียนที่ "รอ" แต่เงียบเกินเวลานี้ จะถูกข้าม ตั้งไว้ 20 นาที เพราะมือถือหยุดโพลล์ตอนปิดจอหรือสลับแอป
  STUDENT_STALE_MS: 1200000,

  MAX_FAILS: 5,                        // ลองผิดได้กี่ครั้ง
  FAIL_WINDOW_S: 600,                  // ภายในกี่วินาที (แล้วล็อกชั่วคราวเท่ากัน)
  JOIN_PER_MIN: 120,                   // จำนวน join รวมทั้งระบบต่อนาที
  LOCK_WAIT_MS: 20000
};

/* ---------------------------------------------------------------- entry points */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'rounds') return qOut_(qRoundsPublic_());
    if (p.action === 'ping') return qOut_({ ok: true });
    return qOut_({ ok: false, error: 'คำสั่งไม่ถูกต้อง' });
  } catch (err) {
    return qFail_(err);
  }
}

function doPost(e) {
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (b.action) {
      case 'join': return qOut_(qJoin_(b));
      case 'status': return qOut_(qStatus_(b));
      case 'teacherLogin': return qOut_(qTeacherLogin_(b));
      case 'state':
      case 'free':
      case 'rest':
      case 'finish':
      case 'skip':
      case 'logout':
        return qOut_(qTeacherAction_(b));
      default:
        return qOut_({ ok: false, error: 'คำสั่งไม่ถูกต้อง' });
    }
  } catch (err) {
    return qFail_(err);
  }
}

function qOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function qFail_(err) {
  Logger.log('ERROR: ' + (err && err.stack ? err.stack : err));
  return qOut_({ ok: false, error: 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง' });
}

/* ---------------------------------------------------------------- rounds */

function qRoundsPublic_() {
  const list = qReadRoundsList_().filter(function (r) { return r.open; });
  return {
    ok: true,
    rounds: list.map(function (r) { return { code: r.code, name: r.label }; })
  };
}

/** รอบทั้งหมดตามลำดับแถว [{code,label,open,key}] */
function qReadRoundsList_() {
  const tab = SpreadsheetApp.getActive().getSheetByName(Q.ROUNDS);
  if (!tab) return [];
  return tab.getDataRange().getValues().slice(1)
    .map(function (r) {
      const code = qClean_(r[0]);
      return {
        code: code,
        label: qClean_(r[1]) || code,
        open: r[2] === true || String(r[2]).toUpperCase() === 'TRUE',
        key: qNorm_(code)
      };
    })
    .filter(function (r) { return r.code; });
}

function qRoundsMap_() {
  const map = {};
  qReadRoundsList_().forEach(function (r) { map[r.key] = r; });
  return map;
}

/* ---------------------------------------------------------------- student */

function qJoin_(b) {
  const name = qClean_(b.name);
  const phoneRaw = String(b.phone == null ? '' : b.phone);
  if (!name || name.length > 200) return { ok: false, error: 'กรุณากรอกชื่อ-สกุล' };
  if (phoneRaw.length > 30) return { ok: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
  const phone4 = qPhone4_(phoneRaw);

  if (qJoinRateExceeded_()) {
    return { ok: false, error: 'ระบบกำลังมีผู้ใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่' };
  }
  const failKey = 'jf_' + qHash_(qNorm_(name));
  if (qCount_(failKey) >= Q.MAX_FAILS) {
    return { ok: false, error: 'ลองหลายครั้งเกินไป กรุณารอประมาณ 10 นาทีแล้วลองใหม่ หรือติดต่อเจ้าหน้าที่' };
  }

  return qWithLock_(function () {
    const rounds = qRoundsMap_();
    const sSheet = SpreadsheetApp.getActive().getSheetByName(Q.STUDENTS);
    const vals = sSheet.getDataRange().getValues();
    const nameKey = qNorm_(name);

    // แถวที่ชื่อตรง และเบอร์ท้าย 4 หลักตรง (แถวที่ไม่มีเบอร์เก็บไว้ ใช้ชื่ออย่างเดียว)
    const matches = [];
    for (let i = 1; i < vals.length; i++) {
      const r = vals[i];
      if (qNorm_(r[1]) !== nameKey) continue;
      const rowPhone = qPhone4_(r[8]);
      if (rowPhone && rowPhone !== phone4) continue;
      matches.push({
        i: i,
        ticket: String(r[0]).trim(),
        status: String(r[3]).trim(),
        round: qNorm_(r[2])
      });
    }
    if (!matches.length) {
      qCountAdd_(failKey);
      return { ok: false, error: 'ไม่พบข้อมูลนี้ในรอบที่เปิดรับ ตรวจชื่อและเบอร์ให้ตรงกับที่กรอกในฟอร์ม หรือแจ้งเจ้าหน้าที่' };
    }

    const unclaimed = matches.filter(function (m) { return !m.ticket && !m.status; });
    if (!unclaimed.length) {
      return { ok: false, error: 'ชื่อนี้เข้าคิวแล้ว ถ้าปิดหน้าไปให้แจ้งเจ้าหน้าที่' };
    }
    const open = unclaimed.filter(function (m) { return rounds[m.round] && rounds[m.round].open; });
    if (!open.length) {
      return { ok: false, error: 'รอบของคุณยังไม่เปิดหรือปิดรับแล้ว ติดต่อเจ้าหน้าที่' };
    }

    let choice = null;
    const wanted = qNorm_(b.round);
    if (wanted) {
      choice = open.filter(function (m) { return m.round === wanted; })[0] || null;
      if (!choice) return { ok: false, error: 'รอบที่เลือกไม่ตรงกับข้อมูลของคุณ' };
    } else {
      const seen = {};
      const distinct = [];
      open.forEach(function (m) {
        if (!seen[m.round]) { seen[m.round] = true; distinct.push(rounds[m.round]); }
      });
      if (distinct.length > 1) {
        return {
          ok: true,
          needRound: true,
          rounds: distinct.map(function (r) { return { code: r.code, name: r.label }; })
        };
      }
      choice = open[0];
    }

    const ticket = Utilities.getUuid();
    const row = choice.i + 1;
    sSheet.getRange(row, 1).setValue(ticket);
    sSheet.getRange(row, 4, 1, 2).setValues([[Q.S_WAIT, new Date()]]);
    qBeat_('s', ticket);
    qDispatch_();   // ถ้ามีอาจารย์ว่างอยู่ จะได้รับคิวทันที

    const rd = rounds[choice.round];
    return { ok: true, ticket: ticket, round: rd.code, roundName: rd.label };
  });
}

/** อ่านอย่างเดียว ไม่ล็อก (แต่บันทึกว่านักเรียนยังอยู่) */
function qStatus_(b) {
  const ticket = String(b.ticket || '').trim();
  if (!ticket || ticket.length > 64) return { ok: false, gone: true, error: 'ไม่พบตั๋ว กรุณาเข้าคิวใหม่' };

  const ss = SpreadsheetApp.getActive();
  const vals = ss.getSheetByName(Q.STUDENTS).getDataRange().getValues();
  let me = -1;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === ticket) { me = i; break; }
  }
  if (me < 0) return { ok: false, gone: true, error: 'ไม่พบตั๋ว กรุณาเข้าคิวใหม่' };
  qBeat_('s', ticket);

  const row = vals[me];
  const rounds = qRoundsMap_();
  const roundKey = qNorm_(row[2]);
  const rd = rounds[roundKey];
  const base = { ok: true, name: row[1], round: rd ? rd.code : String(row[2]), roundName: rd ? rd.label : String(row[2]) };
  const status = String(row[3]).trim();

  if (status === Q.S_DONE) return Object.assign(base, { status: 'done' });
  if (status === Q.S_SKIP) return Object.assign(base, { status: 'skipped' });
  if (status === Q.S_BUSY) {
    return Object.assign(base, { status: 'busy', teacher: String(row[5]), meet: String(row[6]) });
  }
  if (status !== Q.S_WAIT) return { ok: false, gone: true, error: 'ไม่พบตั๋ว กรุณาเข้าคิวใหม่' };

  // รอคิว: นับคนที่รออยู่ข้างหน้าในรอบเดียวกัน
  const myT = row[4] instanceof Date ? row[4].getTime() : 0;
  let ahead = 0;
  let waiting = 1;   // นับตัวเองด้วย
  for (let i = 1; i < vals.length; i++) {
    if (i === me) continue;
    const r = vals[i];
    if (String(r[3]).trim() !== Q.S_WAIT || qNorm_(r[2]) !== roundKey) continue;
    waiting++;
    const t = r[4] instanceof Date ? r[4].getTime() : 0;
    if (t < myT || (t === myT && i < me)) ahead++;
  }

  let freeTeachers = 0;
  const state = ss.getSheetByName(Q.STATE).getDataRange().getValues();
  for (let i = 1; i < state.length; i++) {
    const email = qNorm_(state[i][0]);
    if (!email || qNorm_(state[i][1]) !== roundKey) continue;
    if (String(state[i][2]).trim() === Q.T_FREE && qSeenAge_('t', email) <= Q.TEACHER_STALE_MS) freeTeachers++;
  }
  return Object.assign(base, {
    status: 'wait', ahead: ahead, position: ahead + 1,
    behind: waiting - ahead - 1, waiting: waiting, freeTeachers: freeTeachers
  });
}

/* ---------------------------------------------------------------- teacher */

function qTeacherLogin_(b) {
  const email = qNorm_(b.email);
  const password = String(b.password == null ? '' : b.password).trim();
  if (!email || email.length > 200 || !password || password.length > 200) {
    return { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }
  const failKey = 'lf_' + qHash_(email);
  if (qCount_(failKey) >= Q.MAX_FAILS) {
    return { ok: false, error: 'ลองหลายครั้งเกินไป กรุณารอประมาณ 10 นาทีแล้วลองใหม่' };
  }

  return qWithLock_(function () {
    const teacher = qFindTeacher_(email);
    // ตรวจรหัสผ่านทุกครั้งแม้ไม่พบอีเมล เพื่อไม่ให้เวลาตอบบอกว่ามีอีเมลนี้หรือไม่ ข้อความเดียวกันทุกกรณี
    const ok = qSafeEq_(teacher ? teacher.password : '\u0000', password) && !!teacher;
    if (!ok) {
      qCountAdd_(failKey);
      return { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    }
    CacheService.getScriptCache().remove(failKey);

    const rd = qRoundsMap_()[qNorm_(b.round)];
    if (!rd || !rd.open) return { ok: false, error: 'ไม่พบรอบนี้หรือรอบยังไม่เปิดรับ' };

    const sheet = SpreadsheetApp.getActive().getSheetByName(Q.STATE);
    let st = qFindState_(email);
    if (!st) {
      sheet.appendRow([email, rd.code, Q.T_REST, '', '']);
    } else if (!String(st.data[4]).trim()) {
      // ไม่มีนักเรียนค้างอยู่: เริ่มใหม่ที่สถานะ "พัก" ในรอบที่เลือก (ลิงก์ Meet เดิมคงไว้)
      sheet.getRange(st.row, 2, 1, 2).setValues([[rd.code, Q.T_REST]]);
    }
    // ถ้ามีนักเรียนค้างอยู่ (ล็อกอินซ้ำระหว่างสัมภาษณ์) คงรอบและสถานะเดิม ไม่รีเซ็ต

    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('tok_' + token, JSON.stringify({ email: email }), Q.TOKEN_TTL);
    qBeat_('t', email);
    return { ok: true, token: token, state: qTeacherState_(email) };
  });
}

function qTeacherAction_(b) {
  const raw = CacheService.getScriptCache().get('tok_' + String(b.token || ''));
  if (!raw) return { ok: false, auth: true, error: 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' };
  const email = JSON.parse(raw).email;

  return qWithLock_(function () {
    const st = qFindState_(email);
    if (!st) return { ok: false, auth: true, error: 'ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' };
    const sheet = SpreadsheetApp.getActive().getSheetByName(Q.STATE);
    const ticket = String(st.data[4]).trim();
    qBeat_('t', email);

    switch (b.action) {
      case 'free': {
        if (ticket) return { ok: false, error: 'ยังมีนักเรียนที่กำลังสัมภาษณ์อยู่' };
        const meet = String(b.meet || st.data[3] || '').trim();
        if (!Q.MEET_RE.test(meet)) {
          return { ok: false, error: 'ลิงก์ Meet ไม่ถูกต้อง (ต้องขึ้นต้น https://meet.google.com/)' };
        }
        sheet.getRange(st.row, 3, 1, 2).setValues([[Q.T_FREE, meet]]);
        break;
      }
      case 'rest': {
        if (ticket) return { ok: false, error: 'ยังมีนักเรียนที่กำลังสัมภาษณ์อยู่' };
        sheet.getRange(st.row, 3).setValue(Q.T_REST);
        break;
      }
      case 'finish':
      case 'skip': {
        if (!ticket) return { ok: false, error: 'ไม่มีนักเรียนที่กำลังสัมภาษณ์อยู่' };
        qSetStudentStatusByTicket_(ticket, b.action === 'finish' ? Q.S_DONE : Q.S_SKIP);
        sheet.getRange(st.row, 3).setValue(Q.T_FREE);
        sheet.getRange(st.row, 5).setValue('');
        break;
      }
      case 'logout': {
        if (!ticket) sheet.getRange(st.row, 3).setValue(Q.T_OFF);
        CacheService.getScriptCache().remove('tok_' + String(b.token));
        return { ok: true };
      }
      default:
        break; // state: แค่ดูสถานะ (และให้ตัวจัดคิวทำงาน)
    }
    qDispatch_();
    return { ok: true, state: qTeacherState_(email) };
  });
}

function qTeacherState_(email) {
  const ss = SpreadsheetApp.getActive();
  const st = qFindState_(email);
  const t = qFindTeacher_(email);
  const rounds = qRoundsMap_();
  const roundKey = qNorm_(st.data[1]);
  const rd = rounds[roundKey];
  const ticket = String(st.data[4]).trim();
  const teacherName = t ? t.name : email;

  let waiting = 0, done = 0, myDone = 0, student = null;
  ss.getSheetByName(Q.STUDENTS).getDataRange().getValues().slice(1).forEach(function (r) {
    if (ticket && String(r[0]).trim() === ticket) student = { name: String(r[1]) };
    if (qNorm_(r[2]) !== roundKey) return;
    const s = String(r[3]).trim();
    if (s === Q.S_WAIT) waiting++;
    if (s === Q.S_DONE) {
      done++;
      if (qNorm_(r[5]) === qNorm_(teacherName)) myDone++;
    }
  });

  return {
    name: teacherName,
    email: email,
    round: rd ? rd.code : String(st.data[1]),
    roundName: rd ? rd.label : String(st.data[1]),
    status: String(st.data[2]).trim() || Q.T_OFF,
    meet: String(st.data[3]),
    student: student,
    waiting: waiting,
    doneCount: done,
    myDoneCount: myDone
  };
}

/* ---------------------------------------------------------------- dispatch */

/**
 * จับคู่นักเรียนที่รอกับอาจารย์ที่ว่าง (ต้องเรียกภายใน lock) คืนจำนวนที่จับคู่
 * 1) อาจารย์ที่ "ว่าง" แต่เงียบนาน -> ออฟไลน์   2) นักเรียนที่ "รอ" แต่เงียบนานมาก -> ข้าม
 * 3) ต่อรอบ: นักเรียนคนที่เข้าคิวก่อน (FIFO) + อาจารย์ที่สุ่มจากคนที่ว่างและมีลิงก์ Meet ถูกต้อง
 */
function qDispatch_() {
  const ss = SpreadsheetApp.getActive();
  const sSheet = ss.getSheetByName(Q.STUDENTS);
  const tSheet = ss.getSheetByName(Q.STATE);
  const names = qTeacherNames_();
  const stateVals = tSheet.getDataRange().getValues();
  const stuVals = sSheet.getDataRange().getValues();
  const now = Date.now();
  const nowDate = new Date(now);

  for (let i = 1; i < stateVals.length; i++) {
    const email = qNorm_(stateVals[i][0]);
    if (!email) continue;
    if (String(stateVals[i][2]).trim() === Q.T_FREE && qSeenAge_('t', email) > Q.TEACHER_STALE_MS) {
      tSheet.getRange(i + 1, 3).setValue(Q.T_OFF);
      stateVals[i][2] = Q.T_OFF;
    }
  }

  const waiting = {};
  for (let i = 1; i < stuVals.length; i++) {
    const r = stuVals[i];
    if (String(r[3]).trim() !== Q.S_WAIT) continue;
    const ticket = String(r[0]).trim();
    const qt = r[4] instanceof Date ? r[4].getTime() : NaN;
    let age = qSeenAge_('s', ticket);
    if (age === Infinity) age = isNaN(qt) ? Infinity : now - qt;
    if (age > Q.STUDENT_STALE_MS) {
      sSheet.getRange(i + 1, 4).setValue(Q.S_SKIP);
      continue;
    }
    const key = qNorm_(r[2]);
    (waiting[key] = waiting[key] || []).push({ i: i, t: isNaN(qt) ? 0 : qt });
  }

  const free = {};
  for (let i = 1; i < stateVals.length; i++) {
    const r = stateVals[i];
    const email = qNorm_(r[0]);
    if (!email || String(r[2]).trim() !== Q.T_FREE || String(r[4]).trim()) continue;
    const meet = String(r[3]).trim();
    if (!Q.MEET_RE.test(meet)) continue;
    const key = qNorm_(r[1]);
    (free[key] = free[key] || []).push({ row: i + 1, email: email, meet: meet });
  }

  let assigned = 0;
  Object.keys(waiting).forEach(function (key) {
    const students = waiting[key].sort(function (a, b) { return (a.t - b.t) || (a.i - b.i); });
    const teachers = free[key] || [];
    while (students.length && teachers.length) {
      const s = students.shift();
      const t = teachers.splice(Math.floor(Math.random() * teachers.length), 1)[0];
      const ticket = String(stuVals[s.i][0]).trim();
      sSheet.getRange(s.i + 1, 4).setValue(Q.S_BUSY);
      sSheet.getRange(s.i + 1, 6, 1, 3).setValues([[names[t.email] || t.email, t.meet, nowDate]]);
      tSheet.getRange(t.row, 3).setValue(Q.T_BUSY);
      tSheet.getRange(t.row, 5).setValue(ticket);
      assigned++;
    }
  });
  return assigned;
}

/* ---------------------------------------------------------------- sheet helpers */

function qFindTeacher_(email) {
  const tab = SpreadsheetApp.getActive().getSheetByName(Q.TEACHERS);
  const vals = tab.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (qNorm_(vals[i][1]) === email) {
      return { name: qClean_(vals[i][0]), email: email, password: String(vals[i][2]).trim() };
    }
  }
  return null;
}

function qTeacherNames_() {
  const map = {};
  SpreadsheetApp.getActive().getSheetByName(Q.TEACHERS).getDataRange().getValues().slice(1).forEach(function (r) {
    const e = qNorm_(r[1]);
    if (e) map[e] = qClean_(r[0]);
  });
  return map;
}

/** แถวของอาจารย์ในแท็บ TeacherState คืน {row, data} (row เริ่มที่ 1) หรือ null */
function qFindState_(email) {
  const vals = SpreadsheetApp.getActive().getSheetByName(Q.STATE).getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (qNorm_(vals[i][0]) === email) {
      const d = vals[i].slice();
      while (d.length < 5) d.push('');
      return { row: i + 1, data: d };
    }
  }
  return null;
}

function qSetStudentStatusByTicket_(ticket, status) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(Q.STUDENTS);
  const vals = sheet.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === ticket) {
      sheet.getRange(i + 1, 4).setValue(status);
      return true;
    }
  }
  return false;
}

/* ---------------------------------------------------------------- generic helpers */

function qWithLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(Q.LOCK_WAIT_MS)) {
    return { ok: false, error: 'ระบบกำลังยุ่ง กรุณาลองใหม่อีกครั้ง' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function qClean_(s) {
  return String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
}
function qNorm_(s) {
  return qClean_(s).toLowerCase();
}

/** ตัวเลข 4 ตัวท้ายของเบอร์ ว่างถ้าไม่มีตัวเลข (ตรงกับ Roster.gs) */
function qPhone4_(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  if (!d) return '';
  const last = d.slice(-4);
  return last.length < 4 ? ('0000' + last).slice(-4) : last;
}

function qSafeEq_(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function qHash_(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))
  );
}

/* heartbeat และตัวนับ ใช้ CacheService (ไม่เขียนชีต) */

function qBeat_(kind, key) {
  CacheService.getScriptCache().put('seen_' + kind + '_' + key, String(Date.now()), 21600);
}

/** อายุของ heartbeat เป็นมิลลิวินาที (Infinity ถ้าไม่เคยเห็นหรือหมดอายุใน cache) */
function qSeenAge_(kind, key) {
  const v = CacheService.getScriptCache().get('seen_' + kind + '_' + key);
  return v ? Date.now() - Number(v) : Infinity;
}

function qCount_(key) {
  return Number(CacheService.getScriptCache().get(key) || 0);
}

function qCountAdd_(key) {
  CacheService.getScriptCache().put(key, String(qCount_(key) + 1), Q.FAIL_WINDOW_S);
}

function qJoinRateExceeded_() {
  const key = 'jr_' + Math.floor(Date.now() / 60000);
  const n = qCount_(key) + 1;
  CacheService.getScriptCache().put(key, String(n), 120);
  return n > Q.JOIN_PER_MIN;
}
