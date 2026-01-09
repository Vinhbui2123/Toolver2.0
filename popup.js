// Upload file
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('fileInput');
  const statusDiv = document.getElementById('status');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    showStatus('Vui lòng chọn file trước!', 'error');
    return;
  }
  
  const file = fileInput.files[0];
  
  try {
    // Lấy tab hiện tại
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Đọc file thành base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result
      };
      
      // Gửi data đến content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'uploadFile',
        fileData: fileData
      }, (response) => {
        if (response && response.success) {
          showStatus('Upload thành công!', 'success');
        } else {
          showStatus('Upload thất bại: ' + (response?.error || 'Unknown error'), 'error');
        }
      });
    };
    
    reader.readAsDataURL(file);
    
  } catch (error) {
    showStatus('Lỗi: ' + error.message, 'error');
  }
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}
