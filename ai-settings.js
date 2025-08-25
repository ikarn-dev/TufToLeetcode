document.addEventListener('DOMContentLoaded', function () {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleVisibilityBtn = document.getElementById('toggleVisibility');
  const saveKeyBtn = document.getElementById('saveKey');
  const testKeyBtn = document.getElementById('testKey');
  const clearKeyBtn = document.getElementById('clearKey');
  const statusDiv = document.getElementById('status');
  const keyHistoryList = document.getElementById('keyHistoryList');

  let isKeyVisible = false;

  // Load existing API key and history
  loadApiKey();
  loadKeyHistory();

  // Toast notification system
  function showToast(type, title, message, duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    toastContainer.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      removeToast(toast);
    });

    // Auto remove after duration
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }

  function removeToast(toast) {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // Toggle API key visibility
  toggleVisibilityBtn.addEventListener('click', function () {
    isKeyVisible = !isKeyVisible;
    apiKeyInput.type = isKeyVisible ? 'text' : 'password';

    toggleVisibilityBtn.innerHTML = isKeyVisible ?
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>` :
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`;
  });

  // Save API key
  saveKeyBtn.addEventListener('click', async function () {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showToast('error', 'Validation Error', 'Please enter an API key');
      return;
    }

    // Basic validation for Gemini API key
    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
      showToast('error', 'Invalid Format', 'Gemini API keys start with "AIza" and are at least 30 characters long');
      return;
    }

    saveKeyBtn.disabled = true;
    saveKeyBtn.innerHTML = '<div class="spinner"></div> Saving...';

    try {
      await chrome.storage.local.set({ geminiApiKey: apiKey });
      await saveToHistory(apiKey);
      showToast('success', 'API Key Saved', 'Your Gemini API key has been saved successfully');
      loadKeyHistory(); // Refresh history
    } catch (error) {
      console.error('Error saving API key:', error);
      showToast('error', 'Save Failed', 'Failed to save API key. Please try again.');
    }

    saveKeyBtn.disabled = false;
    saveKeyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17,21 17,13 7,13 7,21"/>
        <polyline points="7,3 7,8 15,8"/>
      </svg>
      Save API Key
    `;
  });

  // Test API key
  testKeyBtn.addEventListener('click', async function () {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key to test', 'error');
      return;
    }

    testKeyBtn.disabled = true;
    testKeyBtn.innerHTML = '<div class="spinner"></div> Testing...';

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Hello, this is a test message. Please respond with "API key is working correctly".'
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 50
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          showToast('success', 'Connection Successful', 'Your Gemini API key is working correctly!');
        } else {
          showToast('info', 'Partial Success', 'API key works but received unexpected response format');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast('error', 'Connection Failed', `API key test failed: ${errorData.error?.message || 'Invalid API key'}`);
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      showToast('error', 'Network Error', 'Failed to test API key. Check your internet connection.');
    }

    testKeyBtn.disabled = false;
    testKeyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Test Connection
    `;
  });

  // Clear API key
  clearKeyBtn.addEventListener('click', async function () {
    if (!confirm('Are you sure you want to clear the saved API key?')) {
      return;
    }

    clearKeyBtn.disabled = true;
    clearKeyBtn.innerHTML = '<div class="spinner"></div> Clearing...';

    try {
      await chrome.storage.local.remove(['geminiApiKey']);
      apiKeyInput.value = '';
      showToast('info', 'API Key Cleared', 'Your API key has been removed from storage');
      loadKeyHistory(); // Refresh history
    } catch (error) {
      console.error('Error clearing API key:', error);
      showToast('error', 'Clear Failed', 'Failed to clear API key. Please try again.');
    }

    clearKeyBtn.disabled = false;
    clearKeyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3,6 5,6 21,6"/>
        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
      </svg>
      Clear Key
    `;
  });

  // Load existing API key
  async function loadApiKey() {
    try {
      const result = await chrome.storage.local.get(['geminiApiKey']);
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        showToast('info', 'API Key Loaded', 'Existing API key loaded from storage', 2000);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  // Save API key to history
  async function saveToHistory(apiKey) {
    try {
      const result = await chrome.storage.local.get(['apiKeyHistory']);
      let history = result.apiKeyHistory || [];

      // Remove if already exists
      history = history.filter(item => item.key !== apiKey);

      // Add to beginning
      history.unshift({
        key: apiKey,
        date: new Date().toISOString(),
        preview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
      });

      // Keep only last 5 keys
      history = history.slice(0, 5);

      await chrome.storage.local.set({ apiKeyHistory: history });
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }

  // Load API key history
  async function loadKeyHistory() {
    try {
      const result = await chrome.storage.local.get(['apiKeyHistory']);
      const history = result.apiKeyHistory || [];

      keyHistoryList.innerHTML = '';

      if (history.length === 0) {
        keyHistoryList.innerHTML = '<div style="text-align: center; color: #6b7280; font-size: 11px; padding: 16px;">No saved API keys</div>';
        return;
      }

      history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'key-history-item';

        const date = new Date(item.date).toLocaleDateString();

        historyItem.innerHTML = `
          <div class="key-preview">${item.preview}</div>
          <div class="key-date">${date}</div>
          <div class="key-actions">
            <button class="key-action-btn use" title="Use this key" data-key="${item.key}">Use</button>
            <button class="key-action-btn delete" title="Remove from history" data-index="${index}">×</button>
          </div>
        `;

        keyHistoryList.appendChild(historyItem);
      });

      // Add event listeners
      keyHistoryList.querySelectorAll('.key-action-btn.use').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const key = e.target.getAttribute('data-key');
          apiKeyInput.value = key;
          showToast('info', 'Key Selected', 'API key loaded from history');
        });
      });

      keyHistoryList.querySelectorAll('.key-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const index = parseInt(e.target.getAttribute('data-index'));
          await removeFromHistory(index);
          loadKeyHistory();
          showToast('info', 'Key Removed', 'API key removed from history');
        });
      });

    } catch (error) {
      console.error('Error loading key history:', error);
    }
  }

  // Remove API key from history
  async function removeFromHistory(index) {
    try {
      const result = await chrome.storage.local.get(['apiKeyHistory']);
      let history = result.apiKeyHistory || [];

      history.splice(index, 1);

      await chrome.storage.local.set({ apiKeyHistory: history });
    } catch (error) {
      console.error('Error removing from history:', error);
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
  }

  // Handle Enter key in API key input
  apiKeyInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      saveKeyBtn.click();
    }
  });
});