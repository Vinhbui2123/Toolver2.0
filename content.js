// === Canva auto fill functions ===
const _sleep2 = (ms) => new Promise(r => setTimeout(r, ms));

function _setNativeValue2(el, value) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
}

function _fireInput2(el) {
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: el.value }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function _typeReact2(el, value) {
  if (!el) throw new Error("Không thấy input để gõ");
  el.focus();
  await _sleep2(80);

  el.select?.();
  try { document.execCommand?.("insertText", false, ""); } catch { }
  _setNativeValue2(el, "");
  _fireInput2(el);
  await _sleep2(80);

  try {
    if (document.execCommand) document.execCommand("insertText", false, value);
    else _setNativeValue2(el, value);
  } catch {
    _setNativeValue2(el, value);
  }
  _fireInput2(el);
  await _sleep2(80);
}

function _pressEnter2(el) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
}

function _findSchoolCombobox2() {
  const btns = [...document.querySelectorAll('button[role="combobox"]')];
  return btns.find(b => (b.textContent || "").includes("Select a school"))
    || btns.find(b => /school/i.test(b.textContent || ""))
    || null;
}

function _findSchoolSearchInput2() {
  return document.querySelector('input[type="search"][placeholder="Enter your school name"]')
    || document.querySelector('input[type="search"]')
    || null;
}

async function canvaFill2(fullName, schoolName) {
  console.log("=== CANVA FILL START ===");

  // 1) Full name
  console.log("--- Step 1: Full name ---");
  const fullNameInput = document.querySelector('input[aria-label="Full name"]');
  if (!fullNameInput) throw new Error("Không tìm thấy input Full name");
  await _typeReact2(fullNameInput, fullName);
  fullNameInput.blur();
  console.log("✓ Full name set:", fullName);

  await _sleep2(400);

  // 2) Open School dropdown
  console.log("--- Step 2: Open School dropdown ---");
  const schoolBtn = _findSchoolCombobox2();
  if (!schoolBtn) throw new Error("Không tìm thấy School combobox button");

  schoolBtn.click();
  await _sleep2(600);
  console.log("✓ Dropdown opened");

  // 3) Type school
  console.log("--- Step 3: Type school ---");
  const searchInput = _findSchoolSearchInput2();
  if (!searchInput) throw new Error("Không tìm thấy ô search school");
  await _typeReact2(searchInput, schoolName);
  console.log("✓ Typed school:", schoolName);

  // 4) ⚡ OPTIMIZED: Wait 2s (reduced from 5s) -> Enter
  console.log('--- Step 4: Wait 2s -> Enter ---');
  await _sleep2(2000);
  _pressEnter2(searchInput);
  console.log('✓ Enter pressed');

  console.log("=== CANVA FILL DONE ===");
}


