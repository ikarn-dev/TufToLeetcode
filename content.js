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
      const problemData = detectProblemData();
      sendResponse(problemData);
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

  // Function to detect problem data without creating UI elements
  function detectProblemData() {
    if (!isTakeUForwardSite()) return null;

    const title = extractTakeUForwardTitle();
    const description = extractTakeUForwardDescription();
    
    return { title, description };
  }

  // Load AI overlay CSS
  function loadAIOverlayCSS() {
    if (document.getElementById('ai-overlay-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'ai-overlay-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('ai-overlay.css');
    document.head.appendChild(link);
  }

  // Toast notification system for content script
  function showContentToast(type, message, duration = 3000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.content-toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `content-toast content-toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  // Show AI analysis overlay
  async function showAIAnalysis(title, description) {
    // Load CSS if not already loaded
    loadAIOverlayCSS();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'ai-overlay';
    overlay.innerHTML = `
      <div class="ai-modal">
        <div class="ai-modal-header">
          <div class="ai-modal-title">
AI Problem Analysis
          </div>
          <button class="ai-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="ai-modal-content">
          <div class="ai-loading">
            <div class="ai-loading-spinner"></div>
            <div class="ai-loading-text">
              Analyzing problem with AI...<br>
              <small>Finding LeetCode links and similar problems</small>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add close handlers
    const closeBtn = overlay.querySelector('.ai-modal-close');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Escape key to close
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Perform AI analysis
    try {
      showContentToast('info', 'Analyzing problem with AI...', 2000);
      
      // Send AI analysis request to background script
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'analyzeWithAI',
          title: title,
          description: description
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error('Invalid response from AI service'));
          }
        });
      });
      
      showContentToast('success', 'AI analysis completed successfully!');
      
      // Update modal content with results
      const modalContent = overlay.querySelector('.ai-modal-content');
      modalContent.innerHTML = formatAIResponse(result);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      
      // Show error in modal
      const modalContent = overlay.querySelector('.ai-modal-content');
      
      let errorMessage = error.message;
      let showSettingsLink = false;
      
      // Handle specific error types
      if (error.message.includes('API key') || error.message.includes('not configured')) {
        errorMessage = 'AI analysis requires a Gemini API key. Please configure your API key to use this feature.';
        showSettingsLink = true;
        showContentToast('error', 'API key not configured');
      } else if (error.message.includes('AI Handler failed to load')) {
        errorMessage = 'AI system failed to initialize. Please refresh the page and try again.';
        showContentToast('error', 'AI system initialization failed');
      } else if (error.message.includes('API request failed')) {
        errorMessage = 'AI service is temporarily unavailable. Please check your internet connection and try again.';
        showContentToast('error', 'AI service unavailable');
      } else if (error.message.includes('Invalid API key')) {
        errorMessage = 'Your API key appears to be invalid. Please check your Gemini API key configuration.';
        showSettingsLink = true;
        showContentToast('error', 'Invalid API key');
      } else {
        showContentToast('error', 'AI analysis failed');
      }
      
      modalContent.innerHTML = `
        <div class="ai-error">
          <h3>AI Analysis Unavailable</h3>
          <p>${errorMessage}</p>
          ${showSettingsLink ? 
            '<p><a href="#" id="openAISettings" style="color: #3b82f6; text-decoration: underline; cursor: pointer;">Configure AI Settings</a></p>' : 
            ''
          }
          <div style="margin-top: 12px; padding: 8px; background: rgba(59, 130, 246, 0.1); border-radius: 4px; font-size: 11px; color: #9ca3af;">
            <strong>How to get an API key:</strong><br>
            1. Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #3b82f6;">Google AI Studio</a><br>
            2. Create a Gemini API key<br>
            3. Configure it in the extension settings
          </div>
        </div>
      `;

      // Add click handler for AI settings link
      const settingsLink = modalContent.querySelector('#openAISettings');
      if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.runtime.sendMessage({ action: 'openAISettings' });
          overlay.remove();
        });
      }
    }
  }

  // Show AI error message
  function showAIError(message) {
    loadAIOverlayCSS();

    const overlay = document.createElement('div');
    overlay.className = 'ai-overlay';
    overlay.innerHTML = `
      <div class="ai-modal">
        <div class="ai-modal-header">
          <div class="ai-modal-title">
AI Analysis
          </div>
          <button class="ai-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="ai-modal-content">
          <div class="ai-error">
            <h3>Analysis Not Available</h3>
            <p>${message}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add close handlers
    const closeBtn = overlay.querySelector('.ai-modal-close');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Auto-close after 3 seconds
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
    }, 3000);
  }

  // AI Handler is not needed in content script since we use background script for AI processing

  // Format AI response for display
  function formatAIResponse(aiData) {
    if (aiData.error) {
      return `
        <div class="ai-error">
          <h3>AI Response (Raw)</h3>
          <p>${aiData.raw_response}</p>
        </div>
      `;
    }

    let html = '<div class="ai-response">';

    // LeetCode Link - PRIORITIZED FIRST
    if (aiData.leetcode_link) {
      html += `
        <div class="ai-section">
          <h3>🎯 LeetCode Problem</h3>
          <a href="${aiData.leetcode_link}" target="_blank" class="ai-link primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15,3 21,3 21,9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open on LeetCode
          </a>
        </div>
      `;
    }

    // Similar LeetCode Problems - Show ALL problems (should be LeetCode only now)
    if (aiData.similar_problems && aiData.similar_problems.length > 0) {
      html += `
        <div class="ai-section">
          <h3>🎯 Similar LeetCode Problems</h3>
          <div class="similar-problems">
      `;
      aiData.similar_problems.forEach(problem => {
        html += `
          <div class="problem-item">
            <span class="problem-title">${problem.title}</span>
            <span class="problem-platform leetcode-platform">LeetCode</span>
            <span class="problem-difficulty ${problem.difficulty?.toLowerCase()}">${problem.difficulty}</span>
            ${problem.link ? `<a href="${problem.link}" target="_blank" class="ai-link">Open</a>` : ''}
          </div>
        `;
      });
      html += '</div></div>';
    } else if (!aiData.leetcode_link) {
      // Show message when no LeetCode problems found
      html += `
        <div class="ai-section">
          <h3>🔍 LeetCode Search</h3>
          <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
            No matching LeetCode problems found for this specific problem.
            <br>Try searching manually on <a href="https://leetcode.com/problemset/" target="_blank" style="color: #3b82f6;">LeetCode</a>.
          </div>
        </div>
      `;
    }

    // No alternative platforms - LeetCode only focus

    // Platform links only - video functionality removed

    // Topics and Complexity
    if (aiData.topics || aiData.difficulty_estimate || aiData.complexity_analysis || aiData.time_complexity || aiData.space_complexity) {
      html += '<div class="ai-section"><h3>Analysis</h3><div class="analysis-grid">';
      
      if (aiData.topics && aiData.topics.length > 0) {
        html += `
          <div class="analysis-item">
            <span class="analysis-label">Topics:</span>
            <div class="topic-tags">
              ${aiData.topics.map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
            </div>
          </div>
        `;
      }

      if (aiData.difficulty_estimate) {
        html += `
          <div class="analysis-item">
            <span class="analysis-label">Difficulty:</span>
            <span class="difficulty-badge ${aiData.difficulty_estimate.toLowerCase()}">${aiData.difficulty_estimate}</span>
          </div>
        `;
      }

      // Combined Time & Space Complexity in same section
      const timeComplexity = aiData.complexity_analysis?.time || aiData.time_complexity;
      const spaceComplexity = aiData.complexity_analysis?.space || aiData.space_complexity;
      
      if (timeComplexity || spaceComplexity) {
        html += `
          <div class="analysis-item">
            <span class="analysis-label">⚡ Complexity:</span>
            <div class="complexity-container">
              ${timeComplexity ? `<div class="complexity-item"><span class="complexity-type">Time:</span> <span class="complexity">${timeComplexity}</span></div>` : ''}
              ${spaceComplexity ? `<div class="complexity-item"><span class="complexity-type">Space:</span> <span class="complexity">${spaceComplexity}</span></div>` : ''}
            </div>
          </div>
        `;
      }

      html += '</div></div>';
    }



    html += '</div>';
    return html;
  }

  // AI processing is handled by background script - no initialization needed here

  // Check if we're on an individual problem page (not the problems list)
  function isIndividualProblemPage() {
    // Check URL pattern for individual problem pages
    const url = window.location.href;
    
    // Individual problem pages typically have URLs like:
    // https://takeuforward.org/plus/dsa/problems/word-break
    // https://takeuforward.org/plus/dsa/problems/[problem-name]
    const isIndividualProblem = url.includes('/plus/dsa/problems/') && 
                               !url.endsWith('/problems') && 
                               !url.includes('/problems?') &&
                               !url.includes('/problems#');
    
    // Also check if there's a problem description present (another indicator)
    const hasDescription = extractTakeUForwardDescription() !== null;
    
    return isIndividualProblem && hasDescription;
  }

  // Create search button next to the title for individual problem pages only
  function createTakeUForwardButton() {
    if (!isTakeUForwardSite() || !isIndividualProblemPage()) return;

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

    // Create AI button
    const aiButton = document.createElement('button');
    aiButton.id = 'tuf-ai-btn';
    aiButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 32 32">
        <radialGradient id="aiGrad1" cx="242.011" cy="49.827" r=".028" gradientTransform="matrix(128.602 652.9562 653.274 -128.6646 -63653.82 -151597.453)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#1ba1e3"></stop>
          <stop offset="0" stop-color="#1ba1e3"></stop>
          <stop offset=".3" stop-color="#5489d6"></stop>
          <stop offset=".545" stop-color="#9b72cb"></stop>
          <stop offset=".825" stop-color="#d96570"></stop>
          <stop offset="1" stop-color="#f49c46"></stop>
        </radialGradient>
        <path fill="url(#aiGrad1)" d="M15.304,21.177l-1.203,2.756c-0.463,1.06-1.929,1.06-2.391,0l-1.203-2.756c-1.071-2.453-2.999-4.406-5.403-5.473l-3.313-1.47c-1.053-0.467-1.053-2,0-2.467l3.209-1.424c2.466-1.095,4.429-3.12,5.481-5.656L11.7,1.748c0.452-1.09,1.959-1.09,2.411,0l1.219,2.938c1.053,2.537,3.015,4.562,5.481,5.656l3.209,1.424c1.053,0.467,1.053,2,0,2.467l-3.313,1.47C18.303,16.771,16.375,18.724,15.304,21.177z"/>
        <radialGradient id="aiGrad2" cx="242.011" cy="49.827" r=".028" gradientTransform="matrix(128.602 652.9562 653.274 -128.6646 -63653.82 -151597.453)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#1ba1e3"></stop>
          <stop offset="0" stop-color="#1ba1e3"></stop>
          <stop offset=".3" stop-color="#5489d6"></stop>
          <stop offset=".545" stop-color="#9b72cb"></stop>
          <stop offset=".825" stop-color="#d96570"></stop>
          <stop offset="1" stop-color="#f49c46"></stop>
        </radialGradient>
        <path fill="url(#aiGrad2)" d="M26.488,29.868l-0.338,0.776c-0.248,0.568-1.034,0.568-1.282,0l-0.338-0.776c-0.603-1.383-1.69-2.484-3.046-3.087l-1.043-0.463c-0.564-0.25-0.564-1.07,0-1.321l0.984-0.437c1.391-0.618,2.497-1.76,3.09-3.19l0.348-0.838c0.242-0.584,1.05-0.584,1.292,0l0.348,0.838c0.593,1.43,1.699,2.572,3.09,3.19l0.984,0.437c0.564,0.251,0.564,1.07,0,1.321l-1.043,0.463C28.178,27.384,27.092,28.485,26.488,29.868z"/>
      </svg>
    `;
    
    // Style the AI button
    aiButton.style.cssText = `
      background: transparent;
      color: #ffffff;
      border: none;
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
      opacity: 0.9;
      margin-left: 8px;
    `;

    // Add hover effects for AI button
    aiButton.addEventListener('mouseenter', () => {
      aiButton.style.background = 'rgba(139, 92, 246, 0.1)';
      aiButton.style.opacity = '1';
      aiButton.style.transform = 'scale(1.1)';
      aiButton.title = 'Analyze with AI';
    });

    aiButton.addEventListener('mouseleave', () => {
      aiButton.style.background = 'transparent';
      aiButton.style.opacity = '0.9';
      aiButton.style.transform = 'scale(1)';
    });

    // Add click handler for AI button
    aiButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const title = extractTakeUForwardTitle();
      const description = extractTakeUForwardDescription();
      
      if (title || description) {
        // Show loading state
        aiButton.innerHTML = `
          <div style="width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        `;
        aiButton.disabled = true;
        aiButton.style.background = 'rgba(139, 92, 246, 0.2)';
        aiButton.style.opacity = '1';

        // Show AI overlay and analyze
        showAIAnalysis(title, description).catch(error => {
          console.error('AI Analysis failed:', error);
        }).finally(() => {
          // Reset button after analysis completes (success or failure)
          setTimeout(() => {
            aiButton.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 32 32">
                <radialGradient id="aiGradReset1" cx="242.011" cy="49.827" r=".028" gradientTransform="matrix(128.602 652.9562 653.274 -128.6646 -63653.82 -151597.453)" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#1ba1e3"></stop>
                  <stop offset="0" stop-color="#1ba1e3"></stop>
                  <stop offset=".3" stop-color="#5489d6"></stop>
                  <stop offset=".545" stop-color="#9b72cb"></stop>
                  <stop offset=".825" stop-color="#d96570"></stop>
                  <stop offset="1" stop-color="#f49c46"></stop>
                </radialGradient>
                <path fill="url(#aiGradReset1)" d="M15.304,21.177l-1.203,2.756c-0.463,1.06-1.929,1.06-2.391,0l-1.203-2.756c-1.071-2.453-2.999-4.406-5.403-5.473l-3.313-1.47c-1.053-0.467-1.053-2,0-2.467l3.209-1.424c2.466-1.095,4.429-3.12,5.481-5.656L11.7,1.748c0.452-1.09,1.959-1.09,2.411,0l1.219,2.938c1.053,2.537,3.015,4.562,5.481,5.656l3.209,1.424c1.053,0.467,1.053,2,0,2.467l-3.313,1.47C18.303,16.771,16.375,18.724,15.304,21.177z"/>
                <radialGradient id="aiGradReset2" cx="242.011" cy="49.827" r=".028" gradientTransform="matrix(128.602 652.9562 653.274 -128.6646 -63653.82 -151597.453)" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#1ba1e3"></stop>
                  <stop offset="0" stop-color="#1ba1e3"></stop>
                  <stop offset=".3" stop-color="#5489d6"></stop>
                  <stop offset=".545" stop-color="#9b72cb"></stop>
                  <stop offset=".825" stop-color="#d96570"></stop>
                  <stop offset="1" stop-color="#f49c46"></stop>
                </radialGradient>
                <path fill="url(#aiGradReset2)" d="M26.488,29.868l-0.338,0.776c-0.248,0.568-1.034,0.568-1.282,0l-0.338-0.776c-0.603-1.383-1.69-2.484-3.046-3.087l-1.043-0.463c-0.564-0.25-0.564-1.07,0-1.321l0.984-0.437c1.391-0.618,2.497-1.76,3.09-3.19l0.348-0.838c0.242-0.584,1.05-0.584,1.292,0l0.348,0.838c0.593,1.43,1.699,2.572,3.09,3.19l0.984,0.437c0.564,0.251,0.564,1.07,0,1.321l-1.043,0.463C28.178,27.384,27.092,28.485,26.488,29.868z"/>
              </svg>
            `;
            aiButton.disabled = false;
            aiButton.style.background = 'transparent';
            aiButton.style.opacity = '0.9';
          }, 500);
        });
      } else {
        // Show error message
        showAIError('Problem title or description not detected on this page.');
      }
    });

    // Add buttons to container and insert next to title
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(aiButton);
    
    try {
      // Try different positioning strategies
      if (titleElement.nextSibling) {
        titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
      } else {
        titleElement.parentNode.appendChild(buttonContainer);
      }
      console.log('Buttons successfully added to page');
    } catch (e) {
      console.error('Error inserting buttons:', e);
      
      // Fallback: try appending to title element's parent
      try {
        titleElement.parentNode.appendChild(buttonContainer);
        console.log('Buttons added using fallback method');
      } catch (e2) {
        console.error('Fallback button insertion failed:', e2);
        
        // Last resort: add to body with fixed positioning
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '20px';
        buttonContainer.style.right = '20px';
        buttonContainer.style.zIndex = '9999';
        document.body.appendChild(buttonContainer);
        console.log('Buttons added with fixed positioning');
      }
    }
  }

  // Initialize based on site with targeted button creation
  if (isTakeUForwardSite()) {
    console.log('TakeUForward site detected, checking for individual problem page...');
    
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
      
      if (shouldRetry && !document.getElementById('tuf-to-leetcode-btn')) {
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