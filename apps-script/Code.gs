/**
 * ระบบคิวสอบสัมภาษณ์ DSSI — Apps Script Web App
 * ผูกกับ Google Sheet (Execute as: Me, Access: Anyone)
 * รหัสผ่านและข้อมูลทั้งหมดอยู่ในชีตเท่านั้น ตรวจสิทธิ์ที่ฝั่งนี้เท่านั้น
 */

var SHEET_TEACHERS = 'Teachers';
var SHEET_STUDENTS = 'Students';
var SHEET_ROUNDS = 'Rounds';

var T_STATUS_FREE = 'ว่าง';
var T_STATUS_BUSY = 'สัมภาษณ์อยู่';
var T_STATUS_REST = 'พัก';
var S_STATUS_WAIT = 'รอ';
var S_STATUS_BUSY = 'กำลังสัมภาษณ์';
var S_STATUS_DONE = 'เสร็จ';

// คอลัมน์ (เริ่ม 0)
var TC = { NAME: 0, PASS: 1, STATUS: 2, ROUND: 3, MEET: 4, CURRENT: 5 };
var SC = { QUEUE: 0, ID: 1, NAME: 2, ROUND: 3, STATUS: 4, TEACHER: 5, MEET: 6, TIME: 7 };

var MEET_RE = /^https:\/\/meet\.google\.com\/[a-z0-9-]+(\?.*)?$/;

var TOKEN_TTL_SEC = 6 * 60 * 60;
var MAX_FAILS = 5;
var LOCK_MINUTES = 10;
var LOCK_WAIT_MS = 15000;

// ---------------------------------------------------------------- setup

/** รันครั้งเดียวจากตัวแก้ไข Apps Script เพื่อสร้างแท็บและหัวตาราง */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_TEACHERS, ['ชื่ออาจารย์', 'รหัสผ่าน', 'สถานะ', 'รอบ', 'ลิงก์ Meet', 'นักเรียนปัจจุบัน']);
  ensureSheet_(ss, SHEET_STUDENTS, ['ลำดับคิว', 'รหัสนักเรียน', 'ชื่อ', 'รอบ', 'สถานะ', 'อาจารย์', 'ลิงก์ Meet', 'เวลารับคิว']);
  ensureSheet_(ss, SHEET_ROUNDS, ['รหัสรอบ']);
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ---------------------------------------------------------------- entry points

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'teachers') return json_(getTeachers_());
    if (p.action === 'student') return json_(getStudent_(String(p.id || '')));
    return json_(fail_('คำขอไม่ถูกต้อง'));
  } catch (err) {
    return json_(fail_('ระบบมีปัญหา ลองใหม่อีกครั้ง'));
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!lock.tryLock(LOCK_WAIT_MS)) return json_(fail_('ระบบกำลังยุ่ง ลองใหม่อีกครั้ง'));
    try {
      return json_(handlePost_(body));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_(fail_('ระบบมีปัญหา ลองใหม่อีกครั้ง'));
  }
}

function handlePost_(body) {
  var action = String(body.action || '');
  if (action === 'login') return login_(body);

  var session = getSession_(String(body.token || ''));
  if (!session) return { ok: false, auth: true, error: 'เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง' };

  if (action === 'logout') return logout_(String(body.token), session);
  if (action === 'state') return doState_(session);
  if (action === 'free') return doFree_(session, String(body.meet || ''));
  if (action === 'rest') return doRest_(session);
  if (action === 'finish') return doFinish_(session);
  return fail_('คำขอไม่ถูกต้อง');
}

// ---------------------------------------------------------------- GET

function getTeachers_() {
  var rows = readRows_(SHEET_TEACHERS);
  var names = [];
  rows.forEach(function (r) {
    var n = str_(r[TC.NAME]);
    if (n) names.push(n);
  });
  return { ok: true, teachers: names };
}

/** ส่งเฉพาะข้อมูลของนักเรียนคนที่ขอ ห้ามมีข้อมูลคนอื่น */
function getStudent_(id) {
  id = id.trim();
  if (!id) return fail_('กรอกรหัสนักเรียน');
  var students = readRows_(SHEET_STUDENTS);
  var me = null;
  for (var i = 0; i < students.length; i++) {
    if (str_(students[i][SC.ID]) === id) { me = students[i]; break; }
  }
  if (!me) return fail_('ไม่พบรหัสนักเรียนนี้ ตรวจรหัสแล้วลองใหม่');

  var round = str_(me[SC.ROUND]);
  var status = str_(me[SC.STATUS]);
  var out = { ok: true, name: str_(me[SC.NAME]), round: round };

  if (status === S_STATUS_DONE) {
    out.status = 'done';
    return out;
  }
  if (status === S_STATUS_BUSY) {
    out.status = 'busy';
    out.teacher = str_(me[SC.TEACHER]);
    var meet = str_(me[SC.MEET]);
    out.meet = MEET_RE.test(meet) ? meet : '';
    return out;
  }

  var waiting = waitingList_(students, round);
  var position = 0;
  for (var k = 0; k < waiting.length; k++) {
    if (str_(waiting[k][SC.ID]) === id) { position = k + 1; break; }
  }
  var free = 0;
  readRows_(SHEET_TEACHERS).forEach(function (t) {
    if (str_(t[TC.STATUS]) === T_STATUS_FREE && str_(t[TC.ROUND]) === round && !str_(t[TC.CURRENT])) free++;
  });
  out.status = 'wait';
  out.position = position;
  out.ahead = Math.max(position - 1, 0);
  out.behind = Math.max(waiting.length - position, 0);
  out.waiting = waiting.length;
  out.freeTeachers = free;
  return out;
}

