// URL ของ Apps Script Web App (ลงท้าย /exec) ไม่ใช่ความลับ
// หลัง Deploy ให้นำ URL มาวางแทนค่าด้านล่าง
window.DSSI_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec',
  TEACHER_POLL_MS: 5000,  // อาจารย์โพลล์ต่อแม้แท็บถูกซ่อน (ไม่งั้นถูกตัดเป็นออฟไลน์)
  STUDENT_POLL_MS: 8000,  // นักเรียนหยุดโพลล์ได้เมื่อแท็บถูกซ่อน
};
