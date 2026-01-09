<div align="center">

# 🚀 Auto File Uploader Extension v2.0

### Chrome Extension tự động upload file thông minh

[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

*Tự động hóa việc upload file chỉ với vài click!*

</div>

---

## ✨ Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 🎯 **Auto Upload** | Tự động tìm và upload file vào button "Choose file" |
| 📁 **Multi-format** | Hỗ trợ nhiều định dạng file khác nhau |
| 🔔 **Notification** | Thông báo âm thanh khi hoàn thành |
| 📝 **Note Taking** | Sidebar ghi chú tiện lợi |
| 📊 **Excel Export** | Xuất dữ liệu ra file Excel |

---

## 📦 Cài đặt

### Yêu cầu
- Google Chrome phiên bản 88 trở lên
- Developer mode được bật

### Các bước cài đặt

```bash
# 1. Clone repository
git clone https://github.com/Vinhbui2123/Toolver2.0.git

# 2. Hoặc tải ZIP và giải nén
```

1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật **Developer mode** ở góc trên bên phải
3. Click **Load unpacked**
4. Chọn thư mục chứa extension

<details>
<summary>📸 Xem hướng dẫn bằng hình ảnh</summary>

> *Thêm screenshots hướng dẫn ở đây*

</details>

---

## 🎮 Hướng dẫn sử dụng

### Bước 1: Mở Extension
Click vào icon extension trên thanh toolbar của Chrome

### Bước 2: Chọn File
Chọn file bạn muốn upload từ máy tính

### Bước 3: Upload
Click nút **"Upload File"** - Extension sẽ tự động xử lý!

```
💡 Tip: Extension hoạt động trên tất cả các trang web có input file
```

---

## 📂 Cấu trúc dự án

```
Extensionautover2.0/
├── 📄 manifest.json      # Cấu hình extension
├── 🌐 popup.html         # Giao diện popup chính
├── ⚙️ popup.js           # Logic xử lý popup
├── 📜 content.js         # Script inject vào trang web
├── 🔧 background.js      # Service worker
├── 📑 sidebar.html       # Giao diện sidebar
├── 📝 sidebar.js         # Logic sidebar & ghi chú
├── 🔊 bumbum.mp3         # Âm thanh thông báo
└── 📊 xlsx.full.min.js   # Thư viện xuất Excel
```

---

## ⚠️ Lưu ý

> [!NOTE]
> Extension cần được cấp quyền truy cập trang web để hoạt động

> [!TIP]
> Sử dụng sidebar để ghi chú nhanh trong quá trình làm việc

> [!IMPORTANT]
> Đảm bảo file bạn upload phù hợp với yêu cầu của trang web

---

## 🛠️ Công nghệ sử dụng

- **JavaScript ES6+** - Logic chính
- **Chrome Extension API** - Manifest V3
- **SheetJS** - Xuất file Excel

---

## 📄 License

Dự án được phân phối dưới giấy phép MIT. Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<div align="center">

**Made with ❤️ by [Vinhbui2123](https://github.com/Vinhbui2123)**

⭐ Star repo này nếu bạn thấy hữu ích!

</div>
