/**
 * Diagnose.gs — ตรวจว่าทำไมซิงก์รายชื่อไม่ทำงาน
 * วางเป็นไฟล์ใหม่ในโปรเจกต์ Apps Script ของไฟล์หลัก แล้วรัน diagnoseRoster() ดูผลใน Execution log
 *
 * พิมพ์เฉพาะสถานะการตั้งค่า ชื่อแท็บ และหัวตาราง ไม่พิมพ์ชื่อนักเรียนหรือข้อมูลใดๆ ในแถว
 * เมื่อแก้ปัญหาเสร็จลบไฟล์นี้ทิ้งได้
 */
function diagnoseRoster() {
  const out = [];
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROSTER_SHEET_ID');

  out.push('ROSTER_SHEET_ID: ' + (id ? 'ตั้งแล้ว (ขึ้นต้น ' + id.substring(0, 6) + '...)' : 'ยังไม่ได้ตั้ง'));
  out.push('ROSTER_FORM_ID: ' + (props.getProperty('ROSTER_FORM_ID') ? 'ตั้งแล้ว' : 'ยังไม่ได้ตั้ง'));

  const main = SpreadsheetApp.getActive();
  out.push('โปรเจกต์ผูกกับชีตหลัก: ' + (main ? 'ใช่' : 'ไม่ใช่ (ต้องเปิดจาก Extensions > Apps Script ของชีตหลัก)'));
  if (main) {
    const rnd = main.getSheetByName('Rounds');
    out.push('แท็บ Rounds: ' + (rnd
      ? 'มี หัวตาราง = ' + rnd.getRange(1, 1, 1, Math.max(rnd.getLastColumn(), 1)).getValues()[0].join(' | ')
      : 'ไม่มี'));
    const stu = main.getSheetByName('Students');
    if (stu) {
      const head = stu.getRange(1, 1, 1, Math.max(stu.getLastColumn(), 1)).getValues()[0].join(' | ');
      out.push('แท็บ Students: มี หัวตาราง = ' + head);
    } else {
      out.push('แท็บ Students: ไม่มี');
    }
  }

  if (id) {
    try {
      const ss = SpreadsheetApp.openById(id);
      out.push('เปิดไฟล์ Roster ได้: ' + ss.getName());
      ss.getSheets().forEach(function (sh) {
        const cols = sh.getLastColumn();
        const head = cols ? sh.getRange(1, 1, 1, cols).getValues()[0].join(' | ') : '(ว่าง)';
        out.push('- แท็บ "' + sh.getName() + '" แถว ' + sh.getLastRow() + ' คอลัมน์ ' + cols + ' หัวตาราง: ' + head);
      });
    } catch (e) {
      out.push('เปิดไฟล์ Roster ไม่ได้: ' + e);
    }
  }

  out.push('Roster.gs เป็นฉบับล่าสุด (มี rosterReadTabs_): ' +
    (typeof rosterReadTabs_ === 'function' ? 'ใช่' : 'ไม่ใช่ (ยังเป็นฉบับเก่าหรือยังไม่ได้วาง)'));
  out.push('RosterForm.gs เป็นฉบับล่าสุด (มี createRoundForms): ' +
    (typeof createRoundForms === 'function' ? 'ใช่' : 'ไม่ใช่ (ยังเป็นฉบับเก่าหรือยังไม่ได้วาง)'));

  const text = out.join('\n');
  Logger.log(text);
  return text;
}
