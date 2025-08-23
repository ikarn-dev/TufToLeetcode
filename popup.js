document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const problemTitle = document.getElementById('problemTitle');
  const result = document.getElementById('result');

  // Check if we're on TakeUForward and show prompt if not
  checkCurrentSite();

  // Load statistics on startup
  loadStatistics();

  // Check for pending search from background script
  chrome.storage.local.get(['pendingSearch'], function (data) {
    if (data.pendingSearch) {
      problemTitle.value = data.pendingSearch;
      chrome.storage.local.remove(['pendingSearch']);
      searchProblem();
    }
  });

  searchBtn.addEventListener('click', searchProblem);

  problemTitle.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      searchProblem();
    }
  });

  async function checkCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url && tab.url.includes('takeuforward.org')) {
        // User is on TakeUForward - check if we can detect titles
        checkTitleDetection(tab);
      } else {
        // Show TakeUForward prompt for enhanced experience
        showTakeUForwardPrompt();
      }
    } catch (error) {
      // Unable to check current site - no action needed
    }
  }

  async function checkTitleDetection(tab) {
    try {
      // Try to detect titles on the current TakeUForward page
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'detectTitles' });

      if (!response || !response.titles || response.titles.length === 0) {
        // No titles detected - show refresh option
        showRefreshOption();
      }
    } catch (error) {
      // Content script might not be loaded or page not ready - show refresh option
      showRefreshOption();
    }
  }

  function showRefreshOption() {
    const refreshHTML = `
      <div style="text-align: center; padding: 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #3b82f6; margin-bottom: 8px; font-weight: 500;">
          Problem Title Not Detected
        </div>
        <div style="font-size: 10px; color: #9ca3af; line-height: 1.4; margin-bottom: 8px;">
          The page might still be loading or the problem title isn't visible yet.
        </div>
        <button id="refreshPageBtn" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: #3b82f6; color: white; text-decoration: none; border: none; border-radius: 4px; font-size: 11px; font-weight: 500; cursor: pointer;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,4 23,10 17,10"/>
            <polyline points="1,20 1,14 7,14"/>
            <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"/>
          </svg>
          Refresh Page
        </button>
      </div>
    `;

    result.innerHTML = refreshHTML;
    result.className = 'result';
    result.style.display = 'block';
    result.style.background = 'transparent';
    result.style.border = 'none';
    result.style.padding = '0';

    // Add click handler for refresh button
    document.getElementById('refreshPageBtn').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.reload(tab.id);
        window.close(); // Close popup after refreshing
      } catch (error) {
        console.error('Failed to refresh page:', error);
      }
    });
  }

  function showTakeUForwardPrompt() {
    const promptHTML = `
      <div style="text-align: center; padding: 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #f59e0b; margin-bottom: 8px; font-weight: 500;">
          Enhanced Experience Available
        </div>
        <div style="font-size: 10px; color: #9ca3af; line-height: 1.4; margin-bottom: 8px;">
          Visit TakeUForward to use the search button next to problem titles for instant LeetCode lookup.
        </div>
        <a href="https://takeuforward.org/plus/dsa/problems-set" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: #f59e0b; color: white; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 500;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Visit TakeUForward
        </a>
      </div>
    `;

    result.innerHTML = promptHTML;
    result.className = 'result';
    result.style.display = 'block';
    result.style.background = 'transparent';
    result.style.border = 'none';
    result.style.padding = '0';
  }



  async function searchProblem() {
    const title = problemTitle.value.trim();
    if (!title) {
      showResult('Please enter a LeetCode problem title to search', 'error');
      return;
    }

    searchBtn.innerHTML = `
      <div style="width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      Searching...
    `;
    searchBtn.disabled = true;

    try {
      const problemData = await findLeetCodeProblem(title);
      if (problemData) {
        showProblemResult(problemData);
      } else {
        showNotFoundResult(title);
      }
    } catch (error) {
      showResult('Search failed. Please check your internet connection and try again.', 'error');
    }

    searchBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="10" cy="10" r="7" stroke="currentColor" fill="none"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-linecap="round"/>
        <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.3"/>
        <path d="M7 10h6M10 7v6" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
      </svg>
      Search
    `;
    searchBtn.disabled = false;
  }

  function showProblemResult(problemData) {
    const premiumBadge = problemData.paid_only ? '<span class="premium-badge">Premium</span>' : '<span class="free-badge">Free</span>';

    const resultHTML = `
      <div class="problem-card">
        <div class="problem-title">
          #${problemData.id}. ${problemData.title}
        </div>
        <div class="problem-meta">
          ${premiumBadge}
          <a href="${problemData.url}" target="_blank" class="problem-link">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15,3 21,3 21,9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open
          </a>
        </div>
      </div>
    `;

    result.innerHTML = resultHTML;
    result.className = 'result success';
    result.style.display = 'block';
  }

  function showResult(message, type) {
    result.innerHTML = `<div style="text-align: center; padding: 8px; font-size: 11px;">${message}</div>`;
    result.className = `result ${type}`;
    result.style.display = 'block';

    // Auto-hide error messages after 2 seconds
    if (type === 'error') {
      setTimeout(() => {
        result.style.display = 'none';
      }, 2000);
    }
  }

  function showNotFoundResult(searchTerm) {
    const cleanTitle = searchTerm.replace(/^\d+\.\s*/, '').replace(/^Problem:\s*/i, '').trim();

    const notFoundHTML = `
      <div style="text-align: center; padding: 12px;">
        <div style="margin-bottom: 8px; font-weight: 500; font-size: 12px;">
          "${cleanTitle}" not found on LeetCode
        </div>
        <div style="font-size: 10px; color: #9ca3af; line-height: 1.4;">
          This problem might not exist on LeetCode, or it could be:
          <br>• A concept/algorithm (not a specific LeetCode problem)
          <br>• Available on other platforms only
          <br>• Named differently on LeetCode
        </div>
        <div style="margin-top: 8px; font-size: 10px; color: #6b7280;">
          Try searching for related LeetCode problems manually.
        </div>
      </div>
    `;

    result.innerHTML = notFoundHTML;
    result.className = 'result error';
    result.style.display = 'block';

    // Auto-hide after 2 seconds
    setTimeout(() => {
      result.style.display = 'none';
    }, 2000);
  }

  async function loadStatistics() {
    const statsContent = document.getElementById('statsContent');

    try {
      // Get statistics from background script
      const stats = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getStatistics'
        }, (response) => {
          resolve(response);
        });
      });

      if (stats) {
        displayStatistics(stats);
      } else {
        statsContent.innerHTML = '<div style="color: #ef4444;">Failed to load statistics</div>';
      }
    } catch (error) {
      statsContent.innerHTML = '<div style="color: #ef4444;">Error loading statistics</div>';
    }
  }

  function displayStatistics(stats) {
    const statsContent = document.getElementById('statsContent');

    const statsHTML = `
      <div class="stats-grid">
        <div class="stat-badge stat-total">
          ${stats.total} Total
        </div>
        <div class="stat-badge stat-free">
          ${stats.free} Free
        </div>
        <div class="stat-badge stat-premium">
          ${stats.premium} Premium
        </div>
      </div>
    `;

    statsContent.innerHTML = statsHTML;
  }

  async function findLeetCodeProblem(title) {
    // Use background script to make API calls to avoid CORS issues
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'findProblem',
        title: title
      }, (response) => {
        resolve(response);
      });
    });
  }
});