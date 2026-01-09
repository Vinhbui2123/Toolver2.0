let selectedFile = null;
let lastVerificationUrl = null;

// ========================================
// ⚡ KEEP-ALIVE CONNECTION - Prevents Service Worker unload
// ========================================
let backgroundPort = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectToBackground() {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'sidebar' });
    reconnectAttempts = 0;

    console.log('[Sidebar] Connected to background');

    backgroundPort.onDisconnect.addListener(() => {
      console.log('[Sidebar] Disconnected from background');
      backgroundPort = null;

      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`[Sidebar] Reconnecting... (attempt ${reconnectAttempts})`);
        setTimeout(connectToBackground, 1000);
      }
    });

    // Ping every 20 seconds to keep connection alive
    setInterval(() => {
      if (backgroundPort) {
        try {
          backgroundPort.postMessage({ type: 'ping' });
        } catch (e) {
          console.log('[Sidebar] Ping failed, reconnecting...');
          connectToBackground();
        }
      }
    }, 20000);

  } catch (error) {
    console.error('[Sidebar] Connection error:', error);
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(connectToBackground, 1000);
    }
  }
}

// Initialize connection on load
connectToBackground();

// ========================================

// Promise-based sleep - thay thế setTimeout callback
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Wrap chrome.tabs.sendMessage thành Promise
function sendMessageAsync(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Message error:', chrome.runtime.lastError.message);
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response || {});
      }
    });
  });
}

// Polling helper - chờ condition thay vì chờ cứng
async function waitForCondition(checkFn, timeout = 10000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await checkFn();
    if (result) return result;
    await sleep(interval);
  }
  return null;
}

// Get current active tab
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// ========================================

// ⚡ OPTIMIZED VERIFICATION FLOW - Replaces callback hell
// Timing: Reduced from 21s+ to ~10s with smart polling
async function handleVerificationFlow(email) {
  console.log('=== Starting Optimized Verification Flow ===');

  // Helper functions
  const switchToDataTab = () => {
    const dataTabBtn = document.querySelector('[data-tab="data"]');
    if (dataTabBtn) dataTabBtn.click();
  };

  const clearDataInputs = () => {
    dataInput.value = '';
    birthdateInput.value = '';
    dischargeDateInput.value = '';
    branchOfServiceInput.value = '';
  };

  const retryAutoFlow = async () => {
    switchToDataTab();
    clearDataInputs();
    await sleep(300); // Reduced from 500ms
    loadExcelBtn.click();
    await sleep(3000); // Reduced from 5000ms
    autoBtn.click();
  };

  // ⚡ OPTIMIZED: Wait 1s (reduced from 2s) then check VerificationLimitExceeded
  await sleep(1000);
  console.log('Checking for "VerificationLimitExceeded" message...');

  const tab = await getActiveTab();
  if (!tab) return;

  const limitResponse = await sendMessageAsync(tab.id, { action: 'VerificationLimitExceeded' });

  if (limitResponse.found) {
    console.log('✓ Found "Verification Limit Exceeded" - stopping');
    showMessage('❌ Verification Limit Exceeded - stopping', 'error');
    await retryAutoFlow();
    return;
  }


  // Chờ 3s để trang hiển thị message
  await sleep(3000);
  console.log('Checking for "Check your email" message...');

  const emailResponse = await sendMessageAsync(tab.id, { action: 'checkForEmailMessage' });

  if (!emailResponse.found) {
    console.log('⚠ "Check your email" message not found');
    return;
  }

  console.log('✓ Found "Check your email" message, switching to Mail tab');
  const mailTabBtn = document.querySelector('[data-tab="mail"]');
  if (!mailTabBtn) return;

  mailTabBtn.click();
  await sleep(1000); // Chờ tab mail load

  console.log('Clicking fetchMailBtn...');
  fetchMailBtn.click();

  await sleep(5000); // Increased to 5s for mail to fully load

  if (!lastVerificationUrl) {
    console.log('No verification URL to open');
    return;
  }

  console.log('Opening verification URL:', lastVerificationUrl);
  const currentTab = await getActiveTab();
  if (currentTab) {
    chrome.tabs.update(currentTab.id, { url: lastVerificationUrl });
  }
  showStatus('✅ Đã mở Verification Link!', 'success');

  // ⚡ OPTIMIZED: Wait 8s (reduced from 12s) then check verification
  await sleep(8000);
  console.log('Checking for "you\'ve been verified" message...');

  const verifyTab = await getActiveTab();
  if (!verifyTab) return;

  const tryAgainResponse = await sendMessageAsync(verifyTab.id, { action: 'checkTryAgain' });

  if (tryAgainResponse.found) {
    console.log('✓ Found "you\'ve been verified" - verification successful!');

    // Stop old audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

    showMessage('✅ Verification successful!', 'success2');
  } else {
    console.log('⚠ "you\'ve been verified" not found, auto clicking autoBtn to retry...');
    showMessage('🔄 Verification not found, đang retry...', 'info');
    await retryAutoFlow();
  }

  console.log('=== Verification Flow Complete ===');
}

