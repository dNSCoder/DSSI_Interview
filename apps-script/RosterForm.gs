/**
 * RosterForm.gs — สร้าง Google Form ต่อรอบ และส่งคำตอบเข้าไฟล์ DSSI_Interview_Roster
 * วางเป็นไฟล์แยกในโปรเจกต์ Apps Script ของไฟล์หลัก (ข้าง Code.gs, Setup.gs, Roster.gs)
 *
 * แนวคิด: หนึ่งรอบ = หนึ่งฟอร์ม = หนึ่งแท็บคำตอบในไฟล์ Roster และชื่อแท็บ = รหัสรอบ
 *
 * วิธีใช้
 *   1. เพิ่มแถวรอบในแท็บ Rounds ของไฟล์หลัก: A รหัสรอบ (เช่น 27_10_2026_port), B ชื่อรอบ,
 *      C เปิดรับ, D ถาม Portfolio (ติ๊กถ้ารอบนี้ต้องกรอกลิงก์ Portfolio) ปล่อย E ว่างไว้
 *   2. รัน createRoundForms() จะสร้างฟอร์มให้ทุกแถวที่ช่อง E ยังว่าง เปลี่ยนชื่อแท็บคำตอบเป็นรหัสรอบ
 *      และเขียนลิงก์ฟอร์ม (ส่งให้นักเรียน) ลงช่อง E ให้เอง รันซ้ำได้ ไม่สร้างฟอร์มซ้ำให้แถวที่มีลิงก์แล้ว
 *      และตั้งให้ซิงก์รายชื่ออัตโนมัติทุก 1 นาทีให้ด้วย (installRosterTrigger ใน Roster.gs ซึ่งแทนที่ trigger เดิมเสมอ)
 *      ครั้งแรกจะขอสิทธิ์เพิ่มสำหรับตั้งทริกเกอร์ ถ้าไม่ต้องการซิงก์อัตโนมัติ ใช้เมนู "คิวสัมภาษณ์ > ปิดซิงก์อัตโนมัติ"
 *      (หรือลบทริกเกอร์ syncRosterAuto ในแถบ "ทริกเกอร์")
 *   3. showRoundFormLinks() แสดงลิงก์ส่งนักเรียนและลิงก์แก้ไขของทุกฟอร์ม
 *
 * รหัสรอบห้ามมีอักขระ / \ : ? * [ ] และยาวไม่เกิน 100 ตัวอักษร (เป็นชื่อแท็บของ Google Sheets)
 * ครั้งแรกที่รันจะขอสิทธิ์: Google Forms, Google Drive และ Sheets
 * ฟอร์มกับไฟล์ Roster เป็นของบัญชีที่รันสคริปต์ (ควรเป็นบัญชีเดียวกับเจ้าของไฟล์หลัก)
 */

const RF = {
  FILE_NAME: 'DSSI_Interview_Roster',
  FORM_TITLE: 'ข้อมูลผู้เข้าสอบสัมภาษณ์ หลักสูตร DSSI',
  // ปรับข้อความให้ตรงกับประกาศ/นโยบายข้อมูลส่วนบุคคลของหลักสูตรก่อนเปิดใช้จริง
  FORM_DESC:
    'กรอกข้อมูลสำหรับการสอบสัมภาษณ์เข้าศึกษาในหลักสูตร Data Science and Software Innovation (DSSI) ' +
    'มหาวิทยาลัยอุบลราชธานี\n' +
    'ข้อมูลที่กรอกใช้เพื่อการสอบสัมภาษณ์เท่านั้น [ปรับข้อความตามประกาศของหลักสูตร]',
  CONFIRM_MSG: 'บันทึกข้อมูลแล้ว ใช้ชื่อ-สกุลและเบอร์โทรศัพท์ที่กรอกนี้ยืนยันตัวตนเมื่อเข้าคิวสอบสัมภาษณ์ในวันสอบ',
  // 'VERIFIED' = ใช้อีเมลบัญชี Google ที่ล็อกอิน (ต้องล็อกอินก่อนตอบ) / 'INPUT' = ให้ผู้ตอบพิมพ์อีเมลเอง
  EMAIL_MODE: 'VERIFIED'
};

