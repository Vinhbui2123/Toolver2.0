// Mở sidebar khi click vào icon extension
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ========================================
// ⚡ KEEP-ALIVE MECHANISM for Manifest V3
// Prevents Service Worker from unloading after 30 seconds
// ========================================

// Keep-alive interval - ping every 25 seconds to prevent unload
const KEEP_ALIVE_INTERVAL = 25000;

// Store active connections
let activeConnections = new Set();

// Keep Service Worker alive with periodic alarm
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 }); // Every 24 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Simple ping to keep alive
    console.log('[Keep-Alive] Service Worker ping:', new Date().toLocaleTimeString());
  }
});

// Handle long-lived connections from sidebar
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] Connection established:', port.name);
  activeConnections.add(port);

  port.onDisconnect.addListener(() => {
    console.log('[Background] Connection closed:', port.name);
    activeConnections.delete(port);
  });

  // Handle messages from connected ports
  port.onMessage.addListener((msg) => {
    if (msg.type === 'ping') {
      port.postMessage({ type: 'pong', timestamp: Date.now() });
    }
  });
});

// Handle messages from content scripts and sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping-pong to keep connection alive
  if (request.action === 'ping') {
    sendResponse({ status: 'alive', timestamp: Date.now() });
    return true;
  }

  // Forward messages between sidebar and content script if needed
  if (request.action === 'forwardToTab') {
    chrome.tabs.sendMessage(request.tabId, request.message, (response) => {
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
  }

  return false;
});

// Log when Service Worker starts
console.log('[Background] Service Worker started:', new Date().toLocaleTimeString());