// Show progress bar
function showProgress(show, percent = 0) {
  let container = document.querySelector('.progress-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'progress-container';
    container.innerHTML = '<div class="progress-bar"></div>';
    const autoBtn = document.getElementById('autoBtn');
    if (autoBtn && autoBtn.parentNode) {
      autoBtn.parentNode.insertBefore(container, autoBtn.nextSibling);
    }
  }
  const bar = container.querySelector('.progress-bar');
  if (show) {
    container.classList.add('show');
    bar.style.width = percent + '%';
  } else {
    container.classList.remove('show');
    bar.style.width = '0%';
  }
}

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfoInline = document.getElementById('fileInfoInline');
const fileNameInline = document.getElementById('fileNameInline');
const fileSizeInline = document.getElementById('fileSizeInline');
const uploadBtn = document.getElementById('uploadBtn');
const autoBtn = document.getElementById('autoBtn');
const stopBtn = document.getElementById('stopBtn');
const clearFileBtn = document.getElementById('clearFileBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
const statusDiv = document.getElementById('status');
const dataInput = document.getElementById('dataInput');
const emailInput = document.getElementById('emailInput');
const birthdateInput = document.getElementById('birthdateInput');
const dischargeDateInput = document.getElementById('dischargeDateInput');
const branchOfServiceInput = document.getElementById('branchOfServiceInput');
const militaryStatusSelect = document.getElementById('militaryStatusSelect');
const excelInput = document.getElementById('excelInput');
const rowNumber = document.getElementById('rowNumber');
const loadExcelBtn = document.getElementById('loadExcelBtn');
const generateDataBtn = document.getElementById('generateDataBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const noteInput = document.getElementById('noteInput');
const randomEmailBtn = document.getElementById('randomEmailBtn');
const mailDomain = document.getElementById('mailDomain');
const fetchMailBtn = document.getElementById('fetchMailBtn');
const mailStatus = document.getElementById('mailStatus');
const mailList = document.getElementById('mailList');
const clearMailBtn = document.getElementById('clearMailBtn');
const openMailUrlBtn = document.getElementById('openMailUrlBtn');
const emailSettingsBtn = document.getElementById('emailSettingsBtn');
const emailSettingsPanel = document.getElementById('emailSettingsPanel');
const emailDomainSetting = document.getElementById('emailDomainSetting');
const emailPrefixSetting = document.getElementById('emailPrefixSetting');
const saveEmailSettingsBtn = document.getElementById('saveEmailSettingsBtn');
const rowHistoryInput = document.getElementById('rowHistoryInput');
const clearRowHistoryBtn = document.getElementById('clearRowHistoryBtn');

// Global flag to stop auto
let isAutoRunning = false;
let shouldStopAuto = false;
let currentAudio = null; // Lưu audio object để dừng khi cần

// Tab functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;

    // Remove active class from all buttons and contents
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Add active class to clicked button and corresponding content
    btn.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
  });
});

// Load note from storage
function loadNote() {
  chrome.storage.local.get(['note'], (result) => {
    if (result.note) {
      noteInput.value = result.note;
    }
  });
}

// Load military status from storage
function loadMilitaryStatus() {
  chrome.storage.local.get(['militaryStatus'], (result) => {
    if (result.militaryStatus) {
      militaryStatusSelect.value = result.militaryStatus;
      console.log('Military status loaded from storage:', result.militaryStatus);
    }
  });
}

// Load Excel file from storage when sidebar opens
function loadStoredData() {
  loadNote();
  loadMilitaryStatus();
  loadExcelFileFromStorage();
  loadRowHistory();
  loadRowNumber();
}

// Load row number from storage
function loadRowNumber() {
  chrome.storage.local.get(['rowNumber'], (result) => {
    if (result.rowNumber) {
      rowNumber.value = result.rowNumber;
      console.log('Row number loaded from storage:', result.rowNumber);
    }
  });
}

// Load row history from storage
function loadRowHistory() {
  chrome.storage.local.get(['rowHistory'], (result) => {
    if (result.rowHistory) {
      rowHistoryInput.value = result.rowHistory;
      console.log('Row history loaded from storage');
    }
  });
}

// Clear row history button
clearRowHistoryBtn.addEventListener('click', () => {
  rowHistoryInput.value = '';
  chrome.storage.local.set({ rowHistory: '' }, () => {
    console.log('Row history cleared');
    showStatus('✅ Row history cleared!', 'success');
  });
});

// Auto-save note on change - keep only 20 most recent lines
noteInput.addEventListener('input', () => {
  const lines = noteInput.value.split('\n').filter(line => line.trim() !== '');
  // Keep only the last 20 lines
  const limitedLines = lines.slice(-20);
  const limitedNote = limitedLines.join('\n');

  // Update textarea if lines were trimmed
  if (lines.length > 20) {
    noteInput.value = limitedNote;
  }

  chrome.storage.local.set({ note: limitedNote });
});

// Auto-save military status on change
militaryStatusSelect.addEventListener('change', () => {
  const militaryStatus = militaryStatusSelect.value;
  chrome.storage.local.set({ militaryStatus: militaryStatus }, () => {
    console.log('Military status saved to storage:', militaryStatus);
  });
});

// Load stored data when sidebar opens
loadStoredData();

// Sync email input với dòng email trong textarea
emailInput.addEventListener('change', () => {
  updateEmailInDataInput();

  // Điền email vào mailDomain nhưng không chuyển tab
  if (emailInput.value.includes('@')) {
    mailDomain.value = emailInput.value;
  }
});

emailInput.addEventListener('input', () => {
  updateEmailInDataInput();
});

// Sync birthdate input với dòng birthdate trong textarea
birthdateInput.addEventListener('change', () => {
  updateBirthdateInDataInput();
});

birthdateInput.addEventListener('input', () => {
  updateBirthdateInDataInput();
});

// Sync discharge date input với dòng discharge date trong textarea
dischargeDateInput.addEventListener('change', () => {
  updateDischargeDateInDataInput();
});

dischargeDateInput.addEventListener('input', () => {
  updateDischargeDateInDataInput();
});

// Sync branch of service input với dòng branch of service trong textarea
branchOfServiceInput.addEventListener('change', () => {
  updateBranchOfServiceInDataInput();
});

branchOfServiceInput.addEventListener('input', () => {
  updateBranchOfServiceInDataInput();
});

function updateEmailInDataInput() {
  const lines = dataInput.value.split('\n');
  const newEmail = emailInput.value.trim();

  // Đảm bảo có ít nhất 5 dòng
  while (lines.length < 5) {
    lines.push('');
  }

  // Cập nhật dòng email (dòng thứ 5, index 4)
  lines[4] = newEmail;

  // Cập nhật textarea
  dataInput.value = lines.join('\n');
}

function updateBirthdateInDataInput() {
  const lines = dataInput.value.split('\n');
  const newBirthdate = birthdateInput.value.trim();

  // Đảm bảo có ít nhất 3 dòng
  while (lines.length < 3) {
    lines.push('');
  }

  // Cập nhật dòng birthdate (dòng thứ 3, index 2)
  lines[2] = newBirthdate;

  // Cập nhật textarea
  dataInput.value = lines.join('\n');
}

function updateDischargeDateInDataInput() {
  const lines = dataInput.value.split('\n');
  const newDischargeDate = dischargeDateInput.value.trim();

  // Đảm bảo có ít nhất 4 dòng
  while (lines.length < 4) {
    lines.push('');
  }

  // Cập nhật dòng discharge date (dòng thứ 4, index 3)
  lines[3] = newDischargeDate;

  // Cập nhật textarea
  dataInput.value = lines.join('\n');
}

