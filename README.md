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
- **Bookmark** theo trang (nút ☆ trên mỗi trang hoặc phím `B`), đặt tên được, bấm để nhảy tới.
- **Highlight 4 màu** (vàng = quan trọng, xanh = định nghĩa, hồng = chưa hiểu, lá = ví dụ):
  quét chọn chữ ở cột bản dịch, hoặc bật chế độ bôi (phím `H`) rồi kéo một vùng trên trang gốc / trang đè.
- **Ghi chú Cornell** trong ngăn kéo bên phải (phím `N`): Cue | Notes | Summary, ghi theo **từng chương**
  và theo **cả tài liệu**; nút ⤢ mở rộng về đúng bố cục 30/70 cổ điển.
  - Chương lấy **tự động từ mục lục nhúng trong PDF**; sách không có mục lục thì tự cắt bằng nút “Cắt chương tại trang này”.
  - Ghi chú tự bám chương đang đọc (nút 🔗), bôi xong bấm **→ Ghi chú** là đoạn đó rơi vào đúng chương kèm liên kết `tr.N ↗` nhảy ngược về trang.
  - **Ôn tập**: che cột Notes, chỉ chừa Cue để tự trả lời rồi bấm mở ra đối chiếu.
  - **Tổng hợp** cuối sách: ghép Cue + Tóm tắt mọi chương (thủ công), hoặc **AI soạn nháp** (chỉ chạy khi bấm nút).
  - Xuất ghi chú ra **.md** hoặc **PDF** riêng; vùng bôi được in kèm khi xuất PDF “Đè trang”.

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
- Bookmark + highlight + ghi chú của mỗi tài liệu nằm chung một khoá `ptr.note.<docId>` trong localStorage,
  nằm trong file **Sao lưu** và bị dọn khi gỡ tài liệu khỏi Thư viện.
  Highlight ở cột bản dịch lưu theo **vị trí ký tự** kèm đoạn chữ gốc để tự neo lại khi bạn sửa bản dịch —
  bản dịch vẫn là văn bản thuần như trước, không nhét thẻ HTML vào.
  Vùng bôi trên trang lưu theo **tỉ lệ bề rộng trang** nên đúng chỗ ở mọi mức zoom.
