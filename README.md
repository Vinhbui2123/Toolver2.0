# Auto File Uploader Extension

Extension Chrome tự động upload file vào button "Choose file".

## Cài đặt

1. Mở Chrome và vào `chrome://extensions/`
2. Bật "Developer mode" ở góc trên bên phải
3. Click "Load unpacked"
4. Chọn thư mục chứa extension này

## Sử dụng

1. Mở trang web có button "Choose file"
2. Click vào icon extension trên thanh toolbar
3. Chọn file muốn upload
4. Click nút "Upload File"
5. Extension sẽ tự động tìm button và upload file

## Lưu ý

- Extension cần icon files (icon16.png, icon48.png, icon128.png) để hiển thị đầy đủ
- Bạn có thể tạo icon đơn giản hoặc tải từ internet
- Extension hoạt động trên tất cả các trang web

## Cấu trúc file

- `manifest.json` - Cấu hình extension
- `popup.html` - Giao diện popup
- `popup.js` - Logic xử lý popup
- `content.js` - Script chạy trên trang web