function updateBranchOfServiceInDataInput() {
  const lines = dataInput.value.split('\n');
  const newBranchOfService = branchOfServiceInput.value.trim();

  // Đảm bảo có ít nhất 6 dòng
  while (lines.length < 6) {
    lines.push('');
  }

  // Cập nhật dòng branch of service (dòng thứ 6, index 5)
  lines[5] = newBranchOfService;

  // Cập nhật textarea
  dataInput.value = lines.join('\n');
}

// Sync textarea với input email
dataInput.addEventListener('change', () => {
  updateEmailFromDataInput();
});

dataInput.addEventListener('input', () => {
  updateEmailFromDataInput();
});

function updateEmailFromDataInput() {
  const lines = dataInput.value.split('\n');

  // Cập nhật email input (dòng 5, index 4)
  if (lines.length > 4) {
    emailInput.value = lines[4].trim();
  }
}

// Click vào drop zone để chọn file
dropZone.addEventListener('click', () => {
  fileInput.click();
});

// Chọn file từ input
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
});

// Paste file (Ctrl+V)
document.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === 'file') {
      const file = items[i].getAsFile();
      if (file) {
        handleFile(file);
        e.preventDefault();
        break;
      }
    }
  }
});

// Xử lý file được chọn
function handleFile(file) {
  // Kiểm tra nếu là file Excel
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
    // Nếu là file Excel, lưu vào excelInput
    console.log('Excel file detected:', file.name);

    // Tạo DataTransfer để set file vào excelInput
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    excelInput.files = dataTransfer.files;

    // Lưu file vào Chrome storage
    saveExcelFileToStorage(file);

    // Hiển thị thông tin file trong drop zone
    fileNameInline.textContent = file.name;
    fileSizeInline.textContent = formatFileSize(file.size);
    fileInfoInline.style.display = 'block';

    // Thay đổi style drop zone
    dropZone.classList.add('has-file');

    // Show clear button
    clearFileBtn.classList.add('show');
    resetDataBtn.classList.add('show');

    showStatus('✅ File Excel đã sẵn sàng! Click "Lấy dữ liệu từ Excel"', 'success');

    // Tự động lấy dữ liệu sau 1 giây
    setTimeout(() => {
      loadExcelBtn.click();
    }, 1000);

  } else {
    // Nếu là file khác (Canva), lưu vào selectedFile
    selectedFile = file;

    // Hiển thị thông tin file trong drop zone
    fileNameInline.textContent = file.name;
    fileSizeInline.textContent = formatFileSize(file.size);
    fileInfoInline.style.display = 'block';

    // Thay đổi style drop zone
    dropZone.classList.add('has-file');

    // Show clear button
    clearFileBtn.classList.add('show');
    resetDataBtn.classList.add('show');

    showStatus('✅ File đã sẵn sàng!', 'success');
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Helper function to reset auto button state
function resetAutoButtonState() {
  isAutoRunning = false;
  shouldStopAuto = false;
  autoBtn.disabled = false;
  autoBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  stopBtn.disabled = true;
  autoBtn.textContent = '🤖 Auto';
}

// Stop button
stopBtn.addEventListener('click', () => {
  shouldStopAuto = true;

  // Dừng audio nếu đang phát
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  resetAutoButtonState();
});

// Auto button - Tìm dropdown và chọn "Reservist or National Guard"
autoBtn.addEventListener('click', async () => {
  try {
    isAutoRunning = true;
    shouldStopAuto = false;
    autoBtn.disabled = true;
    autoBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    stopBtn.disabled = false;
    autoBtn.textContent = '⏳ Đang auto...';

    // Dừng audio cũ trước khi phát success2
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

    // showMessage('✅ Verification successful!', 'success2');
    // // showMessage('✅ Verification successful!', 'success2');
    // return;

    // Lấy dữ liệu từ textarea
    const dataText = dataInput.value.trim();
    const dataLines = dataText.split('\n').map(line => line.trim());

    // Helper function: Convert date format (Sep-01-2000 -> 9/1/2000) - giữ nguyên năm
    const convertDateFormatKeepYear = (dateStr) => {
      if (!dateStr) return '1/1/1990';

      dateStr = dateStr.trim();

      // Already in M/D/YYYY or MM/DD/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        return dateStr;
      }

      // Handle format: Sep-01-2000 or Apr-14-2015
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dashMatch = dateStr.match(/^([A-Za-z]+)-(\d{1,2})-(\d{4})$/);
      if (dashMatch) {
        const monthStr = dashMatch[1];
        const day = dashMatch[2];
        const year = dashMatch[3]; // Giữ nguyên năm
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
        if (monthIndex !== -1) {
          return `${monthIndex + 1}/${day}/${year}`;
        }
      }

      return dateStr;
    };

    // Helper function: Convert date format (Sep-01-2000 -> 9/1/2025) - thay năm thành 2025
    const convertDateFormatTo2025 = (dateStr) => {
      if (!dateStr) return '1/1/2025';

      dateStr = dateStr.trim();

      // Already in M/D/YYYY or MM/DD/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        return `${parts[0]}/${parts[1]}/2025`; // Thay năm thành 2025
      }

      // Handle format: Sep-01-2000 or Apr-14-2015
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dashMatch = dateStr.match(/^([A-Za-z]+)-(\d{1,2})-(\d{4})$/);
      if (dashMatch) {
        const monthStr = dashMatch[1];
        const day = dashMatch[2];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
        if (monthIndex !== -1) {
          return `${monthIndex + 1}/${day}/2025`; // Thay năm thành 2025
        }
      }

      return dateStr;
    };

    // Helper function: Chuyển số tháng sang tên tiếng Anh
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const parseDate = (dateStr, convertFunc) => {
      // Convert format nếu cần
      dateStr = convertFunc(dateStr);

      // Format: M/D/YYYY hoặc MM/DD/YYYY
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0]);
        const day = parts[1];
        const year = parts[2];
        return {
          month: monthNames[month - 1] || 'January',
          day: day,
          year: year
        };
      }
      return { month: 'January', day: '1', year: '1990' };
    };

    // Parse birthdate - giữ nguyên năm
    const birthdate = parseDate(dataLines[2] || '1/15/1990', convertDateFormatKeepYear);

    // Parse discharge date - thay năm thành 2025
    const dischargeDate = parseDate(dataLines[3] || '12/20/2020', convertDateFormatTo2025);

    // Parse dữ liệu
    let email = dataLines[4] || emailInput.value.trim() || '';
    const birthdateStr = dataLines[2] || '';
    const dischargeDateStr = dataLines[3] || '';

    // Nếu không có email, click nút random email
    // if (!email) {
    randomEmailBtn.click();
    // Đợi một chút để email được tạo
    await new Promise(resolve => setTimeout(resolve, 100));
    // Lấy email mới từ input
    email = emailInput.value.trim();
    console.log('Auto-generated email:', email);
    fetchMailBtn.click();
    // }

    // Kiểm tra Birthdate
    if (birthdateStr.toLowerCase().includes('not available')) {
      resetAutoButtonState();
      showStatus('❌ Birthdate không có sẵn (Not Available)!', 'error');
      return;
    }

    // Kiểm tra Discharge Date
    if (dischargeDateStr.toLowerCase().includes('not available')) {
      resetAutoButtonState();
      showStatus('❌ Discharge Date không có sẵn (Not Available)!', 'error');
      return;
    }

    // Kiểm tra URL hiện tại
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let currentTab = tabs[0];
    let currentUrl = currentTab?.url || '';
    const targetUrl = 'https://chatgpt.com/veterans-claim';

    if (!currentUrl.includes('veterans-claim')) {
      // Nếu không phải trang đúng, chuyển đến trang đó và chờ
      showMessage('🔄 Đang chuyển đến trang verify...', 'info');
      await new Promise((resolve) => {
        chrome.tabs.update(currentTab.id, { url: targetUrl }, () => {
          // Chờ trang load xong
          setTimeout(resolve, 6000);
        });
      });

      // Lấy lại tab sau khi navigate
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];
      showMessage('✅ Đã chuyển trang, tiếp tục...', 'info');
    }

    // ⚡ OPTIMIZED: Chờ 1.5 giây (giảm từ 3s)
    showMessage('🔄 Đang chờ trang load...', 'info');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Kiểm tra và click nút "Verify eligibility" nếu có
    const verifyResponse = await new Promise((resolve) => {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'clickVerifyEligibility'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Error:', chrome.runtime.lastError.message);
          resolve({ clicked: false });
        } else {
          resolve(response || { clicked: false });
        }
      });
    });

    if (verifyResponse && verifyResponse.clicked) {
      console.log('Clicked Verify eligibility button, waiting for form to load...');
      showMessage('🔄 Đã click Verify eligibility, chờ form load...', 'info');
      // ⚡ OPTIMIZED: Giảm từ 7s xuống 4s
      await new Promise(resolve => setTimeout(resolve, 4000));
      showMessage('✅ Đã chờ xong, tiếp tục auto...', 'success');
    }
    showMessage('🔄 Đang chờ form load...', 'success');
    // ⚡ OPTIMIZED: Giảm từ 7s xuống 4s
    await new Promise(resolve => setTimeout(resolve, 4000));
    showMessage('✅ Đã chờ xong, tiếp tục auto...', 'success');

    const formData = {
      firstName: dataLines[0] || 'John',
      lastName: dataLines[1] || 'Doe',
      birthMonth: birthdate.month,
      birthDay: birthdate.day,
      birthYear: birthdate.year,
      dischargeMonth: dischargeDate.month,
      dischargeDay: dischargeDate.day,
      email: email,
      militaryStatus: militaryStatusSelect.value || 'Reservist or National Guard',
      branchOfService: (dataLines[5] || 'Army Reserve').split(',')[0].trim() // Lấy phần đầu trước dấu phẩy và trim
    };

    console.log('Form Data:', formData);

    // Check if stop was clicked
    if (shouldStopAuto) {
      resetAutoButtonState();
      showStatus('⏹️ Auto đã bị dừng', 'warning');
      return;
    }

    // Lấy tab hiện tại
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // ✅ FIXED: Convert callback to Promise-based for proper async/await support
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'autoSelectMilitaryStatus',
        formData: formData
      }, (resp) => {
        if (chrome.runtime.lastError) {
          console.log('sendMessage error:', chrome.runtime.lastError.message);
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || {});
        }
      });
    });

    // Check if stop was clicked
    if (shouldStopAuto) {
      resetAutoButtonState();
      showStatus('⏹️ Auto đã bị dừng', 'warning');
      return;
    }

    resetAutoButtonState();

    if (response.error) {
      showStatus('Lỗi: ' + response.error, 'error');
      return;
    }

    if (response && response.success) {
      showStatus('✅ ' + response.message, 'success');

      // Clear email display after auto-fill
      mailList.innerHTML = '';

      // Tự động +1 số dòng sau khi hoàn thành
      const currentRow = parseInt(rowNumber.value) || 2;
      rowNumber.value = currentRow + 1;
      console.log('Row number incremented to:', currentRow + 1);

      // Lưu row number vào storage
      chrome.storage.local.set({ rowNumber: currentRow + 1 });


      // Lưu số dòng hiện tại vào Row History
      const timestamp = new Date().toLocaleString('vi-VN');
      const historyEntry = `[${timestamp}] Row: ${currentRow + 1} |  ${email}`;
      const currentHistory = rowHistoryInput.value;
      const newHistory = historyEntry + (currentHistory ? '\n' + currentHistory : '');
      rowHistoryInput.value = newHistory;

      // Auto-save history to storage
      chrome.storage.local.set({ rowHistory: newHistory });

      // ⚡ OPTIMIZED: Use async handleVerificationFlow instead of callback hell
      // This reduced ~150 lines of nested callbacks to a single async function call
      // Timing improved: 21s+ -> ~10s with smart polling
      // ✅ FIXED: Added try/catch to prevent uncaught promise rejection
      try {
        await handleVerificationFlow(email);
      } catch (verifyError) {
        console.error('Verification flow error:', verifyError);
        showMessage('⚠️ Lỗi verification: ' + verifyError.message, 'error');
      }
    }

  } catch (error) {
    resetAutoButtonState();
    showStatus('Lỗi: ' + error.message, 'error');
  }
});