// ---------------------------------------------------------------- login / session

function login_(body) {
  var name = str_(body.name);
  var password = str_(body.password);
  var round = str_(body.round);
  if (!name || !password || !round) return fail_('กรอกชื่อ รหัสผ่าน และรหัสรอบให้ครบ');

  var cache = CacheService.getScriptCache();
  var lockKey = 'lock_' + name;
  var lockedUntil = Number(cache.get(lockKey) || 0);
  if (lockedUntil > Date.now()) {
    return fail_('กรอกรหัสผิดหลายครั้ง ลองใหม่อีกครั้งใน ' + Math.ceil((lockedUntil - Date.now()) / 60000) + ' นาที');
  }

  var found = findTeacher_(name);
  // รหัสผ่านผิดหรือไม่พบชื่อ ตอบข้อความเดียวกัน
  if (!found || str_(found.row[TC.PASS]) !== password) {
    var failKey = 'fail_' + name;
    var fails = Number(cache.get(failKey) || 0) + 1;
    if (fails >= MAX_FAILS) {
      cache.put(lockKey, String(Date.now() + LOCK_MINUTES * 60000), LOCK_MINUTES * 60);
      cache.remove(failKey);
      return fail_('กรอกรหัสผิดหลายครั้ง ลองใหม่อีกครั้งใน ' + LOCK_MINUTES + ' นาที');
    }
    cache.put(failKey, String(fails), LOCK_MINUTES * 60);
    return fail_('ชื่อหรือรหัสผ่านไม่ถูกต้อง เหลืออีก ' + (MAX_FAILS - fails) + ' ครั้ง');
  }
  cache.remove('fail_' + name);

  if (!roundAllowed_(round)) return fail_('ไม่พบรหัสรอบนี้ ตรวจรหัสรอบแล้วลองใหม่');

  var sheet = sheet_(SHEET_TEACHERS);
  var rowNo = found.rowNo;
  var hasStudent = !!str_(found.row[TC.CURRENT]);
  sheet.getRange(rowNo, TC.ROUND + 1).setValue(round);
  if (!hasStudent) sheet.getRange(rowNo, TC.STATUS + 1).setValue(T_STATUS_REST);

  var token = Utilities.getUuid();
  cache.put('tok_' + token, JSON.stringify({ name: name }), TOKEN_TTL_SEC);
  return { ok: true, token: token, state: buildState_(name) };
}

