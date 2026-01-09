# 🛠️ Quy Trình Xây Dựng Auto-Fill Extension

> Template dựa trên phân tích project `gpt_quandoi`

---

## 📁 Cấu Trúc Thư Mục Chuẩn

```
my-auto-fill-extension/
├── manifest.json          # Cấu hình extension (bắt buộc)
├── background.js          # Service worker
├── content.js             # Script điền form (core logic)
├── sidebar.html           # Giao diện sidebar
├── sidebar.js             # Logic sidebar
├── popup.html             # Popup (optional)
├── popup.js               # Logic popup (optional)
└── libs/                  # Thư viện bên thứ 3
    └── xlsx.full.min.js   # Ví dụ: đọc Excel
```

---

## 1️⃣ MANIFEST.JSON - Cấu Hình Extension

```json
{
  "manifest_version": 3,
  "name": "My Auto Fill Extension",
  "version": "1.0",
  "description": "Auto fill form extension",
  
  "permissions": [
    "activeTab",      // Truy cập tab đang active
    "scripting",      // Inject script vào page
    "sidePanel",      // Sử dụng sidebar
    "tabs",           // Quản lý tabs
    "storage"         // Lưu dữ liệu local
  ],
  
  "side_panel": {
    "default_path": "sidebar.html"
  },
  
  "action": {
    "default_title": "Open Extension"
  },
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],  // Hoặc URL cụ thể
    "js": ["content.js"],
    "run_at": "document_end"
  }],
  
  "host_permissions": ["<all_urls>"]
}
```

---

## 2️⃣ CONTENT.JS - Core Auto-Fill Logic

### 2.1 Các Hàm Utility Cần Có

```javascript
// ⚡ Sleep helper - chờ async
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ⚡ Set giá trị cho React/Vue input
function setNativeValue(el, value) {
  const proto = el instanceof HTMLInputElement 
    ? HTMLInputElement.prototype 
    : HTMLTextAreaElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
}

// ⚡ Fire input event để React/Vue nhận biết
function fireInput(el) {
  el.dispatchEvent(new InputEvent("input", { 
    bubbles: true, 
    inputType: "insertText", 
    data: el.value 
  }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ⚡ Type vào React input (quan trọng!)
async function typeReact(el, value) {
  if (!el) throw new Error("Không thấy input");
  
  el.focus();
  await sleep(80);
  
  // Clear existing value
  el.select?.();
  setNativeValue(el, "");
  fireInput(el);
  await sleep(80);
  
  // Type new value
  try {
    if (document.execCommand) {
      document.execCommand("insertText", false, value);
    } else {
      setNativeValue(el, value);
    }
  } catch {
    setNativeValue(el, value);
  }
  
  fireInput(el);
  await sleep(80);
}

// ⚡ Press Enter key
function pressEnter(el) {
  el.dispatchEvent(new KeyboardEvent("keydown", { 
    key: "Enter", code: "Enter", 
    keyCode: 13, which: 13, bubbles: true 
  }));
  el.dispatchEvent(new KeyboardEvent("keyup", { 
    key: "Enter", code: "Enter", 
    keyCode: 13, which: 13, bubbles: true 
  }));
}
```

### 2.2 Message Listener Pattern

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Action 1: Auto fill form
  if (request.action === 'autoFillForm') {
    autoFillForm(request.formData)
      .then((result) => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // ⚠️ Quan trọng: return true để async response
  }
  
  // Action 2: Check element exists
  if (request.action === 'checkElement') {
    const found = document.querySelector(request.selector) !== null;
    sendResponse({ found });
    return true;
  }
  
  // Action 3: Check text on page
  if (request.action === 'checkTextOnPage') {
    const found = document.body.innerText.includes(request.text);
    sendResponse({ found });
    return true;
  }
  
  // Action 4: Click button by text
  if (request.action === 'clickByText') {
    const buttons = document.querySelectorAll('button');
    let clicked = false;
    for (let btn of buttons) {
      if (btn.textContent.includes(request.text)) {
        btn.click();
        clicked = true;
        break;
      }
    }
    sendResponse({ clicked });
    return true;
  }
});
```

### 2.3 Auto Fill Function Template

```javascript
async function autoFillForm(formData) {
  console.log('=== AUTO FILL START ===');
  
  // Step 1: Tìm và điền input theo ID
  const input1 = document.querySelector('#field-id');
  if (input1) {
    await typeReact(input1, formData.value1);
    console.log('✓ Filled field 1');
  }
  
  // Step 2: Tìm và điền input theo placeholder
  const input2 = document.querySelector('input[placeholder="Enter name"]');
  if (input2) {
    await typeReact(input2, formData.value2);
    console.log('✓ Filled field 2');
  }
  
  // Step 3: Xử lý dropdown/combobox
  const dropdown = document.querySelector('button[role="combobox"]');
  if (dropdown) {
    dropdown.click();
    await sleep(500); // Chờ dropdown mở
    
    // Tìm option và click
    const option = [...document.querySelectorAll('li')]
      .find(li => li.textContent.includes(formData.optionText));
    if (option) option.click();
  }
  
  // Step 4: Click submit button
  const submitBtn = document.querySelector('button[type="submit"]');
  if (submitBtn) {
    await sleep(300);
    submitBtn.click();
  }
  
  console.log('=== AUTO FILL COMPLETE ===');
  return 'Success';
}
```

---

## 3️⃣ SIDEBAR.JS - UI Logic

### 3.1 Helpers

```javascript
// Promise-based chrome.tabs.sendMessage
function sendMessageAsync(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response || {});
      }
    });
  });
}