// Clear file button (X trong drop zone)
clearFileBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Ngăn trigger click vào drop zone
  clearFile();
});

// Reset data button (🔄 trong drop zone)
resetDataBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Ngăn trigger click vào drop zone
  resetData();
});

// Next button - Tăng số dòng và load dữ liệu
nextBtn.addEventListener('click', () => {
  const currentRow = parseInt(rowNumber.value) || 2;
  rowNumber.value = currentRow + 1;

  // Lưu row number vào storage
  chrome.storage.local.set({ rowNumber: currentRow + 1 });

  // Tự động load dữ liệu từ dòng mới
  setTimeout(() => {
    loadExcelBtn.click();
  }, 300);
});

// Prev button - Giảm số dòng và load dữ liệu
prevBtn.addEventListener('click', () => {
  const currentRow = parseInt(rowNumber.value) || 2;
  if (currentRow > 1) {
    rowNumber.value = currentRow - 1;

    // Lưu row number vào storage
    chrome.storage.local.set({ rowNumber: currentRow - 1 });

    // Tự động load dữ liệu từ dòng mới
    setTimeout(() => {
      loadExcelBtn.click();
    }, 300);
  }
});

// Excel file input - Tự động lấy dữ liệu khi chọn file
excelInput.addEventListener('change', () => {
  if (excelInput.files && excelInput.files[0]) {
    // Reset số dòng về 2
    rowNumber.value = 2;

    // Tự động gọi hàm lấy dữ liệu
    setTimeout(() => {
      loadExcelBtn.click();
    }, 300);
  }
});