function createRoundForms() {
  const main = SpreadsheetApp.getActive();
  const roundsTab = main ? main.getSheetByName('Rounds') : null;
  if (!roundsTab) throw new Error('ไม่พบแท็บ Rounds ในไฟล์หลัก ให้รัน setupV2() ก่อน');

  const props = PropertiesService.getScriptProperties();
  const roster = rfGetOrCreateRoster_();
  const rows = roundsTab.getDataRange().getValues();
  const registry = rfReadRegistry_();
  const notes = [];
  let made = 0;

  for (let i = 1; i < rows.length; i++) {
    const code = String(rows[i][0]).trim();
    const label = String(rows[i][1]).trim();
    const askPortfolio = rows[i][3] === true;
    const existingLink = String(rows[i][4] == null ? '' : rows[i][4]).trim();
    if (!code || existingLink) continue;

    try {
      rfValidateCode_(code);
    } catch (e) {
      notes.push('แถว ' + (i + 1) + ': ' + e.message + ' (ข้าม)');
      continue;
    }
    if (roster.getSheetByName(code)) {
      notes.push('แถว ' + (i + 1) + ': ไฟล์ Roster มีแท็บชื่อ "' + code + '" อยู่แล้ว จึงไม่สร้างฟอร์มซ้ำ ' +
        'ถ้าแท็บนั้นผูกกับฟอร์มเดิมอยู่ ให้วางลิงก์ฟอร์มเดิมลงช่อง E ของแถวนี้เอง');
      continue;
    }

    const form = rfBuildForm_(label || code, askPortfolio);
    const before = roster.getSheets().map(function (s) { return s.getSheetId(); });
    form.setDestination(FormApp.DestinationType.SPREADSHEET, roster.getId());

    const tab = rfWaitNewTab_(roster.getId(), before);
    if (tab) {
      tab.setName(code);
    } else {
      notes.push('แถว ' + (i + 1) + ': สร้างฟอร์มแล้วแต่ยังไม่พบแท็บคำตอบ ' +
        'ให้เปลี่ยนชื่อแท็บคำตอบของฟอร์มนี้ในไฟล์ Roster เป็น "' + code + '" เอง');
    }

    roundsTab.getRange(i + 1, 5).setValue(form.getPublishedUrl());
    registry[code] = form.getId();
    made++;
  }

  props.setProperty('ROUND_FORMS', JSON.stringify(registry));

  // ตั้งซิงก์รายชื่ออัตโนมัติทุก 1 นาที (รันซ้ำไม่สร้างตัวซ้ำ) ถ้าตั้งไม่สำเร็จ ฟอร์มที่สร้างแล้วไม่เสียหาย
  let syncNote;
  try {
    syncNote = installRosterTrigger();
  } catch (e) {
    syncNote = 'ตั้งซิงก์อัตโนมัติไม่สำเร็จ (' + e + ') ให้รัน installRosterTrigger() เอง';
  }

  const summary = 'สร้างฟอร์มใหม่ ' + made + ' ฟอร์ม' +
    (notes.length ? '\n' + notes.join('\n') : '') +
    '\nดูลิงก์ในช่อง E ของแท็บ Rounds หรือรัน showRoundFormLinks()' +
    '\nซิงก์รายชื่อ: ' + syncNote;
  Logger.log(summary);
  return summary;
}

function showRoundFormLinks() {
  const props = PropertiesService.getScriptProperties();
  const registry = rfReadRegistry_();
  const out = [];
  Object.keys(registry).forEach(function (code) {
    try {
      const f = FormApp.openById(registry[code]);
      out.push(code + '\n  ส่งนักเรียน: ' + f.getPublishedUrl() + '\n  แก้ไขฟอร์ม: ' + f.getEditUrl());
    } catch (e) {
      out.push(code + ': เปิดฟอร์มไม่ได้ (' + e + ')');
    }
  });
  const legacyId = props.getProperty('ROSTER_FORM_ID');
  if (legacyId) {
    try {
      const f = FormApp.openById(legacyId);
      out.push('ฟอร์มเดิม (สร้างก่อนแยกตามรอบ)\n  ส่งนักเรียน: ' + f.getPublishedUrl() +
        '\n  แก้ไขฟอร์ม: ' + f.getEditUrl());
    } catch (e) {
      out.push('ฟอร์มเดิม: เปิดไม่ได้ (' + e + ')');
    }
  }
  if (!out.length) out.push('ยังไม่มีฟอร์ม ให้รัน createRoundForms() ก่อน');
  const text = out.join('\n');
  Logger.log(text);
  return text;
}

/** เรียกชื่อเดิมได้เหมือนกัน */
function showRosterFormLinks() {
  return showRoundFormLinks();
}

/* ---------- ตัวช่วย ---------- */

function rfBuildForm_(label, askPortfolio) {
  const form = FormApp.create(RF.FORM_TITLE + ' (' + label + ')');
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

  // เบอร์โทรใช้ยืนยันตัวตนตอนเข้าคิว (กันชื่อซ้ำ) ระบบซิงก์เฉพาะ 4 ตัวท้ายเข้าไฟล์หลัก
  // หัวคำถามต้องเป็น "เบอร์โทรศัพท์" ตรงตัว เพราะ Roster.gs หาคอลัมน์จากชื่อนี้
  const phoneRule = FormApp.createTextValidation()
    .setHelpText('กรอกเบอร์โทรศัพท์เป็นตัวเลข 9-10 หลัก')
    .requireTextMatchesPattern('^[0-9 -]{9,12}$')
    .build();
  form.addTextItem()
    .setTitle('เบอร์โทรศัพท์')
    .setHelpText('ใช้ยืนยันตัวตนตอนเข้าคิวสอบสัมภาษณ์ (ระบบเก็บเฉพาะ 4 ตัวท้ายไว้ใช้ยืนยัน)')
    .setValidation(phoneRule)
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

  if (askPortfolio) {
    form.addTextItem()
      .setTitle('ลิงก์ Portfolio')
      .setHelpText(linkHelp)
      .setValidation(urlRule)
      .setRequired(true);
  }
  return form;
}

function rfValidateCode_(code) {
  if (/[\/\\:?*\[\]]/.test(code)) {
    throw new Error('รหัสรอบ "' + code + '" มีอักขระที่ใช้เป็นชื่อแท็บไม่ได้ ( / \\ : ? * [ ] ) ใช้ขีดล่างแทน');
  }
  if (code.length > 100) {
    throw new Error('รหัสรอบ "' + code + '" ยาวเกิน 100 ตัวอักษร');
  }
}

/** รอให้แท็บคำตอบของฟอร์มใหม่โผล่ในไฟล์ Roster แล้วคืนแท็บนั้น (ไม่พบคืน null) */
function rfWaitNewTab_(rosterId, beforeIds) {
  for (let i = 0; i < 6; i++) {
    SpreadsheetApp.flush();
    Utilities.sleep(2000);
    const fresh = SpreadsheetApp.openById(rosterId).getSheets();
    for (let j = 0; j < fresh.length; j++) {
      if (beforeIds.indexOf(fresh[j].getSheetId()) < 0) return fresh[j];
    }
  }
  return null;
}

function rfReadRegistry_() {
  const raw = PropertiesService.getScriptProperties().getProperty('ROUND_FORMS');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

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
