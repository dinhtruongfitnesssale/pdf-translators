# PDF Translator — Đọc & Dịch PDF (Anh → Việt)

Web-app: mở PDF tiếng Anh, xem **bản gốc** và **bản dịch tiếng Việt** (song song, chỉnh sửa được), đọc kiểu **cuộn** hoặc **lật sách**, rồi **tải bản dịch ra PDF**. Không dùng database, không lưu tài liệu lên server — file đọc ngay trong trình duyệt; bản dịch lưu trong trình duyệt.

## Tính năng

- Song ngữ (gốc | dịch), hoặc chỉ Bản gốc / chỉ Bản dịch.
- Dịch qua **Gemini (miễn phí)** hoặc **Claude** — dán API key của bạn (không lưu ở server).
- Áp bộ **skill dịch** riêng theo lĩnh vực: Fitness & Health, Learning & Development (sửa trong `prompts.js`).
- Modal chọn phạm vi trang để dịch, hoặc dịch cả cuốn.
- Sửa/xóa chữ bản dịch, tự lưu; nhớ tài liệu + vị trí đọc khi refresh.
- Chế độ **Đọc sách**: 2 trang/màn hình, lật trang (click/phím ← →) có hiệu ứng giở trang, phóng to, toàn màn hình. Áp dụng cho cả bản gốc và bản dịch (bản dịch tự dàn sang trang mới khi dài).
- Xuất PDF bản dịch (font **Be Vietnam Pro**, đủ dấu tiếng Việt).

## Chạy tại máy (local)

```
npm install
npm start
```

Mở **http://localhost:5173**. Lấy API key: Gemini tại `aistudio.google.com/apikey`, Claude tại `console.anthropic.com`.

## Deploy lên Vercel

Repo đã cấu hình sẵn (`vercel.json`). Cách nhanh:

1. Push repo này lên GitHub.
2. Vào [vercel.com](https://vercel.com) → **New Project** → chọn repo `pdf-translators`.
3. Giữ nguyên mặc định (không cần Build Command, không cần biến môi trường — API key do người dùng nhập ở trình duyệt) → **Deploy**.

Hoặc bằng CLI: `npm i -g vercel` rồi `vercel` trong thư mục dự án.

> Ghi chú: mỗi lượt dịch là một request tới hàm serverless. Gói Vercel Hobby giới hạn ~10s/request — Gemini Flash và Claude Haiku thường phản hồi nhanh; model lớn (Opus) cho trang dài đôi khi lâu hơn, nếu gặp timeout hãy chọn model nhanh hơn.

## Ghi chú kỹ thuật

- `server.js` chạy được cả local (Express, `npm start`) lẫn Vercel (export app cho serverless).
- pdf.js được chép sẵn vào `public/vendor/pdfjs` (phục vụ tĩnh, không cần đọc `node_modules` lúc chạy).
- Font xuất PDF: `fonts/BeVietnamPro-*.ttf` (giấy phép OFL — tự do phát hành).
- Sửa quy tắc dịch/bảng thuật ngữ: `prompts.js`.
