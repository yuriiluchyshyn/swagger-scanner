// Open modal directly when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  // Try sending message to content script first
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleModal' });
  } catch (e) {
    // Content script not injected yet, inject it first
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    // Then send the message
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleModal' });
      } catch {}
    }, 100);
  }
});
