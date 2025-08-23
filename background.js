// Background service worker for the LeetCode Problem Finder extension

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchProblem') {
    // Open popup when a problem title is clicked from content script
    chrome.action.openPopup();

    // Store the title to be used by popup
    chrome.storage.local.set({
      pendingSearch: request.title
    });
  } else if (request.action === 'findProblem') {
    // Handle API calls from popup
    findLeetCodeProblem(request.title).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Error finding problem:', error);
      sendResponse(null);
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getStatistics') {
    // Handle statistics request
    getStatistics().then(stats => {
      sendResponse(stats);
    }).catch(error => {
      console.error('Error getting statistics:', error);
      sendResponse(null);
    });
    return true; // Keep message channel open for async response
  }
});

async function findLeetCodeProblem(title) {
  try {
    // Use the reliable LeetCode API
    const response = await fetch('https://leetcode-api-pied.vercel.app/problems');

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const problems = await response.json();

    // Clean the input title for better matching
    const cleanTitle = title.replace(/^\d+\.\s*/, '').replace(/^Problem:\s*/i, '').trim();

    // Step 1: Find exact match first (most reliable)
    let exactMatch = problems.find(problem =>
      problem.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    if (exactMatch) {
      return {
        title: exactMatch.title,
        url: exactMatch.url,
        difficulty: exactMatch.difficulty,
        id: exactMatch.frontend_id,
        paid_only: exactMatch.paid_only,
        matchType: 'exact'
      };
    }

    // Step 2: Find problems that start with the search term (high confidence)
    // Only if search term is at least 4 characters to avoid false positives
    if (cleanTitle.length >= 4) {
      let startsWithMatch = problems.find(problem =>
        problem.title.toLowerCase().startsWith(cleanTitle.toLowerCase())
      );

      if (startsWithMatch) {
        return {
          title: startsWithMatch.title,
          url: startsWithMatch.url,
          difficulty: startsWithMatch.difficulty,
          id: startsWithMatch.frontend_id,
          paid_only: startsWithMatch.paid_only,
          matchType: 'startsWith'
        };
      }
    }

    // Step 3: VERY STRICT contains matching - only for longer, specific terms
    if (cleanTitle.length >= 10) {
      let containsMatch = problems.find(problem =>
        problem.title.toLowerCase().includes(cleanTitle.toLowerCase())
      );

      if (containsMatch) {
        return {
          title: containsMatch.title,
          url: containsMatch.url,
          difficulty: containsMatch.difficulty,
          id: containsMatch.frontend_id,
          paid_only: containsMatch.paid_only,
          matchType: 'contains'
        };
      }
    }

    // NO FUZZY MATCHING - too prone to false positives
    // If we don't have an exact, starts-with, or very specific contains match, return null

  } catch (error) {
    console.error('Error fetching from LeetCode API:', error);
  }

  return null;
}

async function getStatistics() {
  try {
    // Use the reliable LeetCode API
    const response = await fetch('https://leetcode-api-pied.vercel.app/problems');

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const problems = await response.json();

    // Calculate statistics
    const stats = {
      total: problems.length,
      free: 0,
      premium: 0
    };

    problems.forEach(problem => {
      // Count free vs premium
      if (problem.paid_only) {
        stats.premium++;
      } else {
        stats.free++;
      }
    });

    return stats;

  } catch (error) {
    console.error('Error fetching statistics from LeetCode API:', error);
    return null;
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetCode Problem Finder extension installed');
  
  // Create context menu for selected text
  chrome.contextMenus.create({
    id: 'searchLeetCode',
    title: 'Search "%s" on LeetCode',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'searchLeetCode') {
    chrome.storage.local.set({
      pendingSearch: info.selectionText
    });
    chrome.action.openPopup();
  }
});