// Lắng nghe message từ sidebar
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'autoUploadFlow') {
    autoUploadFlow(request.fileData, request.schoolName, request.email, request.fullName, request.startFromCanva)
      .then((message) => sendResponse({ success: true, message }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'uploadFile') {
    uploadFileToButton(request.fileData)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'autoSelectMilitaryStatus') {
    autoSelectMilitaryStatus(request.formData)
      .then((message) => sendResponse({ success: true, message }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (request.action === 'VerificationLimitExceeded') {
    // Kiểm tra "Verification Limit Exceeded" message trên trang
    const bodyText = document.body.innerText;
    const found = bodyText.includes('Verification Limit Exceeded');
    console.log('Verification Limit Exceeded":', found);
    sendResponse({ found: found });
    return true;
  }
  if (request.action === 'checkForEmailMessage') {
    // Kiểm tra "Check your email" message trên trang
    const bodyText = document.body.innerText;
    const found = bodyText.includes('Check your email');
    console.log('Checking for "Check your email":', found);
    sendResponse({ found: found });
    return true;
  }


  if (request.action === 'clickVerifyEligibility') {
    // Tìm và click nút "Verify eligibility"
    let clicked = false;

    // Cách 1: Tìm button.btn-primary chứa text "Verify eligibility"
    const buttons = document.querySelectorAll('button.btn-primary');
    for (let btn of buttons) {
      if (btn.textContent.includes('Verify eligibility')) {
        console.log('Found btn-primary with Verify eligibility:', btn);
        btn.click();
        clicked = true;
        break;
      }
    }

    // Cách 2: Tìm div.flex chứa text và click parent button
    if (!clicked) {
      const divs = document.querySelectorAll('div.flex');
      for (let div of divs) {
        if (div.textContent.trim() === 'Verify eligibility') {
          const parentBtn = div.closest('button');
          if (parentBtn) {
            console.log('Found div.flex, clicking parent button:', parentBtn);
            parentBtn.click();
            clicked = true;
            break;
          }
        }
      }
    }

    // Cách 3: Tìm tất cả buttons
    if (!clicked) {
      const allButtons = document.querySelectorAll('button');
      for (let btn of allButtons) {
        if (btn.textContent.toLowerCase().includes('verify eligibility')) {
          console.log('Found button with text:', btn);
          btn.click();
          clicked = true;
          break;
        }
      }
    }

    console.log('clickVerifyEligibility result:', clicked);
    sendResponse({ clicked: clicked });
    return true;
  }

  if (request.action === 'checkTryAgain') {
    // Tìm "you've been verified" trong body text
    const bodyText = document.body.innerText;
    let found = false;

    if (bodyText.includes("you've been verified") || bodyText.includes("You've been verified")) {
      console.log('Found "you\'ve been verified" in page body');
      found = true;
    }

    console.log('checkTryAgain result:', found);
    sendResponse({ found: found });
    return true; // Keep message channel open
  }
});

async function uploadFileToButton(fileData) {
  // Tìm button "Choose file" với các class đã cho
  const button = document.querySelector('button._5KtATA.LQzFZw.VgvqkQ._8ERLTg.MCgm0w.Z3nT2A');

  if (!button) {
    throw new Error('Không tìm thấy button Choose file');
  }

  // Tìm input file liên quan (thường ẩn đằng sau button)
  let fileInput = button.querySelector('input[type="file"]');

  if (!fileInput) {
    // Tìm input file gần button
    fileInput = button.parentElement?.querySelector('input[type="file"]') ||
      document.querySelector('input[type="file"]');
  }

  if (!fileInput) {
    throw new Error('Không tìm thấy input file');
  }

  // Chuyển base64 thành File object
  const blob = await fetch(fileData.data).then(r => r.blob());
  const file = new File([blob], fileData.name, { type: fileData.type });

  // Tạo DataTransfer để set file vào input
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  // Trigger các event để website nhận biết file đã được chọn
  const events = ['input', 'change'];
  events.forEach(eventType => {
    const event = new Event(eventType, { bubbles: true });
    fileInput.dispatchEvent(event);
  });

  // Click button nếu cần
  button.click();

  console.log('File uploaded successfully:', fileData.name);
}

// Auto upload flow: Xử lý popup → nhập email → click Continue → chọn Payslip → upload → checkmark → fill info → Continue
async function autoUploadFlow(fileData, schoolName = '', email = '', fullName = '', startFromCanva = false) {
  let steps = [];

  // Nếu bắt đầu từ trang Canva teacher verification
  if (startFromCanva) {
    // Bước 0: Kiểm tra và xử lý popup nếu có
    const popup = document.querySelector('div[role="dialog"][aria-modal="true"]');

    if (popup) {
      console.log('Step 0: Found popup dialog');

      // Tìm button Continue trong popup
      const popupContinueButton = Array.from(popup.querySelectorAll('button'))
        .find(btn => btn.textContent.trim() === 'Continue');

      if (popupContinueButton) {
        console.log('Step 0: Clicking Continue in popup');
        popupContinueButton.click();
        steps.push('Click Continue trong popup');

        // Đợi popup đóng và trang load
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Bước 0a: Tìm input email (nếu có)
    const emailInput = document.querySelector('input#_r_k9_[type="text"][inputmode="email"]');

    if (emailInput && email) {
      console.log('Step 0a: Found email input, entering email');
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      steps.push('Nhập email');

      await new Promise(resolve => setTimeout(resolve, 300));

      // Click Continue sau khi nhập email
      const emailContinueButton = Array.from(document.querySelectorAll('button'))
        .find(btn => btn.textContent.trim() === 'Continue');

      if (emailContinueButton) {
        console.log('Step 0a: Clicking Continue after email');
        emailContinueButton.click();
        steps.push('Click Continue sau email');

        // Đợi trang load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Bước 1: Tìm và click "Select a document"
  const selectButton = document.querySelector('button.PuABGQ.ZA7_OA.BMOCzQ._4tv94w[role="combobox"]');

  if (!selectButton) {
    throw new Error('Không tìm thấy button "Select a document"');
  }

  console.log('Step 1: Found Select button');
  selectButton.click();
  steps.push('Mở dropdown');

  // Đợi dropdown hiển thị
  await new Promise(resolve => setTimeout(resolve, 500));

  // Bước 2: Tìm và click "Payslip"
  const payslipOption = Array.from(document.querySelectorAll('p.aWBg0w.aZskFA.u16U_g'))
    .find(el => el.textContent.includes('Payslip'));

  if (!payslipOption) {
    throw new Error('Không tìm thấy option "Payslip"');
  }

  console.log('Step 2: Found and clicking Payslip');
  payslipOption.click();
  steps.push('Chọn Payslip');

  // Đợi 500ms sau khi chọn Payslip
  await new Promise(resolve => setTimeout(resolve, 500));

  // Bước 3: Upload file
  console.log('Step 3: Uploading file');
  await uploadFileToButton(fileData);
  steps.push('Upload file');

  // Đợi file upload xong và checkmark xuất hiện
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Bước 3a: Tìm và click vào checkmark icon sau khi upload
  const checkmarkIcon = document.querySelector('span.Q5j_pg._8LCIjg.cHp_rQ svg');

  if (checkmarkIcon) {
    console.log('Step 3a: Found checkmark icon, clicking it');
    // Click vào element cha có thể click được
    const clickableCheckmark = checkmarkIcon.closest('span.Q5j_pg._8LCIjg.cHp_rQ') ||
      checkmarkIcon.closest('button') ||
      checkmarkIcon.parentElement;

    if (clickableCheckmark) {
      clickableCheckmark.click();
      steps.push('Click checkmark');

      // Đợi sau khi click checkmark để form hiện ra
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  } else {
    console.log('Step 3a: Checkmark not found, continuing...');
  }

  // Đợi trước khi click Continue
  await new Promise(resolve => setTimeout(resolve, 500));

  // Bước 3 Tìm và click button "Continue"
  const continueButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent.trim() === 'Continue');

  if (!continueButton) {
    console.log('Step 3: Continue button not found, checking if form is valid...');
    throw new Error('Không tìm thấy button "Continue"');
  }

  console.log('Step 3: Found and clicking Continue');
  continueButton.click();
  steps.push('Click Continue cuối');

  // Bước 4: Đợi trang load và chạy canvaFill2
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Step 4: Running canvaFill2 to fill Full name and School');
  await canvaFill2(fullName, schoolName);
  steps.push('Điền Full name và School');

  // Đợi lâu hơn để form validate và button enabled
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Bước 5: Tìm và click button "Continue" sau khi điền form
  console.log('Step 5: Looking for Continue button after form fill');

  // Thử tìm button trong 10 giây
  let continueButton5 = null;
  for (let i = 0; i < 20; i++) {
    continueButton5 = Array.from(document.querySelectorAll('button'))
      .find(btn => {
        const text = btn.textContent.trim();
        const isEnabled = !btn.disabled && !btn.hasAttribute('disabled');
        return text === 'Continue' && isEnabled;
      });

    if (continueButton5) {
      console.log('Step 5: Found enabled Continue button');
      break;
    }

    console.log(`Step 5: Waiting for Continue button to be enabled... (${i + 1}/20)`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!continueButton5) {
    console.log('Step 5: Continue button not found or not enabled');
    throw new Error('Không tìm thấy button "Continue" enabled ở bước 5');
  }

  console.log('Step 5: Clicking Continue');
  continueButton5.click();
  steps.push('Click Continue sau khi điền form');

  // Bước 6: Đợi 5 giây và click button "Done"
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Step 6: Looking for Done button');
  const doneButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent.trim() === 'Done');

  if (!doneButton) {
    console.log('Step 6: Done button not found');
    throw new Error('Không tìm thấy button "Done" ở bước 6');
  }

  console.log('Step 6: Found and clicking Done');
  doneButton.click();
  steps.push('Click Done');

  return 'Hoàn thành: ' + steps.join(' → ');
}

// Map branch of service names based on military status
function mapBranchOfService(branchName, militaryStatus = 'Reservist or National Guard') {
  if (!branchName) return 'Army Reserve';

  const branch = branchName.trim().toUpperCase();
  console.log(militaryStatus)
  // Map for Military Veteran or Retiree
  if (militaryStatus === 'Military Veteran or Retiree') {
    const veteranMap = {
      "US ARMY": "Army",
      "US NAVY": "Navy",
      "US AIR FORCE": "Air Force",
      "US ARMY AIR FORCES": "Air Force",
      "US COAST GUARD": "Coast Guard",
      "US MARINE CORPS": "Marine Corps",
      "US ARMY RESERVE": "Army"
    };
    return veteranMap[branch] || branchName;
  }

  // Map for Reservist or National Guard (default)
  const branchMap = {
    'US ARMY': 'Army Reserve',
    'US NAVY': 'Navy Reserve',
    'US AIR FORCE': 'Air Force Reserve',
    'US ARMY AIR FORCES': 'Air Force Reserve',
    'US COAST GUARD': 'Coast Guard Reserve',
    'US MARINE CORPS': 'Marine Corps Forces Reserve',
    "US ARMY RESERVE": "Army Reserve"

  };

  return branchMap[branch] || branchName;
}

// Auto select Branch of Service: Gõ "Army Reserve" và bấm Enter
async function autoSelectMilitaryStatus(formData = {}) {
  console.log('=== AUTO SELECT BRANCH OF SERVICE START ===');
  console.log(formData)
  // Default values
  const data = {
    firstName: formData.firstName || 'John',
    lastName: formData.lastName || 'Doe',
    birthMonth: formData.birthMonth || 'January',
    birthDay: formData.birthDay || '15',
    birthYear: formData.birthYear || '1990',
    dischargeMonth: formData.dischargeMonth || 'December',
    dischargeDay: formData.dischargeDay || '20',
    dischargeYear: '2025',
    email: formData.email || 'john.doe@example.com',
    militaryStatus: formData.militaryStatus || 'Reservist or National Guard'
  };

  // Helper function to find input by ID or placeholder
  function findInput(id, placeholder = '') {
    let input = document.querySelector(`#${id}`);
    if (input) return input;

    if (placeholder) {
      input = document.querySelector(`input[placeholder*="${placeholder}"]`);
      if (input) return input;
    }

    // Search by aria-label
    input = document.querySelector(`input[aria-label*="${id.replace('sid-', '')}"]`);
    if (input) return input;

    return null;
  }

  // Bước 0: Tìm và gõ military status vào input military status
  console.log('Step 0: Looking for military status input');
  const militaryStatusInput = document.querySelector('#sid-military-status');
  const militaryStatus = data.militaryStatus;

  if (militaryStatusInput) {
    console.log('Step 0: Found military status input, typing:', militaryStatus);
    militaryStatusInput.focus();
    await _sleep2(150); // ⚡ Reduced from 300ms

    await _typeReact2(militaryStatusInput, militaryStatus);
    console.log('Step 0: Typed', militaryStatus);

    // ⚡ OPTIMIZED: Reduced from 3000ms to 1500ms - dropdown should load faster
    console.log('Step 0a: Waiting 1.5 seconds for dropdown...');
    await _sleep2(1500);

    // Bấm Enter
    console.log('Step 0b: Pressing Enter');
    _pressEnter2(militaryStatusInput);

    // ⚡ OPTIMIZED: Reduced from 1500ms to 800ms
    await _sleep2(800);
  } else {
    console.log('Step 0: Military status input not found, continuing...');
  }

  // Bước 1: Tìm input Branch of Service
  const branchInput = document.querySelector('#sid-branch-of-service');

  if (!branchInput) {
    throw new Error('Không tìm thấy input Branch of Service');
  }

  const branchOfService = mapBranchOfService(formData.branchOfService || '', militaryStatus);
  console.log('Step 1: Found Branch of Service input, typing:', branchOfService);

  // Focus vào input
  branchInput.focus();
  await _sleep2(200); // ⚡ Reduced from 500ms

  // Gõ text vào input
  await _typeReact2(branchInput, branchOfService);

  console.log('✓ Đã gõ Branch of Service:', branchOfService);

  // ⚡ OPTIMIZED: Reduced from 1500ms to 800ms
  console.log('Step 2: Waiting 0.8 seconds before pressing Enter...');
  await _sleep2(800);

  // Bấm Enter vào input
  console.log('Step 3: Pressing Enter...');

  // Dispatch Enter key event vào branchInput
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });

  branchInput.dispatchEvent(enterEvent);

  // Dispatch keyup event
  const enterUpEvent = new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });

  branchInput.dispatchEvent(enterUpEvent);

  console.log('✓ Đã bấm Enter');

  // Bước 4: Chờ 3 giây
  console.log('Step 4: Waiting 3 seconds...');
  await _sleep2(150); // ⚡ Optimized from 300ms;

  // Bước 5: Xóa dữ liệu cũ và điền First Name
  console.log('Step 5: Filling First Name...');
  const firstNameInput = document.querySelector('#sid-first-name');

  if (firstNameInput) {
    // Xóa dữ liệu cũ
    firstNameInput.value = '';
    firstNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    // Gõ First Name từ formData
    await _typeReact2(firstNameInput, data.firstName);
    console.log('✓ Đã điền First Name:', data.firstName);
  } else {
    console.log('⚠ Không tìm thấy First Name input');
  }

  // Chờ 3 giây
  await _sleep2(150); // ⚡ Optimized from 300ms;

  // Bước 6: Xóa dữ liệu cũ và điền Last Name
  console.log('Step 6: Filling Last Name...');
  const lastNameInput = document.querySelector('#sid-last-name');

  if (lastNameInput) {
    // Xóa dữ liệu cũ
    lastNameInput.value = '';
    lastNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    // Gõ Last Name từ formData
    await _typeReact2(lastNameInput, data.lastName);
    console.log('✓ Đã điền Last Name:', data.lastName);
  } else {
    console.log('⚠ Không tìm thấy Last Name input');
  }

  // Chờ 3 giây
  await _sleep2(150); // ⚡ Optimized from 300ms;

  // Bước 7: Xóa dữ liệu cũ và điền Birth Month
  console.log('Step 7: Filling Birth Month...');
  const monthInput = document.querySelector('#sid-birthdate__month');

  if (monthInput) {
    // Xóa dữ liệu cũ
    monthInput.value = '';
    monthInput.dispatchEvent(new Event('input', { bubbles: true }));
    await _sleep2(150); // ⚡ Optimized from 300ms;

    // Gõ Month từ formData
    await _typeReact2(monthInput, data.birthMonth);
    console.log('✓ Đã điền Birth Month:', data.birthMonth);

    // Chờ 3 giây sau khi nhập tháng
    console.log('Step 7a: Waiting 3 seconds after Birth Month...');
    await _sleep2(150); // ⚡ Optimized from 300ms;

    // Bấm Enter sau khi nhập tháng
    console.log('Step 7b: Pressing Enter after Birth Month...');
    const enterEventMonth = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    monthInput.dispatchEvent(enterEventMonth);

    const enterUpEventMonth = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    monthInput.dispatchEvent(enterUpEventMonth);
    console.log('✓ Đã bấm Enter sau Birth Month');
  } else {
    console.log('⚠ Không tìm thấy Birth Month input');
  }

  // Chờ 3 giây
  await _sleep2(150); // ⚡ Optimized from 300ms;

  // Bước 8: Xóa dữ liệu cũ và điền Birth Day
  console.log('Step 8: Filling Birth Day...');
  const dayInput = document.querySelector('#sid-birthdate-day');

  if (dayInput) {
    // Xóa dữ liệu cũ
    dayInput.value = '';
    dayInput.dispatchEvent(new Event('input', { bubbles: true }));
    await _sleep2(150); // ⚡ Optimized from 300ms;

    // Gõ Day từ formData
    await _typeReact2(dayInput, data.birthDay);
    console.log('✓ Đã điền Birth Day:', data.birthDay);
  } else {
    console.log('⚠ Không tìm thấy Birth Day input');
  }

  // Chờ 3 giây
  await _sleep2(150); // ⚡ Optimized from 300ms;

  // Bước 9: Xóa dữ liệu cũ và điền Birth Year
  console.log('Step 9: Filling Birth Year...');
  const yearInput = document.querySelector('#sid-birthdate-year');

  if (yearInput) {
    // Xóa dữ liệu cũ
    yearInput.value = '';
    yearInput.dispatchEvent(new Event('input', { bubbles: true }));
    await _sleep2(150); // ⚡ Optimized from 300ms;

    // Gõ Year từ formData
    await _typeReact2(yearInput, data.birthYear);
    console.log('✓ Đã điền Birth Year:', data.birthYear);
  } else {
    console.log('⚠ Không tìm thấy Birth Year input');
  }

  // Bước 10: Bấm Enter sau khi điền xong birthdate
  console.log('Step 10: Pressing Enter after birthdate...');
  if (yearInput) {
    const enterEvent1 = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    yearInput.dispatchEvent(enterEvent1);

    const enterUpEvent1 = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    yearInput.dispatchEvent(enterUpEvent1);
    console.log('✓ Đã bấm Enter sau birthdate');
  }

  // Chờ 3 giây
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Bước 11: Điền Discharge Month
  console.log('Step 11: Filling Discharge Month...');
  const dischargeMonthInput = document.querySelector('#sid-discharge-date__month');

  if (dischargeMonthInput) {
    dischargeMonthInput.value = '';
    dischargeMonthInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    await _typeReact2(dischargeMonthInput, data.dischargeMonth);
    console.log('✓ Đã điền Discharge Month:', data.dischargeMonth);

    // Chờ 5 giây sau khi nhập tháng
    console.log('Step 11a: Waiting 5 seconds after Discharge Month...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Bấm Enter sau khi nhập tháng
    console.log('Step 11b: Pressing Enter after Discharge Month...');
    const enterEventDischargeMonth = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    dischargeMonthInput.dispatchEvent(enterEventDischargeMonth);

    const enterUpEventDischargeMonth = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    dischargeMonthInput.dispatchEvent(enterUpEventDischargeMonth);
    console.log('✓ Đã bấm Enter sau Discharge Month');
  } else {
    console.log('⚠ Không tìm thấy Discharge Month input');
  }

  // Chờ 3 giây
  await new Promise(resolve => setTimeout(resolve, 500));

  // Bước 12: Điền Discharge Day
  console.log('Step 12: Filling Discharge Day...');
  const dischargeDayInput = document.querySelector('#sid-discharge-date-day');

  if (dischargeDayInput) {
    dischargeDayInput.value = '';
    dischargeDayInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    await _typeReact2(dischargeDayInput, data.dischargeDay);
    console.log('✓ Đã điền Discharge Day:', data.dischargeDay);
  } else {
    console.log('⚠ Không tìm thấy Discharge Day input');
  }

  // Bước 13: Bấm Enter sau khi điền xong discharge date
  console.log('Step 13: Pressing Enter after discharge date...');
  if (dischargeDayInput) {
    const enterEvent2 = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    dischargeDayInput.dispatchEvent(enterEvent2);

    const enterUpEvent2 = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    dischargeDayInput.dispatchEvent(enterUpEvent2);
    console.log('✓ Đã bấm Enter sau discharge date');
  }

  // Chờ 1 giây
  await new Promise(resolve => setTimeout(resolve, 500));

  // Bước 13a: Điền Discharge Year
  console.log('Step 13a: Filling Discharge Year...');
  const dischargeYearInput = document.querySelector('#sid-discharge-date-year');

  if (dischargeYearInput) {
    dischargeYearInput.value = '';
    dischargeYearInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    // Gõ Year từ data object
    await _typeReact2(dischargeYearInput, data.dischargeYear);
    console.log('✓ Đã điền Discharge Year:', data.dischargeYear);
  } else {
    console.log('⚠ Không tìm thấy Discharge Year input');
  }

  // Chờ 1 giây
  await new Promise(resolve => setTimeout(resolve, 500));

  // Bước 14: Điền Email
  console.log('Step 14: Filling Email...');
  const emailInput = document.querySelector('#sid-email');

  if (emailInput) {
    emailInput.value = '';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    await _typeReact2(emailInput, data.email);
    console.log('✓ Đã điền Email:', data.email);
  } else {
    console.log('⚠ Không tìm thấy Email input');
  }

  // Chờ 2 giây
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Bước 15: Click button "Verify My Eligibility"
  console.log('Step 15: Clicking Verify My Eligibility button...');
  const submitButton = document.querySelector('#sid-submit-btn-collect-info');

  if (submitButton) {
    submitButton.click();
    console.log('✓ Đã click button "Verify My Eligibility"');
  } else {
    console.log('⚠ Không tìm thấy button "Verify My Eligibility"');
  }

  console.log('=== AUTO SELECT BRANCH OF SERVICE DONE ===');

  return 'Đã hoàn thành tất cả các bước: Army Reserve, thông tin cá nhân, discharge date, email và click Verify My Eligibility!';
}



// Auto-detect và highlight button khi load trang
window.addEventListener('load', () => {
  const button = document.querySelector('button._5KtATA.LQzFZw.VgvqkQ._8ERLTg.MCgm0w.Z3nT2A');
  if (button) {
    console.log('Found Choose file button:', button);
  }

  const selectButton = document.querySelector('button.PuABGQ.ZA7_OA.BMOCzQ._4tv94w[role="combobox"]');
  if (selectButton) {
    console.log('Found Select document button:', selectButton);
  }
});
