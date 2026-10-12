/**
 * RosterForm.gs — สร้าง Google Form เก็บข้อมูลผู้เข้าสอบสัมภาษณ์ และส่งคำตอบเข้าไฟล์ DSSI_Interview_Roster
 * วางเป็นไฟล์แยกในโปรเจกต์ Apps Script ของไฟล์หลัก (ข้าง Code.gs, Setup.gs, Roster.gs)
 *
 * createRosterForm()      รันครั้งเดียว สร้างฟอร์ม + หา/สร้างไฟล์ DSSI_Interview_Roster + ผูกคำตอบเข้าไฟล์นั้น
 *                         + ตั้ง Script property ROSTER_SHEET_ID ให้เอง (Roster.gs ใช้ค่านี้)
 * prepareRosterSheet()    เพิ่มคอลัมน์ "รอบ" (พร้อม dropdown รหัสรอบจากแท็บ Rounds) ในแท็บคำตอบ
 *                         รันซ้ำได้ เช่น หลังเพิ่มรอบใหม่ เพื่อรีเฟรชรายการใน dropdown
 * showRosterFormLinks()   แสดงลิงก์ฟอร์ม (สำหรับแก้ไข / สำหรับส่งให้นักเรียน) และลิงก์ไฟล์ Roster
 *
 * ครั้งแรกที่รันจะขอสิทธิ์เพิ่ม: Google Forms, Google Drive และ Sheets
 * ฟอร์มกับไฟล์ Roster จะเป็นของบัญชีที่รันสคริปต์ (ควรเป็นบัญชีเดียวกับเจ้าของไฟล์หลัก)
 */

const RF = {
  FILE_NAME: 'DSSI_Interview_Roster',
  FORM_TITLE: 'ข้อมูลผู้เข้าสอบสัมภาษณ์ หลักสูตร DSSI',
  // ปรับข้อความให้ตรงกับประกาศ/นโยบายข้อมูลส่วนบุคคลของหลักสูตรก่อนเปิดใช้จริง
  FORM_DESC:
    'กรอกข้อมูลสำหรับการสอบสัมภาษณ์เข้าศึกษาในหลักสูตร Data Science and Software Innovation (DSSI) ' +
    'มหาวิทยาลัยอุบลราชธานี\n' +
    'ข้อมูลที่กรอกใช้เพื่อการสอบสัมภาษณ์เท่านั้น [ปรับข้อความตามประกาศของหลักสูตร]',
  CONFIRM_MSG: 'บันทึกข้อมูลแล้ว ใช้ชื่อ-สกุลที่กรอกนี้เป็นชื่อเมื่อเข้าคิวสอบสัมภาษณ์ในวันสอบ',
  // 'VERIFIED' = ใช้อีเมลบัญชี Google ที่ล็อกอิน (ต้องล็อกอินก่อนตอบ) / 'INPUT' = ให้ผู้ตอบพิมพ์อีเมลเอง
  EMAIL_MODE: 'VERIFIED',
  REQUIRE_PORTFOLIO: true
};

function createRosterForm() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ROSTER_FORM_ID')) {
    throw new Error('สร้างฟอร์มไว้แล้ว (มี ROSTER_FORM_ID) ถ้าต้องการสร้างใหม่ ' +
      'ให้ลบคีย์นี้ใน Project Settings > Script properties ก่อน (ฟอร์มเก่าไม่ถูกลบ)');
  }

  const ss = rfGetOrCreateRoster_();

  const form = FormApp.create(RF.FORM_TITLE);
  form.setDescription(RF.FORM_DESC);
  form.setConfirmationMessage(RF.CONFIRM_MSG);
  form.setAllowResponseEdits(true);       // แก้ลิงก์ที่วางผิดได้ภายหลัง
  form.setShowLinkToRespondAgain(false);
  rfSetupEmail_(form);

  form.addTextItem()
    .setTitle('ชื่อ-สกุล')
    .setHelpText('พิมพ์ชื่อและนามสกุล ไม่ต้องใส่คำนำหน้า (เช่น นาย/นางสาว) ' +
      'ใช้ชื่อนี้ตอนเข้าคิวสอบสัมภาษณ์')
    .setRequired(true);

  form.addTextItem()
    .setTitle('โรงเรียน')
    .setRequired(true);

  const urlRule = FormApp.createTextValidation()
    .setHelpText('กรุณาวางลิงก์ที่ขึ้นต้นด้วย https://')
    .requireTextIsUrl()
    .build();

  // Apps Script สร้างช่องอัปโหลดไฟล์ไม่ได้ จึงให้วางลิงก์ไฟล์ใน Google Drive แทน
  const linkHelp = 'อัปโหลดไฟล์ขึ้น Google Drive แล้วตั้งสิทธิ์ให้ "ทุกคนที่มีลิงก์" เปิดดูได้ ' +
    'จากนั้นคัดลอกลิงก์มาวางที่นี่';

  form.addTextItem()
    .setTitle('ลิงก์ไฟล์ ปพ.1')
    .setHelpText(linkHelp)
    .setValidation(urlRule)
    .setRequired(true);

  form.addTextItem()
    .setTitle('ลิงก์ Portfolio')
    .setHelpText(linkHelp)
    .setValidation(urlRule)
    .setRequired(RF.REQUIRE_PORTFOLIO);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  props.setProperty('ROSTER_FORM_ID', form.getId());

  // แท็บคำตอบอาจโผล่ช้าเล็กน้อยหลังผูกฟอร์ม ลองรอแล้วเตรียมคอลัมน์ "รอบ"
  let prep = '';
  for (let i = 0; i < 5; i++) {
    SpreadsheetApp.flush();
    Utilities.sleep(2000);
    prep = prepareRosterSheet();
    if (prep.indexOf('ยังไม่พบ') < 0) break;
  }

  const summary =
    'สร้างฟอร์มแล้ว\n' +
    'ลิงก์ส่งให้นักเรียน: ' + form.getPublishedUrl() + '\n' +
    'ลิงก์แก้ไขฟอร์ม: ' + form.getEditUrl() + '\n' +
    'ไฟล์ Roster: ' + ss.getUrl() + '\n' +
    prep;
  Logger.log(summary);
  return summary;
}

function prepareRosterSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('ROSTER_SHEET_ID');
  if (!id) throw new Error('ยังไม่มี ROSTER_SHEET_ID ให้รัน createRosterForm() ก่อน');

  const ss = SpreadsheetApp.openById(id);
  const sh = rfFindResponsesTab_(ss);
  if (!sh) {
    return 'ยังไม่พบแท็บคำตอบของฟอร์ม (รอสักครู่แล้วรัน prepareRosterSheet() อีกครั้ง)';
  }

  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let col = head.indexOf('รอบ') + 1;
  if (!col) {
    col = sh.getLastColumn() + 1;
    sh.getRange(1, col).setValue('รอบ').setFontWeight('bold');
  }

  const codes = rfRoundCodes_();
  if (codes.length) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(codes, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, col, 1000, 1).setDataValidation(rule);
    return 'เตรียมคอลัมน์ "รอบ" แล้ว (ตัวเลือก: ' + codes.join(', ') + ')';
  }
  return 'เตรียมคอลัมน์ "รอบ" แล้ว (ยังไม่มีรอบในแท็บ Rounds จึงยังไม่มี dropdown)';
}

function showRosterFormLinks() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('ROSTER_FORM_ID');
  const sheetId = props.getProperty('ROSTER_SHEET_ID');
  if (!formId) throw new Error('ยังไม่ได้สร้างฟอร์ม ให้รัน createRosterForm() ก่อน');
  const form = FormApp.openById(formId);
  const out =
    'ลิงก์ส่งให้นักเรียน: ' + form.getPublishedUrl() + '\n' +
    'ลิงก์แก้ไขฟอร์ม: ' + form.getEditUrl() + '\n' +
    'ไฟล์ Roster: ' + (sheetId ? SpreadsheetApp.openById(sheetId).getUrl() : '-');
  Logger.log(out);
  return out;
}

/* ---------- ตัวช่วย ---------- */

function rfGetOrCreateRoster_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('ROSTER_SHEET_ID');
  if (existingId) return SpreadsheetApp.openById(existingId);

  const matches = [];
  const files = DriveApp.getFilesByName(RF.FILE_NAME);
  while (files.hasNext()) {
    const f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) matches.push(f);
  }
  if (matches.length > 1) {
    throw new Error('พบไฟล์ชื่อ ' + RF.FILE_NAME + ' มากกว่าหนึ่งไฟล์ ' +
      'ให้ตั้ง ROSTER_SHEET_ID ใน Script properties เป็นไฟล์ที่ต้องการก่อน แล้วรันใหม่');
  }
  if (matches.length === 1) {
    props.setProperty('ROSTER_SHEET_ID', matches[0].getId());
    return SpreadsheetApp.openById(matches[0].getId());
  }
  const ss = SpreadsheetApp.create(RF.FILE_NAME);
  props.setProperty('ROSTER_SHEET_ID', ss.getId());
  return ss;
}

function rfSetupEmail_(form) {
  try {
    if (RF.EMAIL_MODE === 'VERIFIED') {
      form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
      try { form.setLimitOneResponsePerUser(true); } catch (e) { Logger.log('ข้าม limit 1 ครั้ง: ' + e); }
    } else {
      form.setEmailCollectionType(FormApp.EmailCollectionType.RESPONDER_INPUT);
    }
  } catch (e) {
    // เผื่อ API เวอร์ชันนี้ไม่มี setEmailCollectionType
    form.setCollectEmail(true);
    Logger.log('ใช้ setCollectEmail(true) แทน: ' + e);
  }
}

function rfFindResponsesTab_(ss) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) continue;
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (head.indexOf('ชื่อ-สกุล') >= 0) return sh;
  }
  return null;
}

function rfRoundCodes_() {
  const main = SpreadsheetApp.getActive();
  const tab = main ? main.getSheetByName('Rounds') : null;
  if (!tab) return [];
  return tab.getDataRange().getValues().slice(1)
    .map(function (r) { return String(r[0]).trim(); })
    .filter(Boolean);
}
