/**
 * Roster.gs — ซิงก์รายชื่อนักเรียนจากไฟล์ Roster (ที่นักศึกษาช่วยงานดูแล) เข้าแท็บ Students
 * วางเป็นไฟล์แยกในโปรเจกต์ Apps Script ข้าง Code.gs และ Setup.gs
 *
 * แนวคิด: หนึ่งรอบ = หนึ่งฟอร์ม = หนึ่งแท็บคำตอบในไฟล์ Roster และ "ชื่อแท็บ" คือรหัสรอบ
 *         (เช่น 27_10_2026_port) ต้องตรงกับรหัสรอบในแท็บ Rounds ของไฟล์หลัก
 * ไฟล์ Roster: ทุกแท็บที่แถวแรกมีหัวคอลัมน์ "ชื่อ-สกุล" (หรือ "ชื่อ") ถือเป็นแท็บของหนึ่งรอบ
 *         แท็บที่ไม่มีหัวคอลัมน์นี้ (เช่น แท็บว่าง) ถูกข้าม
 *         ซิงก์เฉพาะ ชื่อ รอบ และเบอร์โทร 4 ตัวท้าย (จากคอลัมน์ "เบอร์โทรศัพท์") ไว้ยืนยันตัวตนตอนเข้าคิว
 *         ไม่คัดลอกอีเมล เบอร์เต็ม หรือลิงก์เข้าไฟล์หลัก
 * ตั้งค่า: Script properties > ROSTER_SHEET_ID = ID ของไฟล์ Roster
 *         (RosterForm.gs ตั้งให้เองตอนสร้างฟอร์ม ห้ามใส่ในโค้ดหรือ repo)
 * ใช้งาน: เมนู "คิวสัมภาษณ์" > "ซิงก์รายชื่อนักเรียนทันที" (ปุ่มซิงก์เอง) หรือ "ตั้งซิงก์อัตโนมัติ (ทุก 1 นาที)"
 *         หรือรัน installRosterTrigger() หนึ่งครั้ง (RosterForm.gs เรียกให้เองตอนสร้างฟอร์ม)
 *         ถ้าตั้งไว้แบบเดิม (ทุก 5 นาที) ให้รัน installRosterTrigger() ซ้ำ จะแทนที่ด้วยทุก 1 นาที
 *         ซิงก์ทุก 1 นาทีใช้เวลารันของ trigger วันละราว 1 ชั่วโมงขึ้นไป (โควตา trigger: บัญชีทั่วไป 90 นาที/วัน
 *         บัญชี Workspace 6 ชั่วโมง/วัน) ควรปิดด้วยเมนู "ปิดซิงก์อัตโนมัติ" เมื่อไม่ใช้
 *
 * กติกา: เพิ่มอย่างเดียว ไม่แก้ ไม่ลบแถวที่มีใน Students (กันนักเรียนที่เข้าคิวอยู่หลุด)
 *        ข้อยกเว้นเดียว: เติมเบอร์ 4 ตัวท้ายลงช่องที่ว่างของแถวเดิม (แถวที่ซิงก์ไว้ก่อนมีช่องเบอร์)
 */

/** เมนูในชีต โปรเจกต์นี้ต้องมี onOpen ตัวเดียวเท่านั้น (ตัวนี้) */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('คิวสัมภาษณ์')
    .addItem('ซิงก์รายชื่อนักเรียนทันที', 'syncRoster')
    .addSeparator()
    .addItem('ตั้งซิงก์อัตโนมัติ (ทุก 1 นาที)', 'installRosterTriggerFromMenu')
    .addItem('ปิดซิงก์อัตโนมัติ', 'removeRosterTrigger')
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

/**
 * ฟังก์ชันสำหรับ trigger: เหมือน syncRoster แต่ไม่รอ lock นาน (ถ้าตัวจัดคิวกำลังใช้ lock อยู่ ข้ามรอบนี้ไป
 * รอบต่อไปค่อยซิงก์) ไม่โยน error เมื่อยังไม่ตั้ง ROSTER_SHEET_ID เพื่อไม่ให้มีอีเมลแจ้งความผิดพลาดทุกนาที
 */
function syncRosterAuto() {
  const id = PropertiesService.getScriptProperties().getProperty('ROSTER_SHEET_ID');
  if (!id) {
    Logger.log('ข้าม: ยังไม่ได้ตั้ง ROSTER_SHEET_ID');
    return 'ยังไม่ได้ตั้ง ROSTER_SHEET_ID';
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('ข้ามรอบนี้: ระบบกำลังยุ่ง จะซิงก์ใหม่รอบหน้า');
    return 'ข้ามรอบนี้ (ระบบกำลังยุ่ง)';
  }
  let summary;
  try {
    summary = rosterSyncLocked_(id);
  } finally {
    lock.releaseLock();
  }
  Logger.log(summary);
  return summary;
}

