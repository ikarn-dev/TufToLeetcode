// Content script to detect LeetCode problems on TakeUForward website
(function() {
  console.log('TufToLeetcode content script loaded on:', window.location.href);
  
  // Check if we're on TakeUForward website
  function isTakeUForwardSite() {
    const isTuf = window.location.hostname === 'takeuforward.org';
    console.log('Is TakeUForward site:', isTuf);
    return isTuf;
  }

  // Extract problem title from TakeUForward's specific HTML structure
  function extractTakeUForwardTitle() {
    if (!isTakeUForwardSite()) return null;

    // Multiple selectors to try for the title
    const titleSelectors = [
      'span.text-2xl.font-bold.text-new_primary.dark\\:text-new_dark_primary',
      'span.text-2xl.font-bold',
      '.text-2xl.font-bold',
      'h1.text-2xl',
      'h1',
      '[class*="text-2xl"][class*="font-bold"]',
      '.text-2xl',
      '[class*="font-bold"]'
    ];

    for (const selector of titleSelectors) {
      try {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          const title = titleElement.textContent.trim();
          // Validate that this looks like a problem title
          if (title.length > 3 && title.length < 100 && !title.includes('TakeUForward')) {
            console.log('Found title with selector:', selector, 'Title:', title);
            return title;
          }
        }
      } catch (e) {
        console.log('Error with selector:', selector, e);
      }
    }

    // Last resort: look for any text that looks like a problem title
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const text = element.textContent?.trim();
      if (text && text.length > 5 && text.length < 100) {
        // Check if it looks like a problem title (starts with capital, has spaces)
        if (/^[A-Z][a-zA-Z\s]+$/.test(text) && !text.includes('TakeUForward') && !text.includes('Login')) {
          console.log('Found potential title:', text);
          return text;
        }
      }
    }

    return null;
  }

  // Extract problem description from TakeUForward's HTML structure
  function extractTakeUForwardDescription() {
    if (!isTakeUForwardSite()) return null;

    // Look for the problem description in various possible containers
    const descriptionSelectors = [
      '.text-new_secondary.text-\\[14px\\].dark\\:text-zinc-200 p',
      '.mt-6.w-full.text-new_secondary.text-\\[14px\\].dark\\:text-zinc-200',
      '[class*="text-new_secondary"][class*="text-[14px]"]',
      '.problem-description',
      '.description'
    ];

    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        let description = element.innerHTML || element.textContent;
        // Clean up the description
        description = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (description.length > 50) {
          return description;
        }
      }
    }

    // Fallback: look for any div that contains problem-like text
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent.trim();
      if (text.length > 100 && text.length < 2000 && 
          (text.includes('Given') || text.includes('Return') || text.includes('Find'))) {
        return text;
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
    } else if (request.action === 'extractProblemData') {
      const title = extractTakeUForwardTitle();
      const description = extractTakeUForwardDescription();
      sendResponse({ title, description });
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

    // Check if our button already exists
    if (document.getElementById('tuf-to-leetcode-btn')) return;
    
    // Also check for any existing leetcode helper buttons and remove them to avoid conflicts
    const existingButtons = document.querySelectorAll('.leetcode-helper-title-btn, #leetcode-finder-btn');
    existingButtons.forEach(btn => btn.remove());

    // Find the title element to position button next to it
    const titleSelectors = [
      'span.text-2xl.font-bold.text-new_primary.dark\\:text-new_dark_primary',
      'span.text-2xl.font-bold',
      '.text-2xl.font-bold',
      'h1.text-2xl',
      'h1',
      '[class*="text-2xl"][class*="font-bold"]'
    ];

    let titleElement = null;
    for (const selector of titleSelectors) {
      try {
        titleElement = document.querySelector(selector);
        if (titleElement) {
          console.log('Found title element with selector:', selector);
          break;
        }
      } catch (e) {
        console.log('Error with title selector:', selector, e);
      }
    }

    if (!titleElement) {
      console.log('No title element found, will retry...');
      return;
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      margin-left: 12px;
      vertical-align: middle;
    `;

    const button = document.createElement('button');
    button.id = 'tuf-to-leetcode-btn';
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
      const description = extractTakeUForwardDescription();
      
      if (title || description) {
        // Show loading state
        button.innerHTML = `
          <div style="width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        `;
        button.disabled = true;
        button.style.background = '#6366f1';
        button.style.opacity = '1';

        // Send message to background script with both title and description
        chrome.runtime.sendMessage({
          action: 'searchProblem',
          title: title,
          description: description
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
    
    try {
      // Try different positioning strategies
      if (titleElement.nextSibling) {
        titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
      } else {
        titleElement.parentNode.appendChild(buttonContainer);
      }
      console.log('Button successfully added to page');
    } catch (e) {
      console.error('Error inserting button:', e);
      
      // Fallback: try appending to title element's parent
      try {
        titleElement.parentNode.appendChild(buttonContainer);
        console.log('Button added using fallback method');
      } catch (e2) {
        console.error('Fallback button insertion failed:', e2);
        
        // Last resort: add to body with fixed positioning
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '20px';
        buttonContainer.style.right = '20px';
        buttonContainer.style.zIndex = '9999';
        document.body.appendChild(buttonContainer);
        console.log('Button added with fixed positioning');
      }
    }
  }

  // Initialize based on site with multiple retry attempts
  if (isTakeUForwardSite()) {
    console.log('TakeUForward site detected, initializing button...');
    
    // Try multiple times with increasing delays to handle dynamic content
    const retryAttempts = [500, 1000, 2000, 3000, 5000];
    
    retryAttempts.forEach((delay, index) => {
      setTimeout(() => {
        console.log(`Attempt ${index + 1} to create button after ${delay}ms`);
        createTakeUForwardButton();
      }, delay);
    });

    // Also try when DOM changes (for dynamic content)
    const observer = new MutationObserver((mutations) => {
      let shouldRetry = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldRetry = true;
        }
      });
      
      if (shouldRetry && !document.getElementById('leetcode-finder-btn')) {
        console.log('DOM changed, retrying button creation...');
        setTimeout(createTakeUForwardButton, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Stop observing after 30 seconds
    setTimeout(() => {
      observer.disconnect();
    }, 30000);
  } else {
    // For other sites, use the highlighting feature
    setTimeout(highlightProblemTitles, 2000);
  }
})();