/**
 * Roster.gs — ซิงก์รายชื่อนักเรียนจากไฟล์ Roster (ที่นักศึกษาช่วยงานดูแล) เข้าแท็บ Students
 * วางเป็นไฟล์แยกในโปรเจกต์ Apps Script ข้าง Code.gs และ Setup.gs
 *
 * ไฟล์ Roster: Google Sheet แยก (เช่น DSSI_Interview_Roster) ระบบหาแท็บที่แถวแรกมีหัวคอลัมน์
 *         "ชื่อ-สกุล" (หรือ "ชื่อ") และ "รอบ" ให้เอง ไม่ขึ้นกับตำแหน่งคอลัมน์
 *         แท็บคำตอบของ Google Form ใช้ได้ (สร้างด้วย RosterForm.gs) ต้องมีคอลัมน์ "รอบ" ที่ผู้ดูแลกรอก
 *         แถวที่ยังไม่กำหนดรอบจะยังไม่ถูกซิงก์
 * ตั้งค่า: Project Settings > Script properties > เพิ่มคีย์ ROSTER_SHEET_ID = ID ของไฟล์ Roster
 *         (ID คือข้อความยาวใน URL ระหว่าง /d/ กับ /edit ห้ามใส่ในโค้ดหรือ repo)
 * ใช้งาน: เมนู "คิวสัมภาษณ์" > "ซิงก์รายชื่อนักเรียน" หรือรัน installRosterTrigger() หนึ่งครั้ง
 *         เพื่อให้ซิงก์เองทุก 5 นาที
 *
 * กติกา: เพิ่มอย่างเดียว ไม่แก้ ไม่ลบแถวที่มีใน Students (กันนักเรียนที่เข้าคิวอยู่หลุด)
 */

/** เมนูในชีต โปรเจกต์นี้ต้องมี onOpen ตัวเดียวเท่านั้น (ตัวนี้) */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('คิวสัมภาษณ์')
    .addItem('ซิงก์รายชื่อนักเรียน', 'syncRoster')
    .addToUi();
}

function syncRoster() {
  const id = PropertiesService.getScriptProperties().getProperty('ROSTER_SHEET_ID');
  if (!id) {
    throw new Error('ยังไม่ได้ตั้ง ROSTER_SHEET_ID ที่ Project Settings > Script properties');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let summary;
  try {
    summary = rosterSyncLocked_(id);
  } finally {
    lock.releaseLock();
  }

  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert('ซิงก์รายชื่อ', summary, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // รันจาก trigger ไม่มีหน้าต่าง UI ให้ดูผลใน Executions
  }
  return summary;
}

/** ตั้งให้ซิงก์เองทุก 5 นาที รันครั้งเดียว (รันซ้ำไม่สร้างตัวซ้ำ) */
function installRosterTrigger() {
  const exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'syncRoster';
  });
  if (exists) return 'มี trigger ซิงก์อยู่แล้ว';
  ScriptApp.newTrigger('syncRoster').timeBased().everyMinutes(5).create();
  return 'ตั้ง trigger ซิงก์ทุก 5 นาทีแล้ว';
}

/* ---------- ตัวช่วย ---------- */

function rosterSyncLocked_(rosterId) {
  const rosterRows = rosterReadRows_(SpreadsheetApp.openById(rosterId));

  const ss = SpreadsheetApp.getActive();
  const stu = ss.getSheetByName('Students');

  const rounds = {};
  ss.getSheetByName('Rounds').getDataRange().getValues().slice(1).forEach(function (r) {
    if (String(r[0]).trim()) rounds[rosterNorm_(r[0])] = true;
  });

  // นับชื่อที่มีใน Students แล้ว แยกตามรอบ+ชื่อ
  const have = {};
  stu.getDataRange().getValues().slice(1).forEach(function (r) {
    if (!String(r[1]).trim()) return;
    const k = rosterKey_(r[2], r[1]);
    have[k] = (have[k] || 0) + 1;
  });

  const need = {};
  const toAdd = [];
  const warns = [];
  let pending = 0;

  rosterRows.forEach(function (r, i) {
    const name = rosterClean_(r[0]);
    const round = String(r[1] == null ? '' : r[1]).trim();
    const rowNo = i + 2;
    if (!name && !round) return;
    if (name && !round) {
      pending++; // ฟอร์มส่งมาแล้วแต่ผู้ดูแลยังไม่กำหนดรอบ รอซิงก์ครั้งต่อไป
      return;
    }
    if (!name) {
      warns.push('แถว ' + rowNo + ': มีรอบแต่ไม่มีชื่อ (ข้าม)');
      return;
    }
    if (!rounds[rosterNorm_(round)]) {
      warns.push('แถว ' + rowNo + ': รอบ "' + round + '" ไม่มีในแท็บ Rounds (ข้าม)');
      return;
    }
    const k = rosterKey_(round, name);
    need[k] = (need[k] || 0) + 1;
    if (need[k] > (have[k] || 0)) {
      toAdd.push(['', name, round, '', '', '', '', '']);
    }
  });

  if (toAdd.length) {
    stu.getRange(stu.getLastRow() + 1, 1, toAdd.length, 8).setValues(toAdd);
  }

  let msg = 'เพิ่มนักเรียนใหม่ ' + toAdd.length + ' คน';
  if (pending) msg += '\nยังไม่กำหนดรอบ ' + pending + ' คน (ยังไม่ซิงก์ ใส่รอบในไฟล์ Roster แล้วซิงก์ใหม่)';
  if (warns.length) {
    msg += '\nข้อควรตรวจ ' + warns.length + ' รายการ:\n' + warns.slice(0, 20).join('\n');
    if (warns.length > 20) msg += '\n... และอีก ' + (warns.length - 20) + ' รายการ';
  }
  return msg;
}

/**
 * หาแท็บที่แถวแรกมีหัวคอลัมน์ "ชื่อ-สกุล" (หรือ "ชื่อ") และ "รอบ"
 * คืน [[ชื่อ, รอบ], ...] ทุกแถวใต้หัวตาราง (ลำดับตรงกับแถวในชีต เริ่มที่แถว 2)
 */
function rosterReadRows_(ss) {
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const sh = sheets[s];
    if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) continue;
    const values = sh.getDataRange().getValues();
    const head = values[0].map(function (h) { return rosterClean_(h); });
    let nameCol = head.indexOf('ชื่อ-สกุล');
    if (nameCol < 0) nameCol = head.indexOf('ชื่อ');
    const roundCol = head.indexOf('รอบ');
    if (nameCol >= 0 && roundCol >= 0) {
      return values.slice(1).map(function (r) { return [r[nameCol], r[roundCol]]; });
    }
  }
  throw new Error('ไม่พบแท็บที่มีหัวคอลัมน์ "ชื่อ-สกุล" (หรือ "ชื่อ") และ "รอบ" ในไฟล์ Roster ' +
    '(ถ้าใช้ฟอร์ม ให้รัน prepareRosterSheet() เพื่อเพิ่มคอลัมน์ "รอบ")');
}

function rosterClean_(s) {
  return String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
}
function rosterNorm_(s) {
  return rosterClean_(s).toLowerCase();
}
function rosterKey_(round, name) {
  return rosterNorm_(round) + '|' + rosterNorm_(name);
}
