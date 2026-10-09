# สร้าง css/output.css ด้วย Tailwind standalone CLI (ไม่ต้องมี Node)
# ดาวน์โหลด tailwindcss-windows-x64.exe v3.4.17 จาก
# https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17
# แล้วเปลี่ยนชื่อเป็น tools\tailwindcss.exe (โฟลเดอร์ tools ไม่ถูก commit)
& "$PSScriptRoot\tools\tailwindcss.exe" -c "$PSScriptRoot\tailwind.config.js" -i "$PSScriptRoot\css\input.css" -o "$PSScriptRoot\css\output.css" --minify @args
