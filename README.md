# ระบบคิวสอบสัมภาษณ์ DSSI

หน้าเว็บ static (GitHub Pages) คุยกับ Google Apps Script Web App ที่ผูกกับ Google Sheet
รายละเอียดการออกแบบอยู่ใน [CLAUDE.md](CLAUDE.md)

## ติดตั้ง

### 1. สร้าง Google Sheet และ Apps Script
1. สร้าง Google Sheet ใหม่
2. เมนู **ส่วนขยาย → Apps Script** แล้ววางโค้ดจาก [apps-script/Code.gs](apps-script/Code.gs) ทับของเดิม
3. เปิด **Project Settings → Show "appsscript.json"** แล้ววางเนื้อหาจาก [apps-script/appsscript.json](apps-script/appsscript.json)
4. เลือกฟังก์ชัน `setup` แล้วกด **Run** (อนุญาตสิทธิ์ครั้งแรก) จะได้แท็บ `Teachers`, `Students`, `Rounds` พร้อมหัวตาราง
5. กรอกข้อมูลในชีต
   - `Teachers`: ชื่ออาจารย์ (A) และรหัสผ่าน (B) ส่วน C-F ปล่อยว่างได้
   - `Students`: ลำดับคิว (A), รหัสนักเรียน (B), ชื่อ (C), รอบ (D) ส่วน E-H ปล่อยว่างได้ (ว่าง = `รอ`)
   - `Rounds`: รหัสรอบที่อนุญาตในคอลัมน์ A (เช่น `A`, `B`)
6. แชร์ชีตให้เฉพาะผู้ดูแล เพราะรหัสผ่านอาจารย์เป็นข้อความธรรมดา

### 2. Deploy Web App (ต้องกดเอง)
**Deploy → New deployment → Web app**: Execute as = **Me**, Who has access = **Anyone** แล้วคัดลอก URL ที่ลงท้าย `/exec`
เมื่อแก้โค้ด Apps Script ต้อง **Manage deployments → Edit → New version** ทุกครั้ง

### 3. ตั้งค่าหน้าเว็บ
- วาง URL ใน [js/config.js](js/config.js) ที่ `API_URL` (ไม่ใช่ความลับ)
- วางโลโก้ที่ `assets/dssi-logo.png` (ตอนนี้เป็นภาพ placeholder สีพื้น)

### 4. เปิด GitHub Pages
Push ขึ้น GitHub แล้วเปิด **Settings → Pages → Deploy from branch** เลือก `main` / root

## พัฒนา

ทดสอบในเครื่อง: `python -m http.server 8000` แล้วเปิด http://localhost:8000

แก้ style แล้ว build `css/output.css` ใหม่ (แล้ว commit ไฟล์นั้น):

```powershell
.\build-css.ps1
```

ต้องมี `tools\tailwindcss.exe` (Tailwind standalone CLI v3.4.17 โฟลเดอร์ `tools/` ไม่ถูก commit) ดูลิงก์ดาวน์โหลดใน [build-css.ps1](build-css.ps1)

ข้อความทั้งหมดอยู่ที่ [js/strings.th.js](js/strings.th.js)

## เวอร์ชันที่ vendor ไว้
- Alpine.js 3.14.9 → `vendor/alpine.min.js`
- ฟอนต์ Prompt, Noto Sans Thai (Thai + Latin subset จาก `@fontsource`, ไลเซนส์ OFL) → `fonts/`

## ยังไม่ได้ทำ
- ตัวยืนยันที่สองของนักเรียน (ต้องตัดสินใจก่อนว่าใช้ข้อมูลอะไร)
- หน้าสรุปสำหรับผู้ดูแล
