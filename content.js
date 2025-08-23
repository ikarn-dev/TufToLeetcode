// Content script to detect LeetCode problems on TakeUForward website
(function() {
  // Check if we're on TakeUForward website
  function isTakeUForwardSite() {
    return window.location.hostname === 'takeuforward.org';
  }

  // Extract problem title from TakeUForward's specific HTML structure
  function extractTakeUForwardTitle() {
    if (!isTakeUForwardSite()) return null;

    // Look for the specific span with problem title
    const titleElement = document.querySelector('span.text-2xl.font-bold.text-new_primary.dark\\:text-new_dark_primary');
    
    if (titleElement) {
      return titleElement.textContent.trim();
    }

    // Fallback: look for any h1 or large text that might be the title
    const fallbackSelectors = [
      'h1',
      '.text-2xl',
      '[class*="text-2xl"]',
      '[class*="font-bold"]'
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 3) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Auto-detect potential LeetCode problem titles on the current page
  function detectProblemTitles() {
    const potentialTitles = [];
    
    // If on TakeUForward, extract the specific title
    if (isTakeUForwardSite()) {
      const takeUForwardTitle = extractTakeUForwardTitle();
      if (takeUForwardTitle) {
        potentialTitles.push(takeUForwardTitle);
        return potentialTitles;
      }
    }

    // Fallback: Common patterns for LeetCode problem titles on other sites
    const titlePatterns = [
      /\b\d+\.\s*([A-Z][a-zA-Z\s]+)/g, // "1. Two Sum" format
      /Problem:\s*([A-Z][a-zA-Z\s]+)/gi, // "Problem: Two Sum" format
      /LeetCode\s*\d+[:\-\s]*([A-Z][a-zA-Z\s]+)/gi // "LeetCode 1: Two Sum" format
    ];

    const textContent = document.body.innerText;
    
    titlePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(textContent)) !== null) {
        const title = match[1].trim();
        if (title.length > 3 && title.length < 100) {
          potentialTitles.push(title);
        }
      }
    });

    return [...new Set(potentialTitles)]; // Remove duplicates
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detectTitles') {
      const titles = detectProblemTitles();
      sendResponse({ titles });
    }
  });

  // Highlight detected problem titles (optional feature)
  function highlightProblemTitles() {
    const titles = detectProblemTitles();
    if (titles.length === 0) return;

    titles.forEach(title => {
      const regex = new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        if (regex.test(node.textContent)) {
          textNodes.push(node);
        }
      }

      textNodes.forEach(textNode => {
        const parent = textNode.parentNode;
        if (parent && !parent.classList.contains('leetcode-highlight')) {
          const highlightedText = textNode.textContent.replace(regex, 
            `<span class="leetcode-highlight" style="background-color: #fff3cd; padding: 2px 4px; border-radius: 3px; cursor: pointer;" title="Click to search LeetCode">$&</span>`
          );
          
          const wrapper = document.createElement('span');
          wrapper.innerHTML = highlightedText;
          parent.replaceChild(wrapper, textNode);
        }
      });
    });
  }

  // Add click handlers for highlighted titles
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('leetcode-highlight')) {
      const title = e.target.textContent.trim();
      chrome.runtime.sendMessage({
        action: 'searchProblem',
        title: title
      });
    }
  });

  // Show refresh option when problem title is not detected
  function showRefreshOption(button) {
    // Create refresh button container
    const refreshContainer = document.createElement('div');
    refreshContainer.id = 'leetcode-refresh-container';
    refreshContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: 8px;
      vertical-align: middle;
    `;

    // Update main button to show error state
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" fill="none"/>
        <path d="M15 9l-6 6" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M9 9l6 6" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    `;
    button.style.background = '#ef4444';
    button.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    button.style.opacity = '1';
    button.title = 'Problem not detected on this page';
    button.disabled = true;

    // Create refresh button
    const refreshButton = document.createElement('button');
    refreshButton.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23,4 23,10 17,10"/>
        <polyline points="1,20 1,14 7,14"/>
        <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"/>
      </svg>
    `;
    
    refreshButton.style.cssText = `
      background: #f59e0b;
      color: #ffffff;
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
      opacity: 0.9;
    `;

    refreshButton.title = 'Refresh page to detect problem title';

    // Add hover effects for refresh button
    refreshButton.addEventListener('mouseenter', () => {
      refreshButton.style.background = '#d97706';
      refreshButton.style.opacity = '1';
      refreshButton.style.transform = 'scale(1.05)';
    });

    refreshButton.addEventListener('mouseleave', () => {
      refreshButton.style.background = '#f59e0b';
      refreshButton.style.opacity = '0.9';
      refreshButton.style.transform = 'scale(1)';
    });

    // Add click handler for refresh
    refreshButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Show loading state
      refreshButton.innerHTML = `
        <div style="width: 10px; height: 10px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      `;
      refreshButton.disabled = true;
      refreshButton.style.background = '#d97706';
      
      // Refresh the page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    });

    // Add refresh button to container
    refreshContainer.appendChild(refreshButton);
    
    // Insert refresh container after the main button
    button.parentNode.insertBefore(refreshContainer, button.nextSibling);

    // Auto-remove refresh option after 10 seconds and reset main button
    setTimeout(() => {
      if (refreshContainer && refreshContainer.parentNode) {
        refreshContainer.parentNode.removeChild(refreshContainer);
      }
      
      // Reset main button
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
      `;
      button.style.background = '#3b82f6';
      button.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      button.style.opacity = '0.8';
      button.title = 'Find this problem on LeetCode';
      button.disabled = false;
    }, 10000);
  }

  // Create subtle button next to the title for TakeUForward pages
  function createTakeUForwardButton() {
    if (!isTakeUForwardSite()) return;

    // Check if button already exists
    if (document.getElementById('leetcode-finder-btn')) return;

    // Find the title element to position button next to it
    const titleElement = document.querySelector('span.text-2xl.font-bold.text-new_primary.dark\\:text-new_dark_primary');
    if (!titleElement) return;

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      margin-left: 12px;
      vertical-align: middle;
    `;

    const button = document.createElement('button');
    button.id = 'leetcode-finder-btn';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    `;
    
    // Style the button - compact and minimal
    button.style.cssText = `
      background: #3b82f6;
      color: #ffffff;
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
      opacity: 0.8;
    `;

    // Add hover effects
    button.addEventListener('mouseenter', () => {
      button.style.background = '#2563eb';
      button.style.opacity = '1';
      button.style.transform = 'scale(1.05)';
      button.title = 'Find this problem on LeetCode';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#3b82f6';
      button.style.opacity = '0.8';
      button.style.transform = 'scale(1)';
    });

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const title = extractTakeUForwardTitle();
      if (title) {
        // Show loading state
        button.innerHTML = `
          <div style="width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        `;
        button.disabled = true;
        button.style.background = '#6366f1';
        button.style.opacity = '1';

        // Send message to background script
        chrome.runtime.sendMessage({
          action: 'searchProblem',
          title: title
        });

        // Reset button after 2 seconds
        setTimeout(() => {
          button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
          `;
          button.disabled = false;
          button.style.background = '#3b82f6';
          button.style.opacity = '0.8';
        }, 2000);
      } else {
        // Show refresh option when problem not detected
        showRefreshOption(button);
      }
    });

    // Add CSS animation for spinner
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Add button to container and insert next to title
    buttonContainer.appendChild(button);
    titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
  }

  // Initialize based on site
  if (isTakeUForwardSite()) {
    // For TakeUForward, create the floating button
    setTimeout(createTakeUForwardButton, 1000);
  } else {
    // For other sites, use the highlighting feature
    setTimeout(highlightProblemTitles, 2000);
  }
})();