// Row number input - Tự động load dữ liệu khi thay đổi số dòng
rowNumber.addEventListener('change', () => {
  const row = parseInt(rowNumber.value);
  if (row && row >= 1) {
    // Lưu row number vào storage
    chrome.storage.local.set({ rowNumber: row }, () => {
      console.log('Row number saved to storage:', row);
    });

    setTimeout(() => {
      loadExcelBtn.click();
    }, 300);
  }
});

// Sound effects
function playSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {

      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      // Happy sound - 2 tones ascending (old sound)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);


    } else if (type === 'success2') {
      // Success2 sound - Play bumbum.mp3 file (max 20 seconds)
      try {
        // Dừng audio cũ nếu có
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }

        const audio = new Audio('bumbum.mp3');
        audio.volume = 0.5;
        currentAudio = audio; // Lưu audio object

        // // Tự động dừng sau 20 giây
        // setTimeout(() => {
        //   if (currentAudio === audio) {
        //     audio.pause();
        //     currentAudio = null;
        //   }
        // }, 20000);

        audio.play().catch(err => console.log('Could not play bumbum.mp3:', err));
      } catch (e) {
        console.log('Error playing audio file:', e);
      }
    } else if (type === 'error') {
      // Error sound - low buzz
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.type = 'sawtooth';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } else if (type === 'info') {
      // Info sound - single tone
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    }
  } catch (e) {
    // Ignore audio errors
  }
}

// Show message (giống Random and Fill)
// Sử dụng: showMessage('Thành công!', 'success')
// Types: 'success', 'error', 'info', 'warning'
function showMessage(text, type = 'success') {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) return;

  messageDiv.textContent = text;
  messageDiv.className = type.replace("2", "") + ' show';

  // Play sound effect
  playSound(type);

  setTimeout(() => {
    messageDiv.classList.remove('show');
  }, 3000);
}

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = type + ' show';

  // Play sound effect
  playSound(type);

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 5000);
}

// Clear file
function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  fileInfoInline.style.display = 'none';
  dropZone.classList.remove('has-file');
  clearFileBtn.classList.remove('show');
  resetDataBtn.classList.remove('show');
  statusDiv.classList.remove('show');

  // Clear Excel file and military status from storage
  chrome.storage.local.remove(['excelFile', 'militaryStatus'], () => {
    console.log('Excel file and military status removed from storage');
  });

  // Clear excelInput
  excelInput.value = '';

  // Reset military status select
  militaryStatusSelect.value = '';

  showStatus('✅ Đã xóa file!', 'success');
}

// Reset data - Xóa tất cả dữ liệu trong các input và textarea
function resetData() {
  // Reset rowNumber về 2
  rowNumber.value = 2;

  // Tự động load dữ liệu từ Excel dòng 2
  setTimeout(() => {
    loadExcelBtn.click();
  }, 300);
}

// Load Excel button - Đọc file Excel và lấy dữ liệu từ dòng được chọn
loadExcelBtn.addEventListener('click', async () => {
  let file = excelInput.files[0];

  // Nếu chưa chọn file, mở file picker
  if (!file) {
    console.log('No file selected, opening file picker');
    excelInput.click();
    return;
  }

  const row = parseInt(rowNumber.value);

  if (!row || row < 1) {
    showStatus('Vui lòng nhập số dòng hợp lệ (>= 1)!', 'error');
    return;
  }

  console.log('Loading Excel file:', file.name, 'Row:', row);

  try {
    loadExcelBtn.disabled = true;
    loadExcelBtn.textContent = '⏳ Đang đọc...';

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);

        // XLSX library đã được load từ sidebar.html
        if (typeof XLSX === 'undefined') {
          showStatus('Lỗi: Thư viện Excel chưa sẵn sàng. Vui lòng reload trang.', 'error');
          loadExcelBtn.disabled = false;
          loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
          return;
        }

        parseExcelData(data, row);

      } catch (error) {
        console.error('Error reading file:', error);
        showStatus('Lỗi khi đọc file: ' + error.message, 'error');
        loadExcelBtn.disabled = false;
        loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
      }
    };

    reader.onerror = () => {
      console.error('FileReader error');
      showStatus('Lỗi khi đọc file', 'error');
      loadExcelBtn.disabled = false;
      loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
    };

    reader.readAsArrayBuffer(file);

  } catch (error) {
    console.error('Error:', error);
    showStatus('Lỗi: ' + error.message, 'error');
    loadExcelBtn.disabled = false;
    loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
  }
});

