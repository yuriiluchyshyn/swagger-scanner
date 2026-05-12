// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openModal' || request.action === 'toggleModal') {
    const existing = document.getElementById('openapi-scanner-modal');
    if (existing) {
      existing.remove();
      const existingStyle = document.getElementById('openapi-scanner-style');
      if (existingStyle) existingStyle.remove();
    } else {
      openSwaggerModal();
    }
    sendResponse({ success: true });
  }
});

function openSwaggerModal() {
  const existing = document.getElementById('openapi-scanner-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'openapi-scanner-modal';
  modal.innerHTML = `
    <div class="openapi-modal-overlay">
      <div class="openapi-modal-content" data-fullscreen="false">
        <div class="openapi-modal-header" title="Drag to move">
          <h3>🔍 OpenAPI Scanner</h3>
          <div class="openapi-modal-controls">
            <button class="openapi-modal-autofill" title="Auto-fill from Portal Profile">🔄</button>
            <button class="openapi-modal-fullscreen" title="Toggle Fullscreen">⛶</button>
            <button class="openapi-modal-close" title="Close">&times;</button>
          </div>
        </div>
        <div class="openapi-modal-body">
          <iframe 
            src="http://localhost:4444" 
            frameborder="0"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </div>
        <div class="openapi-modal-resizer"></div>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'openapi-scanner-style';
  style.textContent = `
    #openapi-scanner-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .openapi-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
    }

    .openapi-modal-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%); /* Початкове центрування */
      background: white;
      border-radius: 12px;
      width: 90%;
      height: 85%;
      max-width: 1400px;
      max-height: 900px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .openapi-modal-content[data-fullscreen="true"] {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      border-radius: 0;
      top: 0 !important;
      left: 0 !important;
      transform: none !important;
    }

    .openapi-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e1e4e8;
      background: #f6f8fa;
      cursor: grab;
      user-select: none;
      border-radius: 12px 12px 0 0;
    }

    .openapi-modal-header:active {
      cursor: grabbing;
    }

    .openapi-modal-content[data-fullscreen="true"] .openapi-modal-header {
      border-radius: 0;
      cursor: default;
    }

    .openapi-modal-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #24292f;
      pointer-events: none;
    }

    .openapi-modal-controls {
      display: flex;
      gap: 4px;
    }

    .openapi-modal-autofill,
    .openapi-modal-fullscreen,
    .openapi-modal-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #656d76;
      padding: 6px 8px;
      border-radius: 6px;
      line-height: 1;
      transition: all 0.15s ease;
    }

    .openapi-modal-autofill:hover,
    .openapi-modal-fullscreen:hover,
    .openapi-modal-close:hover {
      background: #e8e8e8;
      color: #24292f;
    }

    .openapi-modal-close {
      font-size: 20px;
    }

    .openapi-modal-body {
      flex: 1;
      overflow: hidden;
      border-radius: 0 0 12px 12px;
    }

    .openapi-modal-body iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    .openapi-modal-resizer {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      z-index: 10;
      background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%);
      border-bottom-right-radius: 12px;
    }

    .openapi-modal-content[data-fullscreen="true"] .openapi-modal-resizer {
      display: none;
    }

    @media (max-width: 768px) {
      .openapi-modal-content {
        width: 100% !important;
        height: 100% !important;
        border-radius: 0;
        top: 0 !important;
        left: 0 !important;
        transform: none !important;
      }
      .openapi-modal-resizer {
        display: none;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('.openapi-modal-close');
  const fullscreenBtn = modal.querySelector('.openapi-modal-fullscreen');
  const autofillBtn = modal.querySelector('.openapi-modal-autofill');
  const overlay = modal.querySelector('.openapi-modal-overlay');
  const content = modal.querySelector('.openapi-modal-content');
  const iframe = modal.querySelector('iframe');
  const header = modal.querySelector('.openapi-modal-header');
  const resizer = modal.querySelector('.openapi-modal-resizer');

  // --- DRAG AND DROP & RESIZE LOGIC ---
  let isDragging = false;
  let isResizing = false;
  let startX, startY, startLeft, startTop, startWidth, startHeight;

  // Функція для безпечного переходу від відцентрованого transform до абсолютних піксельних координат
  function initAbsolutePosition() {
    const computedStyle = window.getComputedStyle(content);
    if (computedStyle.transform !== 'none') {
      // Беремо РЕАЛЬНІ координати вікна на екрані
      const rect = content.getBoundingClientRect();
      
      // Вимикаємо CSS-центрування
      content.style.transform = 'none';
      
      // Фіксуємо вікно в тих самих пікселях, де воно було
      content.style.left = rect.left + 'px';
      content.style.top = rect.top + 'px';
      content.style.width = rect.width + 'px';
      content.style.height = rect.height + 'px';
    }
  }

  // Початок перетягування (Drag)
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.openapi-modal-controls') || content.getAttribute('data-fullscreen') === 'true') return;
    
    isDragging = true;
    initAbsolutePosition();
    
    // Завжди беремо реальні поточні координати, а не те, що записано в style.left
    const rect = content.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    
    // Вимикаємо події iframe, щоб не дьоргалось
    iframe.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';
  });

  // Початок зміни розміру (Resize)
  resizer.addEventListener('mousedown', (e) => {
    if (content.getAttribute('data-fullscreen') === 'true') return;

    isResizing = true;
    initAbsolutePosition();
    
    const rect = content.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    
    iframe.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';
    e.stopPropagation();
    e.preventDefault();
  });

  // Рух миші
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      content.style.left = (startLeft + dx) + 'px';
      content.style.top = (startTop + dy) + 'px';
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      content.style.width = Math.max(400, startWidth + dx) + 'px'; // Мінімальна ширина 400px
      content.style.height = Math.max(300, startHeight + dy) + 'px'; // Мінімальна висота 300px
    }
  });

  // Кінець руху
  document.addEventListener('mouseup', () => {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
      // Повертаємо iframe до життя
      iframe.style.pointerEvents = 'auto';
      document.body.style.userSelect = '';
    }
  });
  // ------------------------------------

  // Close
  closeBtn.addEventListener('click', () => { modal.remove(); style.remove(); });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) { modal.remove(); style.remove(); }
  });

  // Fullscreen toggle
  fullscreenBtn.addEventListener('click', () => {
    const isFullscreen = content.getAttribute('data-fullscreen') === 'true';
    content.setAttribute('data-fullscreen', !isFullscreen);
    fullscreenBtn.textContent = !isFullscreen ? '🗗' : '⛶';
    fullscreenBtn.title = !isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen';
  });

  // Auto-fill from portal profile
  autofillBtn.addEventListener('click', () => {
    try {
      const portalProfile = localStorage.getItem('portal_profile');
      if (!portalProfile) {
        showNotification('Portal profile not found in localStorage', 'error');
        return;
      }

      let profileData;
      try { profileData = JSON.parse(portalProfile); }
      catch (e) { showNotification('Invalid JSON in portal_profile', 'error'); return; }

      const user = profileData.user;
      if (!user) { showNotification('User data not found in portal profile', 'error'); return; }

      const globalParamsData = {};
      const availableParams = {};

      // Auth token
      const authToken = localStorage.getItem('access_token') || 
                       localStorage.getItem('auth_token') || 
                       localStorage.getItem('jwt_token') || '';
      if (authToken) {
        globalParamsData.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
      }

      // Map user data
      if (user.tenant_id) globalParamsData.tenant_id = user.tenant_id;
      if (user.tenant_code) globalParamsData.tenant_code = user.tenant_code;
      if (user.principal_id) globalParamsData.principal_id = user.principal_id;
      if (user.email) globalParamsData._email = user.email;

      // Subscription ID
      if (user.principal_data?.subscriptions?.length > 0) {
        globalParamsData.subscription_id = user.principal_data.subscriptions[0].subscription_id;
      } else if (profileData.subscriptions && Object.keys(profileData.subscriptions).length > 0) {
        const firstSub = Object.values(profileData.subscriptions)[0];
        if (firstSub.subscription_id) globalParamsData.subscription_id = firstSub.subscription_id;
      }

      // Flatten all user params for available list
      const flattenObject = (obj, prefix = '') => {
        const result = {};
        for (const key in obj) {
          if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            Object.assign(result, flattenObject(obj[key], prefix + key + '_'));
          } else if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
            result[prefix + key] = obj[key];
          }
        }
        return result;
      };

      const allParams = flattenObject(user);
      if (authToken) { allParams.auth_token = authToken; allParams.access_token = authToken; }

      const usedKeys = ['tenant_id', 'tenant_code', 'principal_id', 'subscription_id'];
      Object.keys(allParams).forEach(key => {
        if (!usedKeys.includes(key) && !usedKeys.includes(key.replace(/^.*_/, ''))) {
          availableParams[key] = allParams[key];
        }
      });

      // Send to iframe
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'AUTOFILL_GLOBAL_PARAMS',
          data: globalParamsData,
          availableParams: availableParams
        }, '*');

        iframe.contentWindow.postMessage({
          type: 'STORE_AVAILABLE_PARAMS',
          data: availableParams
        }, '*');

        const filledCount = Object.keys(globalParamsData).filter(k => !k.startsWith('_')).length;
        showNotification(`Auto-filled ${filledCount} params + ${Object.keys(availableParams).length} available`, 'success');

        // Also save via API as backup
        const email = globalParamsData._email || '';
        fetch('http://localhost:3002/api/global-params', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Email': email || 'extension@autofill' },
          body: JSON.stringify({
            Authorization: { value: globalParamsData.Authorization || '', in: 'header', label: 'Auth Token' },
            tenant_id: { value: globalParamsData.tenant_id || '', in: 'body', label: 'Tenant ID' },
            tenant_code: { value: globalParamsData.tenant_code || '', in: 'body', label: 'Tenant Code (= Customer Number)' },
            subscription_id: { value: globalParamsData.subscription_id || '', in: 'body', label: 'Subscription ID' },
            principal_id: { value: globalParamsData.principal_id || '', in: 'body', label: 'Principal ID' },
          })
        }).catch(() => {});
      } else {
        showNotification('Scanner not loaded yet, please try again', 'warning');
      }
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    }
  });

  // ESC to close
  const handleEsc = (e) => {
    if (e.key === 'Escape') { modal.remove(); style.remove(); document.removeEventListener('keydown', handleEsc); }
  };
  document.addEventListener('keydown', handleEsc);
}

// Notification helper
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  Object.assign(notification.style, {
    position: 'fixed', top: '20px', right: '20px', padding: '12px 16px',
    borderRadius: '6px', color: 'white', fontSize: '14px', zIndex: '1000000',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    animation: 'slideIn 0.3s ease',
    background: type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'
  });
  if (type === 'warning') notification.style.color = '#212529';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 4000);
}