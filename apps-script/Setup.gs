/**
 * Setup.gs — สร้างแท็บของคิวสอบสัมภาษณ์ DSSI เวอร์ชัน 2
 * วางเป็นไฟล์แยกในโปรเจกต์ Apps Script (ไฟล์ใหม่ชื่อ Setup) ข้าง Code.gs
 *
 * setupV2()      สร้างแท็บที่ยังไม่มี พร้อมหัวตารางและข้อมูลตัวอย่าง
 *                ไม่แตะแท็บที่มีข้อมูลอยู่แล้ว (แจ้งใน log ถ้าโครงไม่ตรง)
 * resetV2Test()  ล้างทั้ง 4 แท็บแล้วสร้างใหม่ ใช้กับชีตทดสอบเท่านั้น (มีหน้าต่างให้ยืนยัน)
 *
 * รหัสผ่านและอีเมลในข้อมูลตัวอย่างเป็นของสมมติสำหรับทดสอบ ห้ามใช้จริง
 */

const V2_HEADERS = {
  Teachers: ['ชื่อ', 'อีเมล', 'รหัสผ่าน'],
  Rounds: ['รหัสรอบ', 'ชื่อรอบ', 'เปิดรับ'],
  Students: ['ตั๋ว', 'ชื่อ', 'รอบ', 'สถานะ', 'เวลาเข้าคิว', 'อาจารย์', 'ลิงก์ Meet', 'เวลารับคิว'],
  TeacherState: ['อีเมล', 'รอบ', 'สถานะ', 'ลิงก์ Meet', 'ตั๋วปัจจุบัน']
};

const V2_SAMPLE = {
  Teachers: [
    ['อาจารย์ทดสอบ 1', 'teacher1@example.com', 'test-pass-1'],
    ['อาจารย์ทดสอบ 2', 'teacher2@example.com', 'test-pass-2']
  ],
  Rounds: [
    ['A', 'รอบทดสอบ A', true],
    ['B', 'รอบทดสอบ B', false]
  ],
  Students: [
    ['', 'นักเรียนทดสอบ 1', 'A', '', '', '', '', ''],
    ['', 'นักเรียนทดสอบ 2', 'A', '', '', '', '', ''],
    ['', 'นักเรียนทดสอบ 3', 'A', '', '', '', '', ''],
    ['', 'นักเรียนทดสอบ 4', 'A', '', '', '', '', ''],
    ['', 'นักเรียนทดสอบ 5', 'B', '', '', '', '', '']
  ],
  TeacherState: []
};

const STUDENT_STATUSES = ['รอ', 'กำลังสัมภาษณ์', 'เสร็จ', 'ข้าม'];
const TEACHER_STATUSES = ['ว่าง', 'สัมภาษณ์อยู่', 'พัก', 'ออฟไลน์'];

function setupV2() {
  const ss = SpreadsheetApp.getActive();
  const notes = [];

  Object.keys(V2_HEADERS).forEach(function (name) {
    const head = V2_HEADERS[name];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);

    if (sh.getLastRow() === 0) {
      writeTab_(sh, name);
      notes.push('สร้างแท็บ ' + name + ' แล้ว');
      return;
    }
    const existing = sh.getRange(1, 1, 1, head.length).getValues()[0];
    if (existing.join('|') === head.join('|')) {
      notes.push('แท็บ ' + name + ' โครงตรงกับเวอร์ชัน 2 อยู่แล้ว ไม่แก้');
    } else {
      notes.push('คำเตือน: แท็บ ' + name + ' มีข้อมูลเดิมและโครงไม่ตรงกับเวอร์ชัน 2 ไม่ได้แก้ให้ ' +
        '(ถ้าเป็นชีตทดสอบ ใช้ resetV2Test())');
    }
  });

  Logger.log(notes.join('\n'));
  return notes.join('\n');
}

function resetV2Test() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    'ล้างข้อมูล 4 แท็บ?',
    'จะลบข้อมูลทั้งหมดในแท็บ Teachers, Rounds, Students, TeacherState แล้วสร้างใหม่ ' +
      'ใช้กับชีตทดสอบเท่านั้น ทำต่อไหม',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActive();
  Object.keys(V2_HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
    writeTab_(sh, name);
  });
  // session ของอาจารย์ที่ล็อกอินค้างอยู่ใน cache จะหมดอายุเอง (6 ชม.) หรือให้ล็อกอินใหม่
}

/* ---------- ตัวช่วย ---------- */

function writeTab_(sh, name) {
  const head = V2_HEADERS[name];
  const rows = V2_SAMPLE[name];

  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  sh.setFrozenRows(1);

  if (rows.length) {
    sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  }

  if (name === 'Rounds') {
    // ช่อง "เปิดรับ" เป็นช่องติ๊ก ผู้ดูแลเพิ่มรอบใหม่ได้โดยเพิ่มแถว
    sh.getRange(2, 3, 200, 1).insertCheckboxes();
    if (rows.length) sh.getRange(2, 3, rows.length, 1).setValues(rows.map(function (r) { return [r[2]]; }));
  }
  if (name === 'Students') {
    setListValidation_(sh.getRange(2, 4, 1000, 1), STUDENT_STATUSES);
  }
  if (name === 'TeacherState') {
    setListValidation_(sh.getRange(2, 3, 200, 1), TEACHER_STATUSES);
  }
  sh.autoResizeColumns(1, head.length);
}

function setListValidation_(range, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}