// Parse Excel data
function parseExcelData(data, rowIndex) {
  try {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[sheetName];

    if (!firstSheet) {
      showStatus('Không tìm thấy sheet trong file Excel', 'error');
      loadExcelBtn.disabled = false;
      loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log('Sheet name:', sheetName);
    console.log('Total rows:', jsonData.length);
    console.log('Row data:', jsonData);

    // Get row data (rowIndex is 1-based, array is 0-based)
    const rowData = jsonData[rowIndex - 1];

    if (!rowData || rowData.length === 0) {
      showStatus('Không tìm thấy dữ liệu ở dòng ' + rowIndex + '. Tổng dòng: ' + jsonData.length, 'error');
      loadExcelBtn.disabled = false;
      loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
      return;
    }

    console.log('Selected row:', rowData);

    let formattedData = '';

    // Check if birthdate is in date format or separate columns
    if (rowData.length >= 5) {
      // Format 1: FirstName, LastName, Birthdate, DischargeDate, Email
      const firstName = (rowData[0] || '').toString().trim();
      const lastName = (rowData[1] || '').toString().trim();
      const birthdate = formatExcelDate(rowData[2]);
      const dischargeDate2025 = formatDischargeDateTo2025(rowData[3]);
      const email = (rowData[4] || '').toString().trim();
      const branchOfServiceInput = (rowData[5] || '').toString().trim();

      formattedData = `${firstName}\n${lastName}\n${birthdate}\n${dischargeDate2025}\n${email}\n${branchOfServiceInput}`;

      console.log('Formatted data:', formattedData);
    } else {
      showStatus('Dữ liệu không đủ 6 cột. Tìm thấy: ' + rowData.length + ' cột', 'error');
      loadExcelBtn.disabled = false;
      loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
      return;
    }

    // Fill textarea
    dataInput.value = formattedData;

    // Fill email input if available
    if (rowData.length >= 5) {
      const email = (rowData[4] || '').toString().trim();
      if (email) {
        emailInput.value = email;
      }
    }

    // Fill birthdate input if available
    if (rowData.length >= 3) {
      const birthdate = formatExcelDate(rowData[2]);
      if (birthdate) {
        birthdateInput.value = birthdate;
      }
    }

    // Fill discharge date input if available
    if (rowData.length >= 4) {
      const dischargeDate2025 = formatDischargeDateTo2025(rowData[3]);
      if (dischargeDate2025) {
        dischargeDateInput.value = dischargeDate2025;
      }
    }

    // Fill branch of service input if available
    if (rowData.length >= 6) {
      const branchOfService = (rowData[5] || '').toString().trim();
      if (branchOfService) {
        branchOfServiceInput.value = branchOfService;
      }
    }

    showStatus('✅ Đã lấy dữ liệu từ dòng ' + rowIndex, 'success');
    loadExcelBtn.disabled = false;
    loadExcelBtn.textContent = '📥 Lấy dữ liệu ';

  } catch (error) {
    console.error('Parse Excel error:', error);
    showStatus('Lỗi khi parse Excel: ' + error.message, 'error');
    loadExcelBtn.disabled = false;
    loadExcelBtn.textContent = '📥 Lấy dữ liệu ';
  }
}

// Format Excel date to M/D/YYYY
function formatExcelDate(excelDate) {
  if (!excelDate) return '1/1/1990';

  // If already a string in format M/D/YYYY or MM/DD/YYYY
  if (typeof excelDate === 'string') {
    return excelDate.trim();
  }

  // If Excel serial date number
  if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    return `${date.m}/${date.d}/${date.y}`;
  }

  // If Date object
  if (excelDate instanceof Date) {
    const month = excelDate.getMonth() + 1;
    const day = excelDate.getDate();
    const year = excelDate.getFullYear();
    return `${month}/${day}/${year}`;
  }

  return '1/1/1990';
}

// Format discharge date to M/D/2025
function formatDischargeDateTo2025(excelDate) {
  if (!excelDate) return '1/1/2025';

  // If already a string in format M/D/YYYY or MM/DD/YYYY
  if (typeof excelDate === 'string') {
    let dateStr = excelDate.trim();

    // Handle format: Sep-01-2000 or Apr-14-2015
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dashMatch = dateStr.match(/^([A-Za-z]+)-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
      const monthStr = dashMatch[1];
      const day = dashMatch[2];
      const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      if (monthIndex !== -1) {
        return `${monthIndex + 1}/${day}/2025`;
      }
    }

    // Extract month and day from M/D/YYYY format
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/);
    if (slashMatch) {
      return `${slashMatch[1]}/${slashMatch[2]}/2025`;
    }

    return dateStr;
  }

  // If Excel serial date number
  if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    return `${date.m}/${date.d}/2025`;
  }

  // If Date object
  if (excelDate instanceof Date) {
    const month = excelDate.getMonth() + 1;
    const day = excelDate.getDate();
    return `${month}/${day}/2025`;
  }

  return '1/1/2025';
}

// Save Excel file to Chrome storage
function saveExcelFileToStorage(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    // Convert ArrayBuffer to Array for storage
    const arrayBuffer = e.target.result;
    const uint8Array = new Uint8Array(arrayBuffer);
    const dataArray = Array.from(uint8Array);

    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      data: dataArray // Store as regular array
    };

    chrome.storage.local.set({ excelFile: fileData }, () => {
      console.log('Excel file saved to storage:', file.name, 'Size:', dataArray.length);
    });
  };

  reader.readAsArrayBuffer(file);
}

// Load Excel file from Chrome storage
function loadExcelFileFromStorage() {
  chrome.storage.local.get(['excelFile'], (result) => {
    if (result.excelFile && result.excelFile.data) {
      const fileData = result.excelFile;
      console.log('Loading Excel file from storage:', fileData.name, 'Data length:', fileData.data.length);

      // Hiển thị thông tin file
      fileNameInline.textContent = fileData.name;
      fileSizeInline.textContent = formatFileSize(fileData.size);
      fileInfoInline.style.display = 'block';

      // Thay đổi style drop zone
      dropZone.classList.add('has-file');

      // Show clear button
      clearFileBtn.classList.add('show');
      resetDataBtn.classList.add('show');

      // Chuyển Array thành Uint8Array rồi tạo Blob và File object
      const uint8Array = new Uint8Array(fileData.data);
      const blob = new Blob([uint8Array], { type: fileData.type });
      const file = new File([blob], fileData.name, { type: fileData.type });

      // Set file vào excelInput
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      excelInput.files = dataTransfer.files;

      console.log('Excel file loaded and set to excelInput successfully');
      showStatus('✅ File Excel đã được khôi phục: ' + fileData.name, 'success');

      // Tự động load dữ liệu từ Excel sau khi khôi phục
      setTimeout(() => {
        loadExcelBtn.click();
      }, 500);
    } else {
      console.log('No Excel file found in storage');
    }
  });
}