// Get active tab
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// Wait for condition
async function waitForCondition(checkFn, timeout = 10000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await checkFn();
    if (result) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}
```

### 3.2 Send Action to Content Script

```javascript
document.getElementById('autoBtn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  
  const formData = {
    firstName: document.getElementById('firstNameInput').value,
    lastName: document.getElementById('lastNameInput').value,
    email: document.getElementById('emailInput').value
  };
  
  // Gửi message đến content script
  const response = await sendMessageAsync(tab.id, {
    action: 'autoFillForm',
    formData: formData
  });
  
  if (response.success) {
    showStatus('✅ Thành công!', 'success');
  } else {
    showStatus('❌ Lỗi: ' + response.error, 'error');
  }
});
```

### 3.3 Storage Pattern

```javascript
// Save data
function saveToStorage(key, value) {
  chrome.storage.local.set({ [key]: value });
}

// Load data
function loadFromStorage(key, callback) {
  chrome.storage.local.get([key], (result) => {
    callback(result[key]);
  });
}

// Auto-save on input change
document.getElementById('emailInput').addEventListener('change', () => {
  saveToStorage('email', document.getElementById('emailInput').value);
});

// Load on sidebar open
loadFromStorage('email', (value) => {
  if (value) document.getElementById('emailInput').value = value;
});
```

---

## 4️⃣ QUY TRÌNH PHÁT TRIỂN

### Bước 1: Phân Tích Target Website

```markdown
1. Mở DevTools (F12) trên website cần auto-fill
2. Xác định các input elements:
   - ID: `#input-id`
   - Class: `.input-class`
   - Placeholder: `input[placeholder="..."]`
   - Role: `button[role="combobox"]`
3. Xác định flow:
   - Thứ tự điền form
   - Các button cần click
   - Các popup/modal
```

### Bước 2: Tạo Selector Map

```javascript
// Lưu tất cả selectors vào object
const SELECTORS = {
  firstName: '#sid-first-name',
  lastName: '#sid-last-name',
  email: 'input[type="email"]',
  submitBtn: 'button[type="submit"]',
  dropdown: 'button[role="combobox"]'
};
```

### Bước 3: Build & Test

```markdown
1. Vào chrome://extensions/
2. Bật "Developer mode"
3. Click "Load unpacked"
4. Chọn thư mục extension
5. Test trên website target
6. Xem Console để debug
```

---

## 5️⃣ BEST PRACTICES

### ⚡ Performance

```javascript
// ❌ Sai: Wait cứng
await sleep(5000);

// ✅ Đúng: Wait thông minh
await waitForCondition(() => {
  return document.querySelector('#element') !== null;
}, 5000, 200);
```

### 🔒 Error Handling

```javascript
try {
  await autoFillForm(data);
} catch (error) {
  console.error('Auto fill failed:', error);
  showStatus('❌ ' + error.message, 'error');
}
```

### 📦 Data Validation

```javascript
function validateFormData(data) {
  if (!data.email || !data.email.includes('@')) {
    throw new Error('Email không hợp lệ');
  }
  if (!data.firstName || data.firstName.length < 2) {
    throw new Error('First name quá ngắn');
  }
  return true;
}
```

---

## 6️⃣ CHECKLIST TRƯỚC KHI DEPLOY

- [ ] Manifest version 3
- [ ] Permissions tối thiểu cần thiết
- [ ] Error handling đầy đủ
- [ ] Console.log để debug
- [ ] Storage để lưu settings
- [ ] UI responsive
- [ ] Test trên nhiều trường hợp

---

## 📚 Tài Liệu Tham Khảo

| Resource | Link |
|----------|------|
| Chrome Extension Docs | [developer.chrome.com](https://developer.chrome.com/docs/extensions/) |
| Manifest V3 | [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/) |
| Content Scripts | [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/) |