function getSession_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('tok_' + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function logout_(token, session) {
  CacheService.getScriptCache().remove('tok_' + token);
  var t = findTeacher_(session.name);
  if (t && !str_(t.row[TC.CURRENT]) && str_(t.row[TC.STATUS]) === T_STATUS_FREE) {
    sheet_(SHEET_TEACHERS).getRange(t.rowNo, TC.STATUS + 1).setValue(T_STATUS_REST);
  }
  return { ok: true };
}

// ---------------------------------------------------------------- teacher actions (อยู่ใน lock ทั้งหมด)

function doState_(session) {
  var t = findTeacher_(session.name);
  if (!t) return fail_('ไม่พบอาจารย์ในชีต');
  if (str_(t.row[TC.STATUS]) === T_STATUS_FREE && !str_(t.row[TC.CURRENT])) tryMatch_(session.name);
  return { ok: true, state: buildState_(session.name) };
}

function doFree_(session, meet) {
  meet = meet.trim();
  if (!MEET_RE.test(meet)) return fail_('ลิงก์ Meet ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://meet.google.com/');
  var t = findTeacher_(session.name);
  if (!t) return fail_('ไม่พบอาจารย์ในชีต');
  if (str_(t.row[TC.CURRENT])) return fail_('ยังมีนักเรียนค้างอยู่ กด "สัมภาษณ์เสร็จ" ก่อน');
  if (!str_(t.row[TC.ROUND])) return fail_('ยังไม่มีรอบ เข้าสู่ระบบใหม่อีกครั้ง');
  var sh = sheet_(SHEET_TEACHERS);
  sh.getRange(t.rowNo, TC.STATUS + 1).setValue(T_STATUS_FREE);
  sh.getRange(t.rowNo, TC.MEET + 1).setValue(meet);
  tryMatch_(session.name);
  return { ok: true, state: buildState_(session.name) };
}

function doRest_(session) {
  var t = findTeacher_(session.name);
  if (!t) return fail_('ไม่พบอาจารย์ในชีต');
  if (str_(t.row[TC.CURRENT])) return fail_('ยังมีนักเรียนค้างอยู่ กด "สัมภาษณ์เสร็จ" ก่อน');
  sheet_(SHEET_TEACHERS).getRange(t.rowNo, TC.STATUS + 1).setValue(T_STATUS_REST);
  return { ok: true, state: buildState_(session.name) };
}

function doFinish_(session) {
  var t = findTeacher_(session.name);
  if (!t) return fail_('ไม่พบอาจารย์ในชีต');
  var current = str_(t.row[TC.CURRENT]);
  if (!current) return fail_('ไม่มีนักเรียนที่กำลังสัมภาษณ์');

  var ssh = sheet_(SHEET_STUDENTS);
  var students = readRows_(SHEET_STUDENTS);
  for (var i = 0; i < students.length; i++) {
    if (str_(students[i][SC.ID]) === current && str_(students[i][SC.STATUS]) === S_STATUS_BUSY) {
      ssh.getRange(i + 2, SC.STATUS + 1).setValue(S_STATUS_DONE);
      break;
    }
  }
  var tsh = sheet_(SHEET_TEACHERS);
  tsh.getRange(t.rowNo, TC.CURRENT + 1).clearContent();
  tsh.getRange(t.rowNo, TC.STATUS + 1).setValue(T_STATUS_FREE);
  tryMatch_(session.name);
  return { ok: true, state: buildState_(session.name) };
}

// ---------------------------------------------------------------- matching (ต้องเรียกภายใน lock)

function tryMatch_(teacherName) {
  var t = findTeacher_(teacherName);
  if (!t) return false;
  var round = str_(t.row[TC.ROUND]);
  var meet = str_(t.row[TC.MEET]);
  if (str_(t.row[TC.STATUS]) !== T_STATUS_FREE) return false;
  if (str_(t.row[TC.CURRENT])) return false;
  if (!round || !MEET_RE.test(meet)) return false;

  var students = readRows_(SHEET_STUDENTS);
  var best = -1;
  var bestQ = Infinity;
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (str_(s[SC.ROUND]) !== round || !isWaiting_(s) || !str_(s[SC.ID])) continue;
    var q = queueNo_(s);
    if (q < bestQ) { bestQ = q; best = i; }
  }
  if (best < 0) return false;

  var ssh = sheet_(SHEET_STUDENTS);
  ssh.getRange(best + 2, SC.STATUS + 1, 1, 4).setValues([[S_STATUS_BUSY, teacherName, meet, new Date()]]);
  var tsh = sheet_(SHEET_TEACHERS);
  tsh.getRange(t.rowNo, TC.STATUS + 1).setValue(T_STATUS_BUSY);
  tsh.getRange(t.rowNo, TC.CURRENT + 1).setValue(str_(students[best][SC.ID]));
  return true;
}

// ---------------------------------------------------------------- state

function buildState_(teacherName) {
  var t = findTeacher_(teacherName);
  var row = t.row;
  var round = str_(row[TC.ROUND]);
  var current = str_(row[TC.CURRENT]);
  var students = readRows_(SHEET_STUDENTS);
  var student = null;
  var done = 0;
  students.forEach(function (s) {
    if (str_(s[SC.ID]) === current && current) student = { id: current, name: str_(s[SC.NAME]) };
    if (str_(s[SC.STATUS]) === S_STATUS_DONE && str_(s[SC.TEACHER]) === teacherName) done++;
  });
  return {
    name: teacherName,
    status: str_(row[TC.STATUS]),
    round: round,
    meet: str_(row[TC.MEET]),
    student: student,
    waiting: waitingList_(students, round).length,
    done: done,
  };
}

// ---------------------------------------------------------------- helpers

function isWaiting_(s) {
  var st = str_(s[SC.STATUS]);
  return st === '' || st === S_STATUS_WAIT;
}

function queueNo_(s) {
  var n = Number(s[SC.QUEUE]);
  return isNaN(n) || s[SC.QUEUE] === '' ? Number.MAX_VALUE : n;
}

/** นักเรียนที่รอในรอบนั้น เรียงตามลำดับคิว (เสมอกันใช้ลำดับแถว) */
function waitingList_(students, round) {
  var list = [];
  students.forEach(function (s, i) {
    if (str_(s[SC.ROUND]) === round && isWaiting_(s) && str_(s[SC.ID])) list.push({ s: s, i: i });
  });
  list.sort(function (a, b) {
    var d = queueNo_(a.s) - queueNo_(b.s);
    return d !== 0 ? d : a.i - b.i;
  });
  return list.map(function (x) { return x.s; });
}

function roundAllowed_(round) {
  return readRows_(SHEET_ROUNDS).some(function (r) { return str_(r[0]) === round; });
}

function findTeacher_(name) {
  var rows = readRows_(SHEET_TEACHERS);
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i][TC.NAME]) === name) return { row: rows[i], rowNo: i + 2 };
  }
  return null;
}

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('missing sheet ' + name);
  return sh;
}

/** อ่านข้อมูลทุกแถวหลังหัวตาราง (แถวแรกของผลลัพธ์ = แถวที่ 2 ในชีต) */
function readRows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 8)).getValues();
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function fail_(msg) {
  return { ok: false, error: msg };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
