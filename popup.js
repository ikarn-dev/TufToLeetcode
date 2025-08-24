document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const toggleDescriptionBtn = document.getElementById('toggleDescriptionBtn');
  const descriptionSection = document.getElementById('descriptionSection');
  const problemTitle = document.getElementById('problemTitle');
  const problemDescription = document.getElementById('problemDescription');
  const result = document.getElementById('result');

  // Check if we're on TakeUForward and show prompt if not
  checkCurrentSite();

  // Load statistics and daily problem on startup
  loadStatistics();
  loadDailyProblem();

  // Check for pending search from background script
  chrome.storage.local.get(['pendingSearch', 'pendingDescription'], function (data) {
    if (data.pendingSearch) {
      problemTitle.value = data.pendingSearch;
      chrome.storage.local.remove(['pendingSearch']);
      
      // If we also have a description, show both sections and populate description
      if (data.pendingDescription) {
        chrome.storage.local.remove(['pendingDescription']);
        
        // Show description section
        descriptionSection.style.display = 'block';
        toggleDescriptionBtn.classList.add('active');
        toggleDescriptionBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Hide Description Search
        `;
        
        // Populate description
        problemDescription.value = data.pendingDescription;
        
        // Try title search first, then description analysis
        searchProblemWithDescription(data.pendingSearch, data.pendingDescription);
      } else {
        searchProblem();
      }
    }
  });

  searchBtn.addEventListener('click', searchProblem);
  analyzeBtn.addEventListener('click', analyzeDescription);
  
  // Add event listener with error handling
  if (toggleDescriptionBtn) {
    toggleDescriptionBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Toggle button clicked'); // Debug log
      toggleDescriptionSearch();
    });
  } else {
    console.error('Toggle description button not found');
  }

  problemTitle.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      searchProblem();
    }
  });

  problemDescription.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && e.ctrlKey) {
      analyzeDescription();
    }
  });

  // Toggle description search functionality
  function toggleDescriptionSearch() {
    console.log('toggleDescriptionSearch called'); // Debug log
    
    if (!descriptionSection) {
      console.error('Description section not found');
      return;
    }
    
    // Check if section is currently visible - use a more reliable method
    const isCurrentlyHidden = descriptionSection.style.display === 'none' || 
                             window.getComputedStyle(descriptionSection).display === 'none';
    
    console.log('Is currently hidden:', isCurrentlyHidden); // Debug log
    
    if (!isCurrentlyHidden) {
      // Hide description section with animation
      console.log('Hiding description section'); // Debug log
      descriptionSection.classList.add('hiding');
      setTimeout(() => {
        descriptionSection.style.display = 'none';
        descriptionSection.classList.remove('hiding');
      }, 300);
      
      toggleDescriptionBtn.classList.remove('active');
      toggleDescriptionBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Search by Description
      `;
    } else {
      // Show description section with animation
      console.log('Showing description section'); // Debug log
      descriptionSection.style.display = 'block';
      toggleDescriptionBtn.classList.add('active');
      toggleDescriptionBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Hide Description Search
      `;
      // Focus on textarea when shown
      setTimeout(() => {
        if (problemDescription) {
          problemDescription.focus();
        }
      }, 350);
    }
  }

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
      <div class="refresh-prompt">
        <div class="refresh-prompt-title">Problem Not Detected</div>
        <div class="refresh-prompt-text">Page may still be loading or title isn't visible yet.</div>
        <button id="refreshPageBtn" class="refresh-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      <div class="refresh-prompt" style="border-color: rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.1);">
        <div class="refresh-prompt-title" style="color: #f59e0b;">Enhanced Experience</div>
        <div class="refresh-prompt-text">Visit TakeUForward for instant problem detection.</div>
        <a href="https://takeuforward.org/plus/dsa/problems-set" target="_blank" class="refresh-btn" style="background: #f59e0b; text-decoration: none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

  async function analyzeDescription() {
    const description = problemDescription.value.trim();
    if (!description) {
      showResult('Please enter a problem description to analyze', 'error');
      return;
    }

    analyzeBtn.innerHTML = `
      <div style="width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      Analyzing...
    `;
    analyzeBtn.disabled = true;

    try {
      const analysisResult = await analyzeProblemDescription(description);
      if (analysisResult && (analysisResult.matches.length > 0 || analysisResult.suggestedTopics.length > 0)) {
        showDescriptionAnalysisResult(analysisResult, 'Problem Description');
      } else {
        showResult('No similar problems found. Try a more detailed description or check if it\'s a LeetCode problem.', 'error');
      }
    } catch (error) {
      showResult('Analysis failed. Please check your internet connection and try again.', 'error');
    }

    analyzeBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11H1v6h8v-6zM23 11h-8v6h8v-6zM11 1H1v8h10V1zM23 1h-8v8h8V1z"/>
      </svg>
      Analyze Description
    `;
    analyzeBtn.disabled = false;
  }

  async function searchProblemWithDescription(title, description) {
    searchBtn.innerHTML = `
      <div style="width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      Analyzing...
    `;
    searchBtn.disabled = true;

    try {
      // First try to find by title
      let problemData = await findLeetCodeProblem(title);
      
      if (problemData) {
        showProblemResult(problemData);
      } else if (description) {
        // If title search fails, analyze the description
        const analysisResult = await analyzeProblemDescription(description);
        if (analysisResult && analysisResult.matches.length > 0) {
          showDescriptionAnalysisResult(analysisResult, title);
        } else {
          showNotFoundResult(title);
        }
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
    
    // Show topics if available (from local data)
    let topicsHTML = '';
    if (problemData.topics && problemData.topics.length > 0) {
      const topicTags = problemData.topics.slice(0, 4).map(topic => 
        `<span class="topic-tag">${topic}</span>`
      ).join('');
      topicsHTML = `<div class="problem-topics">${topicTags}</div>`;
    }

    // Show description preview if available
    let descriptionHTML = '';
    if (problemData.description) {
      const shortDesc = problemData.description.length > 150 
        ? problemData.description.substring(0, 150) + '...' 
        : problemData.description;
      descriptionHTML = `<div class="problem-description">${shortDesc}</div>`;
    }

    const resultHTML = `
      <div class="problem-card">
        <div class="problem-title">
          #${problemData.id}. ${problemData.title}
        </div>
        ${descriptionHTML}
        ${topicsHTML}
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

  function showDescriptionAnalysisResult(analysisResult, originalTitle) {
    const matches = analysisResult.matches.slice(0, 3); // Limit to 3 matches
    const suggestedTopics = analysisResult.suggestedTopics.slice(0, 6); // Limit to 6 topics

    let matchesHTML = '';
    if (matches.length > 0) {
      matchesHTML = `
        <div class="analysis-section">
          <div class="analysis-title">Similar Problems Found (${matches.length}${analysisResult.matches.length > 3 ? '+' : ''}):</div>
          ${matches.map(match => {
            const premiumBadge = match.paid_only ? '<span class="premium-badge">Premium</span>' : '<span class="free-badge">Free</span>';
            const topicTags = match.topics.slice(0, 3).map(topic => 
              `<span class="topic-tag-small">${topic}</span>`
            ).join('');
            
            return `
              <div class="match-item">
                <div class="match-header">
                  <span class="match-title">#${match.id}. ${match.title}</span>
                  ${premiumBadge}
                </div>
                <div class="match-topics">${topicTags}</div>
                <div class="match-description">${match.description}</div>
                <a href="${match.url}" target="_blank" class="match-link">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Open Problem
                </a>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    let topicsHTML = '';
    if (suggestedTopics.length > 0) {
      topicsHTML = `
        <div class="analysis-section">
          <div class="analysis-title">Related Topics:</div>
          <div class="suggested-topics">
            ${suggestedTopics.map(item => 
              `<span class="suggested-topic">${item.topic}</span>`
            ).join('')}
          </div>
        </div>
      `;
    }

    const resultHTML = `
      <div class="analysis-result">
        <div class="analysis-header">
          <div class="analysis-main-title">Problem Analysis for "${originalTitle}"</div>
          <div class="analysis-subtitle">Based on description matching</div>
        </div>
        ${matchesHTML}
        ${topicsHTML}
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
      const stats = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getStatistics'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      if (stats && typeof stats === 'object' && stats.total !== undefined) {
        displayStatistics(stats);
      } else {
        statsContent.innerHTML = '<div style="color: #ef4444; font-size: 11px;">Statistics unavailable</div>';
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      statsContent.innerHTML = '<div style="color: #ef4444; font-size: 11px;">Error loading statistics</div>';
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

  async function analyzeProblemDescription(description) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'analyzeProblemDescription',
        description: description
      }, (response) => {
        resolve(response);
      });
    });
  }

  async function loadDailyProblem() {
    const dailyProblemContent = document.getElementById('dailyProblemContent');
    const dailyProblemDate = document.getElementById('dailyProblemDate');

    try {
      // Set today's date
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      dailyProblemDate.textContent = dateStr;

      // Fetch daily problem from the API
      const response = await fetch('https://leetcode-api-pied.vercel.app/daily');
      
      if (!response.ok) {
        throw new Error('Failed to fetch daily problem');
      }

      const data = await response.json();
      
      if (data && data.question) {
        displayDailyProblem(data);
      } else {
        throw new Error('Invalid daily problem data');
      }
    } catch (error) {
      console.error('Error loading daily problem:', error);
      dailyProblemContent.innerHTML = `
        <div class="daily-problem-error">
          Unable to load daily problem
        </div>
      `;
    }
  }

  function displayDailyProblem(data) {
    const dailyProblemContent = document.getElementById('dailyProblemContent');
    const question = data.question;
    
    // Create difficulty badge with appropriate colors
    const difficultyClass = question.difficulty.toLowerCase();
    let difficultyColor = '#9ca3af';
    let difficultyBg = '#9ca3af20';
    let difficultyBorder = '#9ca3af40';
    
    if (difficultyClass === 'easy') {
      difficultyColor = '#22c55e';
      difficultyBg = '#22c55e20';
      difficultyBorder = '#22c55e40';
    } else if (difficultyClass === 'medium') {
      difficultyColor = '#f59e0b';
      difficultyBg = '#f59e0b20';
      difficultyBorder = '#f59e0b40';
    } else if (difficultyClass === 'hard') {
      difficultyColor = '#ef4444';
      difficultyBg = '#ef444420';
      difficultyBorder = '#ef444440';
    }

    // Create topic tags (limit to 3)
    const topicTags = question.topicTags.slice(0, 3).map(topic => 
      `<span class="topic-tag-small">${topic.name}</span>`
    ).join('');

    // Create the problem URL
    const problemUrl = `https://leetcode.com${data.link}`;

    const dailyHTML = `
      <div class="daily-problem-content">
        <div class="daily-problem-title-row">
          <div class="daily-problem-main-title">
            #${question.questionFrontendId}. ${question.title}
          </div>
          <span class="daily-problem-badge" style="
            background: ${difficultyBg}; 
            color: ${difficultyColor}; 
            border-color: ${difficultyBorder};
          ">${question.difficulty}</span>
        </div>
        <div class="daily-problem-topics">${topicTags}</div>
        <a href="${problemUrl}" target="_blank" class="daily-problem-link">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open Problem
        </a>
      </div>
    `;

    dailyProblemContent.innerHTML = dailyHTML;
  }
});