// Generate random data button
generateDataBtn.addEventListener('click', () => {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary',
    'William', 'Jennifer', 'Richard', 'Linda', 'Thomas', 'Patricia', 'Charles', 'Barbara'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
    'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor'];

  // Random first name and last name
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  // Random birthdate (age 25-50)
  const birthYear = new Date().getFullYear() - Math.floor(Math.random() * 26 + 25); // 1974-1999
  const birthMonth = Math.floor(Math.random() * 12) + 1; // 1-12
  const birthDay = Math.floor(Math.random() * 28) + 1; // 1-28 (safe for all months)
  const birthdate = `${birthMonth}/${birthDay}/${birthYear}`;

  // Random discharge date (2015-2023)
  const dischargeYear = Math.floor(Math.random() * 9) + 2015; // 2015-2023
  const dischargeMonth = Math.floor(Math.random() * 12) + 1;
  const dischargeDay = Math.floor(Math.random() * 28) + 1;
  const dischargeDate = `${dischargeMonth}/${dischargeDay}/${dischargeYear}`;

  // Random email
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@example.com`;

  // Fill textarea
  const generatedData = `${firstName}\n${lastName}\n${birthdate}\n${dischargeDate}\n${email}`;
  dataInput.value = generatedData;

  showStatus('✅ Đã tạo data mẫu!', 'success');
});

// Random Email button
randomEmailBtn.addEventListener('click', () => {
  chrome.storage.local.get(['emailSettings'], (result) => {
    let prefix = 'user';
    let domain = 'huynhangiang.store';

    if (result.emailSettings) {
      prefix = result.emailSettings.prefix || 'user';
      domain = result.emailSettings.domain || 'huynhangiang.store';
    }

    // Tạo ngày tháng năm theo format YYYYMMDD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const dateStr = `${year}${month}${day}${hour}${minute}${second}`;

    const randomEmail = `${prefix}${dateStr}${Math.floor(Math.random() * 99999)}@${domain}`;

    emailInput.value = randomEmail;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    emailInput.dispatchEvent(new Event('change', { bubbles: true }));

    showStatus('✅ Email random: ' + randomEmail, 'success');
  });
});

// Fetch Mail button
fetchMailBtn.addEventListener('click', async () => {
  let mailInput = mailDomain.value.trim();

  if (!mailInput) {
    showMailStatus('❌ Vui lòng nhập email hoặc domain!', 'error');
    return;
  }

  // Parse email hoặc domain
  let domain, user;

  if (mailInput.includes('@')) {
    // Nếu là email: user52760@huynhangiang.store
    const parts = mailInput.split('@');
    user = parts[0];
    domain = parts[1];
  } else {
    // Nếu chỉ là domain: huynhangiang.store
    domain = mailInput;
    user = 'inbox';
  }

  // Log domain và user lên UI
  console.log('Domain:', domain, 'User:', user);
  showMailStatus(`📧 Domain: ${domain} | User: ${user}`, 'success');
  console.log('API user:', user);
  console.log('API domain:', domain);
  try {
    fetchMailBtn.disabled = true;
    fetchMailBtn.textContent = '⏳';

    // Gọi API để lấy danh sách email
    // Format: /api/email/{domain}/{user}
    const response = await fetch(`https://tinyhost.shop/api/email/${domain}/${user}/?page=1&limit=20`);
    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }

    const data = await response.json();

    // Hiển thị response lên UI
    const responseText = JSON.stringify(data, null, 2);
    // displayEmailContent(`Response từ API`, responseText);
    // showMailStatus(`✅ Nhận được response`, 'success');

    // Parse emails từ response
    const emails = data.emails || data.data || [];

    if (emails && emails.length > 0) {
      // Tìm email có chứa "verified" hoặc "Finish Verifying"
      let targetEmail = null;

      for (let email of emails) {
        const subject = (email.subject || '').toLowerCase();
        const body = (email.body || '').toLowerCase();

        if (subject.includes('verified') || subject.includes('finish verifying') ||
          body.includes('finish verifying') || body.includes('get verified')) {
          targetEmail = email;
          break;
        }
      }

      // Nếu không tìm thấy, lấy email đầu tiên
      if (!targetEmail) {
        targetEmail = emails[0];
      }

      const emailAddress = targetEmail.sender || targetEmail.email || targetEmail.address || targetEmail.from || '';
      const emailId = targetEmail.id || targetEmail.messageId || targetEmail.uid || '';

      showMailStatus(`📧 Email: ${emailAddress} | Subject: ${targetEmail.subject}`, 'success');

      if (emailAddress && emailId) {
        // Fetch nội dung email
        // Format: /api/email/{domain}/{user}/{email_id}
        try {
          const contentResponse = await fetch(`https://tinyhost.shop/api/email/${domain}/${user}/${emailId}`);

          if (contentResponse.ok) {
            const contentData = await contentResponse.json();
            const emailContent = contentData.body || contentData.html_body || contentData.data?.body || contentData.data?.text || 'Không có nội dung';

            // Extract URL từ email content
            const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]*)/g;
            const urls = emailContent.match(urlRegex) || [];
            let extractedUrl = urls.length > 0 ? urls[0].replace(/\)$/, "") : '';

            // Lưu URL vào biến global
            lastVerificationUrl = extractedUrl;
            console.log('Saved verification URL:', lastVerificationUrl);

            // Hiển thị chỉ URL (clickable)
            if (extractedUrl) {
              displayEmailContentWithLink(extractedUrl);
            } else {
              displayEmailContent(`${targetEmail.subject}`, emailContent);
            }
            showMailStatus('✅ Email: ' + emailAddress, 'success');
          } else {
            // Nếu không fetch được nội dung, vẫn set email
            // emailInput.value = emailAddress;
            // emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            // emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            showMailStatus('✅ Email: ' + emailAddress, 'success');
          }
        } catch (contentError) {
          console.log('Could not fetch email content:', contentError);
          // emailInput.value = emailAddress;
          // emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          // emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          showMailStatus('✅ Email: ' + emailAddress, 'success');
        }
      } else {
        showMailStatus('❌ Không tìm thấy email hoặc ID', 'error');
        displayEmailContent("Không tìm thấy email hoặc ID")
      }
    } else {
      showMailStatus('❌ Không có email nào', 'error');
      displayEmailContent("Không có email nào")
    }

  } catch (error) {
    console.error('Fetch mail error:', error);
    displayEmailContent("Fetch mail error:")
    showMailStatus('❌ Lỗi: ' + error.message, 'error');
  } finally {
    fetchMailBtn.disabled = false;
    fetchMailBtn.textContent = '🔄';
  }
});