/**
 * ตั้งให้ซิงก์เองทุก 1 นาที รันซ้ำได้ (ลบ trigger ซิงก์เดิมทั้งแบบเก่าและใหม่ แล้วตั้งใหม่ตัวเดียว
 * จึงใช้เปลี่ยนจากทุก 5 นาทีเป็นทุก 1 นาทีได้ด้วย)
 */
function installRosterTrigger() {
  removeRosterTriggers_();
  ScriptApp.newTrigger('syncRosterAuto').timeBased().everyMinutes(1).create();
  return 'ตั้ง trigger ซิงก์ทุก 1 นาทีแล้ว';
}

/** ปิดซิงก์อัตโนมัติ (ลบ trigger ซิงก์ทั้งหมด) */
function removeRosterTrigger() {
  const n = removeRosterTriggers_();
  const msg = n ? 'ปิดซิงก์อัตโนมัติแล้ว (ลบ ' + n + ' trigger)' : 'ไม่มี trigger ซิงก์อยู่';
  rosterAlert_('ซิงก์อัตโนมัติ', msg);
  return msg;
}

/** สำหรับเมนู: ตั้งซิงก์อัตโนมัติแล้วแจ้งผลในหน้าต่าง */
function installRosterTriggerFromMenu() {
  const msg = installRosterTrigger();
  rosterAlert_('ซิงก์อัตโนมัติ', msg);
  return msg;
}

/* ---------- ตัวช่วย ---------- */

function rosterSyncLocked_(rosterId) {
  const main = SpreadsheetApp.getActive();
  const stu = main.getSheetByName('Students');
  rosterEnsurePhoneColumn_(stu);
  const rounds = rosterReadRounds_(main);          // { รหัสรอบแบบ normalize: รหัสรอบตามที่พิมพ์ใน Rounds }
  const tabs = rosterReadTabs_(SpreadsheetApp.openById(rosterId));

  // แถวที่มีใน Students แล้ว จัดกลุ่มตามรอบ+ชื่อ
  const existing = {};
  stu.getDataRange().getValues().forEach(function (r, i) {
    if (i === 0 || !String(r[1]).trim()) return;
    const k = rosterKey_(r[2], r[1]);
    (existing[k] = existing[k] || []).push({ row: i + 1, phone4: rosterPhone4_(r[8]), used: false });
  });

  const toAdd = [];
  const fills = [];
  const lines = [];
  const warns = [];

  tabs.forEach(function (t) {
    const code = rounds[rosterNorm_(t.tab)];
    if (!code) {
      warns.push('แท็บ "' + t.tab + '" ไม่มีในแท็บ Rounds (ข้าม) ตรวจว่ารหัสรอบตรงกับชื่อแท็บ');
      return;
    }
    if (!t.hasPhone) {
      warns.push('แท็บ "' + t.tab + '" ไม่มีคอลัมน์ "เบอร์โทรศัพท์" (ซิงก์ชื่อได้ แต่ยืนยันด้วยเบอร์ไม่ได้ ' +
        'ให้เพิ่มช่องเบอร์โทรศัพท์ในฟอร์มของรอบนี้)');
    }

    let added = 0;
    t.people.forEach(function (p) {
      const list = existing[rosterKey_(code, p.name)] || [];
      let item = null;
      // 1) แถวเดิมที่ชื่อและเบอร์ท้าย 4 หลักตรงกัน
      for (let i = 0; i < list.length; i++) {
        if (!list[i].used && list[i].phone4 === p.phone4) { item = list[i]; break; }
      }
      if (item) { item.used = true; return; }
      // 2) แถวเดิมที่ยังไม่มีเบอร์ (ซิงก์ไว้ก่อนมีช่องเบอร์) ให้เติมเบอร์ลงแถวเดิม ไม่เพิ่มแถวซ้ำ
      if (p.phone4) {
        for (let i = 0; i < list.length; i++) {
          if (!list[i].used && !list[i].phone4) { item = list[i]; break; }
        }
        if (item) { item.used = true; fills.push({ row: item.row, phone4: p.phone4 }); return; }
      }
      // 3) ยังไม่มีในระบบ เพิ่มแถวใหม่
      toAdd.push(['', p.name, code, '', '', '', '', '', p.phone4]);
      added++;
    });
    lines.push('- ' + code + ': เพิ่ม ' + added + ' คน (ในแท็บมี ' + t.people.length + ' ชื่อ)');
  });

  fills.forEach(function (f) {
    stu.getRange(f.row, 9).setNumberFormat('@').setValue(f.phone4);
  });
  if (toAdd.length) {
    const start = stu.getLastRow() + 1;
    stu.getRange(start, 9, toAdd.length, 1).setNumberFormat('@'); // กันเลข 0 นำหน้าหาย
    stu.getRange(start, 1, toAdd.length, 9).setValues(toAdd);
  }

  let msg = 'เพิ่มนักเรียนใหม่ ' + toAdd.length + ' คน';
  if (fills.length) msg += ' เติมเบอร์ให้แถวเดิม ' + fills.length + ' แถว';
  if (lines.length) msg += '\n' + lines.join('\n');
  if (warns.length) msg += '\nข้อควรตรวจ:\n' + warns.join('\n');
  return msg;
}