// Clear Mail button
clearMailBtn.addEventListener('click', () => {
  mailList.innerHTML = '';
  mailStatus.textContent = '';
  mailStatus.style.display = 'none';
  showMailStatus('✅ Đã xóa email display', 'success');
});

// Display email content
function displayEmailContent(emailAddress, content) {
  mailList.innerHTML = '';

  const contentBox = document.createElement('div');
  contentBox.style.padding = '12px';
  contentBox.style.background = '#f9f9f9';
  contentBox.style.borderRadius = '4px';
  contentBox.style.border = '1px solid #ddd';
  contentBox.style.maxHeight = '400px';
  contentBox.style.overflowY = 'auto';

  const header = document.createElement('div');
  header.style.fontWeight = '600';
  header.style.color = '#333';
  header.style.marginBottom = '12px';
  header.style.fontSize = '14px';
  header.textContent = emailAddress;

  const body = document.createElement('div');
  body.style.fontSize = '12px';
  body.style.color = '#666';
  body.style.lineHeight = '1.5';
  body.textContent = content;

  contentBox.appendChild(header);
  contentBox.appendChild(body);
  mailList.appendChild(contentBox);
}

// Display URL as clickable link
function displayEmailContentWithLink(url) {
  mailList.innerHTML = '';

  const contentBox = document.createElement('div');
  contentBox.style.padding = '12px';
  contentBox.style.background = '#f9f9f9';
  contentBox.style.borderRadius = '4px';
  contentBox.style.border = '1px solid #ddd';
  contentBox.style.maxHeight = '400px';
  contentBox.style.overflowY = 'auto';

  const header = document.createElement('div');
  header.style.fontWeight = '600';
  header.style.color = '#333';
  header.style.marginBottom = '12px';
  header.style.fontSize = '14px';
  header.textContent = '🔗 Verification Link:';

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.style.display = 'inline-block';
  link.style.padding = '10px 16px';
  link.style.background = '#2196F3';
  link.style.color = 'white';
  link.style.textDecoration = 'none';
  link.style.borderRadius = '4px';
  link.style.fontSize = '12px';
  link.style.fontWeight = '600';
  link.style.wordBreak = 'break-all';
  link.textContent = url;

  contentBox.appendChild(header);
  contentBox.appendChild(link);
  mailList.appendChild(contentBox);
}

// Show mail status
function showMailStatus(message, type) {
  mailStatus.textContent = message;
  mailStatus.className = type + ' show';
  mailStatus.style.padding = '8px';
  mailStatus.style.borderRadius = '6px';
  mailStatus.style.display = 'block';
  mailStatus.style.textAlign = 'center';
  mailStatus.style.fontSize = '11px';
  mailStatus.style.fontWeight = '500';
  mailStatus.style.marginBottom = '12px';

  if (type === 'success') {
    mailStatus.style.background = '#d4edda';
    mailStatus.style.color = '#155724';
  } else {
    mailStatus.style.background = '#f8d7da';
    mailStatus.style.color = '#721c24';
  }

  setTimeout(() => {
    mailStatus.style.display = 'none';
  }, 5000);
}


// Open Mail URL button
openMailUrlBtn.addEventListener('click', () => {
  const domain = mailDomain.value.trim();

  if (!domain) {
    showMailStatus('❌ Vui lòng nhập domain!', 'error');
    return;
  }

  const url = `https://tinyhost.shop/${domain}`;
  chrome.tabs.create({ url: url });
  showMailStatus('✅ Opened: ' + url, 'success');
});

// Lắng nghe message từ content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'switchToMailTab') {
    console.log('Received switchToMailTab message');
    // Click the Mail tab button
    const mailTabBtn = document.querySelector('[data-tab="mail"]');
    if (mailTabBtn) {
      mailTabBtn.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }

  if (request.action === 'tryAgainFound') {
    console.log('Received tryAgainFound message - auto retrying...');
    showMessage('🔄 Tìm thấy "Try Again", đang retry...', 'info');

    // Chuyển về tab Data
    const dataTabBtn = document.querySelector('[data-tab="data"]');
    if (dataTabBtn) {
      dataTabBtn.click();
    }

    // Chờ 3 giây rồi click autoBtn để retry
    setTimeout(() => {
      autoBtn.click();
    }, 3000);
    sendResponse({ success: true });
  }
});

// Email Settings
emailSettingsBtn.addEventListener('click', () => {
  emailSettingsPanel.classList.toggle('show');
});

// Load email settings from storage
function loadEmailSettings() {
  chrome.storage.local.get(['emailSettings'], (result) => {
    if (result.emailSettings) {
      const settings = result.emailSettings;
      emailDomainSetting.value = settings.domain || '';
      emailPrefixSetting.value = settings.prefix || '';
      console.log('Email settings loaded:', settings);
    }
  });
}

// Save email settings
saveEmailSettingsBtn.addEventListener('click', () => {
  const settings = {
    domain: emailDomainSetting.value.trim(),
    prefix: emailPrefixSetting.value.trim()
  };

  chrome.storage.local.set({ emailSettings: settings }, () => {
    console.log('Email settings saved:', settings);
    showStatus('✅ Email settings saved!', 'success');
    emailSettingsPanel.classList.remove('show');
  });
});

// Load email settings on startup
loadEmailSettings();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+E - Random Email
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    randomEmailBtn.click();
  }

  // Ctrl+Shift+F - Fetch Mail
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    fetchMailBtn.click();
  }

  // Ctrl+Shift+A - Auto Fill
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    autoBtn.click();
  }

  // Ctrl+Shift+L - Load Excel
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    e.preventDefault();
    loadExcelBtn.click();
  }

  // Ctrl+Shift+M - Switch to Mail Tab
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    document.querySelector('[data-tab="mail"]').click();
  }

  // Ctrl+Shift+D - Switch to Data Tab
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    document.querySelector('[data-tab="data"]').click();
  }

  // Ctrl+Shift+N - Switch to Note Tab
  if (e.ctrlKey && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    document.querySelector('[data-tab="note"]').click();
  }
});