function removeRosterTriggers_() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const h = t.getHandlerFunction();
    if (h === 'syncRoster' || h === 'syncRosterAuto') {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  return n;
}

function rosterAlert_(title, msg) {
  try {
    SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // รันจากตัวแก้ไขหรือ trigger ไม่มีหน้าต่าง UI
  }
}

/** ให้แท็บ Students มีคอลัมน์ที่ 9 "เบอร์ท้าย 4 หลัก" (เติมให้เองถ้ายังไม่มี) */
function rosterEnsurePhoneColumn_(stu) {
  if (stu.getMaxColumns() < 9) stu.insertColumnsAfter(stu.getMaxColumns(), 9 - stu.getMaxColumns());
  if (!String(stu.getRange(1, 9).getValue()).trim()) {
    stu.getRange(1, 9).setValue('เบอร์ท้าย 4 หลัก').setFontWeight('bold');
  }
}

/** อ่านแท็บ Rounds ในไฟล์หลัก คืน map ของรหัสรอบ (normalize แล้ว) ไปยังรหัสรอบตามที่พิมพ์ */
function rosterReadRounds_(main) {
  const tab = main.getSheetByName('Rounds');
  if (!tab) throw new Error('ไม่พบแท็บ Rounds ในไฟล์หลัก ให้รัน setupV2() ก่อน');
  const map = {};
  tab.getDataRange().getValues().slice(1).forEach(function (r) {
    const code = rosterClean_(r[0]);
    if (code) map[rosterNorm_(code)] = code;
  });
  return map;
}

/**
 * คืนรายการ [{tab, hasPhone, people:[{name, phone4}]}] เฉพาะแท็บที่แถวแรกมีหัวคอลัมน์ "ชื่อ-สกุล" (หรือ "ชื่อ")
 * เบอร์ดึงจากคอลัมน์ "เบอร์โทรศัพท์" (หรือ "เบอร์โทร") เฉพาะ 4 ตัวท้าย
 */
function rosterReadTabs_(ss) {
  const out = [];
  ss.getSheets().forEach(function (sh) {
    if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) return;
    const values = sh.getDataRange().getValues();
    const head = values[0].map(function (h) { return rosterClean_(h); });
    let nameCol = head.indexOf('ชื่อ-สกุล');
    if (nameCol < 0) nameCol = head.indexOf('ชื่อ');
    if (nameCol < 0) return;
    let phoneCol = head.indexOf('เบอร์โทรศัพท์');
    if (phoneCol < 0) phoneCol = head.indexOf('เบอร์โทร');

    const people = values.slice(1)
      .map(function (r) {
        return {
          name: rosterClean_(r[nameCol]),
          phone4: phoneCol >= 0 ? rosterPhone4_(r[phoneCol]) : ''
        };
      })
      .filter(function (p) { return p.name; });
    out.push({ tab: sh.getName(), hasPhone: phoneCol >= 0, people: people });
  });
  if (!out.length) {
    throw new Error('ไม่พบแท็บที่มีหัวคอลัมน์ "ชื่อ-สกุล" (หรือ "ชื่อ") ในไฟล์ Roster');
  }
  return out;
}

/** ตัวเลข 4 ตัวท้ายของเบอร์ (ไม่สนขีด ช่องว่าง หรือ +66) ว่างถ้าไม่มีตัวเลข */
function rosterPhone4_(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  if (!d) return '';
  const last = d.slice(-4);
  return last.length < 4 ? ('0000' + last).slice(-4) : last;
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
