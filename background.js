// Background service worker for the TufToLeetcode extension

// Load local leetcode data
let leetcodeData = null;
let dataLoadingAttempts = 0;
const MAX_LOADING_ATTEMPTS = 3;
let keepAliveInterval = null;

// Keep service worker alive using multiple strategies
function keepServiceWorkerAlive() {
  // Strategy 1: Use intervals for immediate keep-alive
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  keepAliveInterval = setInterval(() => {
    // Perform a lightweight operation to keep the service worker active
    chrome.storage.local.set({ 
      keepAlive: Date.now(),
      lastActivity: new Date().toISOString()
    });
  }, 25000); // Every 25 seconds
  
  // Strategy 2: Use alarms for more persistent keep-alive
  chrome.alarms.clear('keepAlive');
  chrome.alarms.create('keepAlive', {
    delayInMinutes: 0.5, // 30 seconds
    periodInMinutes: 0.5
  });
  
  console.log('Service worker keep-alive mechanisms activated');
}

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Perform lightweight operations to keep service worker active
    chrome.storage.local.set({
      alarmKeepAlive: Date.now(),
      serviceWorkerStatus: 'active'
    });
    
    // Ensure data is still loaded
    if (!leetcodeData) {
      console.log('Data not loaded, reloading...');
      loadLeetCodeData();
    }
  }
});

// Load the local data on startup
async function loadLeetCodeData() {
  dataLoadingAttempts++;
  
  try {
    console.log(`Attempting to load LeetCode data (attempt ${dataLoadingAttempts}/${MAX_LOADING_ATTEMPTS})`);
    
    const response = await fetch(chrome.runtime.getURL('leetcode-data.json'));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate the data structure
    if (Array.isArray(data) && data.length > 0) {
      leetcodeData = data;
      console.log('LeetCode data loaded successfully:', leetcodeData.length, 'problems');
      
      // Validate first few items to ensure proper structure
      const sampleProblem = leetcodeData[0];
      if (!sampleProblem.title || !sampleProblem.topics || !Array.isArray(sampleProblem.topics)) {
        console.warn('Data structure validation warning: some problems may have missing fields');
      }
    } else {
      throw new Error('Invalid data format: expected non-empty array');
    }
  } catch (error) {
    console.error(`Failed to load local LeetCode data (attempt ${dataLoadingAttempts}):`, error);
    leetcodeData = null; // Ensure it's null on failure
    
    // Retry loading if we haven't exceeded max attempts
    if (dataLoadingAttempts < MAX_LOADING_ATTEMPTS) {
      console.log(`Retrying data load in 2 seconds...`);
      setTimeout(loadLeetCodeData, 2000);
    } else {
      console.error('Max loading attempts reached. Extension will use API fallback only.');
    }
  }
}

// Initialize data loading and keep-alive mechanism
loadLeetCodeData();
keepServiceWorkerAlive();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Keep service worker alive when receiving messages
  keepServiceWorkerAlive();
  
  if (request.action === 'searchProblem') {
    // Open popup when a problem title is clicked from content script
    chrome.action.openPopup();

    // Store the title and description to be used by popup
    const storageData = { pendingSearch: request.title };
    if (request.description) {
      storageData.pendingDescription = request.description;
    }
    chrome.storage.local.set(storageData);
  } else if (request.action === 'findProblem') {
    // Handle API calls from popup
    findLeetCodeProblem(request.title).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Error finding problem:', error);
      sendResponse(null);
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'analyzeProblemDescription') {
    // Handle problem description analysis
    analyzeProblemDescription(request.description).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Error analyzing problem description:', error);
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
  } else if (request.action === 'getDataStatus') {
    // Handle data loading status request
    sendResponse({
      loaded: leetcodeData !== null,
      count: leetcodeData ? leetcodeData.length : 0,
      attempts: dataLoadingAttempts
    });
  }
});

async function findLeetCodeProblem(title) {
  // First try local data if available
  if (leetcodeData) {
    const localResult = findInLocalData(title);
    if (localResult) {
      return localResult;
    }
  }

  // Fallback to API if local data doesn't have the problem
  try {
    const response = await fetch('https://leetcode-api-pied.vercel.app/problems');

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const problems = await response.json();
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
        matchType: 'exact',
        source: 'api'
      };
    }

    // Step 2: Find problems that start with the search term (high confidence)
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
          matchType: 'startsWith',
          source: 'api'
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
          matchType: 'contains',
          source: 'api'
        };
      }
    }

  } catch (error) {
    console.error('Error fetching from LeetCode API:', error);
  }

  return null;
}

function findInLocalData(title) {
  if (!leetcodeData || !Array.isArray(leetcodeData) || leetcodeData.length === 0) return null;

  const cleanTitle = title.replace(/^\d+\.\s*/, '').replace(/^Problem:\s*/i, '').trim();

  // Step 1: Find exact match first (most reliable)
  let exactMatch = leetcodeData.find(problem =>
    problem.title.toLowerCase() === cleanTitle.toLowerCase()
  );

  if (exactMatch) {
    return {
      title: exactMatch.title,
      url: exactMatch.url,
      difficulty: exactMatch.difficulty,
      id: exactMatch.id,
      paid_only: exactMatch.isPremium,
      topics: exactMatch.topics,
      description: exactMatch.description,
      constraints: exactMatch.constraints,
      matchType: 'exact',
      source: 'local'
    };
  }

  // Step 2: Find problems that start with the search term (high confidence)
  if (cleanTitle.length >= 4) {
    let startsWithMatch = leetcodeData.find(problem =>
      problem.title.toLowerCase().startsWith(cleanTitle.toLowerCase())
    );

    if (startsWithMatch) {
      return {
        title: startsWithMatch.title,
        url: startsWithMatch.url,
        difficulty: startsWithMatch.difficulty,
        id: startsWithMatch.id,
        paid_only: startsWithMatch.isPremium,
        topics: startsWithMatch.topics,
        description: startsWithMatch.description,
        constraints: startsWithMatch.constraints,
        matchType: 'startsWith',
        source: 'local'
      };
    }
  }

  // Step 3: VERY STRICT contains matching - only for longer, specific terms
  if (cleanTitle.length >= 10) {
    let containsMatch = leetcodeData.find(problem =>
      problem.title.toLowerCase().includes(cleanTitle.toLowerCase())
    );

    if (containsMatch) {
      return {
        title: containsMatch.title,
        url: containsMatch.url,
        difficulty: containsMatch.difficulty,
        id: containsMatch.id,
        paid_only: containsMatch.isPremium,
        topics: containsMatch.topics,
        description: containsMatch.description,
        constraints: containsMatch.constraints,
        matchType: 'contains',
        source: 'local'
      };
    }
  }

  return null;
}

async function analyzeProblemDescription(description) {
  if (!leetcodeData || !Array.isArray(leetcodeData) || leetcodeData.length === 0) {
    return { matches: [], suggestedTopics: [], analyzedPhrases: [] };
  }

  // Clean and normalize the description
  const cleanDescription = description.toLowerCase()
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Extract key phrases and concepts from the description
  const keyPhrases = extractKeyPhrases(cleanDescription);
  const semanticKeywords = extractSemanticKeywords(cleanDescription);
  
  // Find problems with similar descriptions
  const matches = [];
  const topicCounts = {};

  for (const problem of leetcodeData) {
    if (!problem.description) continue;
    
    const problemDesc = problem.description.toLowerCase();
    let score = 0;
    let matchedPhrases = [];

    // 1. Check for exact key phrase matches (high weight)
    for (const phrase of keyPhrases) {
      if (problemDesc.includes(phrase)) {
        score += phrase.length > 5 ? 5 : 2;
        matchedPhrases.push(phrase);
      }
    }

    // 2. Check for semantic keyword matches (medium weight)
    for (const keyword of semanticKeywords) {
      if (problemDesc.includes(keyword)) {
        score += 3;
        matchedPhrases.push(keyword);
      }
    }

    // 3. Check for structural similarity (low weight but important)
    const structuralScore = calculateStructuralSimilarity(cleanDescription, problemDesc);
    score += structuralScore;

    // 4. Check for common problem patterns
    const patternScore = calculatePatternSimilarity(cleanDescription, problemDesc);
    score += patternScore;

    // If we have any match, add it (lowered threshold)
    if (score >= 2) {
      matches.push({
        title: problem.title,
        url: problem.url,
        difficulty: problem.difficulty,
        id: problem.id,
        paid_only: problem.isPremium,
        topics: problem.topics,
        score: score,
        matchedPhrases: matchedPhrases,
        description: problem.description.substring(0, 200) + '...'
      });

      // Count topics for suggestions
      if (problem.topics && Array.isArray(problem.topics)) {
        problem.topics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + Math.ceil(score);
        });
      }
    }
  }

  // Sort matches by score
  matches.sort((a, b) => b.score - a.score);

  // Get top suggested topics
  const suggestedTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, relevance: count }));

  return {
    matches: matches.slice(0, 5), // Return top 5 matches
    suggestedTopics: suggestedTopics,
    analyzedPhrases: keyPhrases
  };
}

function extractKeyPhrases(description) {
  // Common algorithm and data structure terms
  const algorithmTerms = [
    'dynamic programming', 'binary search', 'two pointers', 'sliding window',
    'backtracking', 'depth first search', 'breadth first search', 'dfs', 'bfs',
    'greedy', 'divide and conquer', 'merge sort', 'quick sort', 'heap sort',
    'hash table', 'hash map', 'linked list', 'binary tree', 'graph',
    'trie', 'union find', 'disjoint set', 'segment tree', 'fenwick tree',
    'topological sort', 'dijkstra', 'bellman ford', 'floyd warshall',
    'minimum spanning tree', 'kruskal', 'prim', 'kadane', 'knapsack'
  ];

  // Problem-specific patterns
  const problemPatterns = [
    'palindrome', 'anagram', 'substring', 'subarray', 'subsequence',
    'permutation', 'combination', 'parentheses', 'bracket', 'valid',
    'longest', 'shortest', 'maximum', 'minimum', 'median', 'duplicate',
    'unique', 'sorted', 'reverse', 'rotate', 'merge', 'intersection',
    'union', 'difference', 'symmetric', 'balanced', 'cycle', 'path',
    'distance', 'island', 'matrix', 'grid', 'level order', 'inorder',
    'preorder', 'postorder', 'ancestor', 'diameter', 'height', 'depth'
  ];

  const keyPhrases = [];
  const allTerms = [...algorithmTerms, ...problemPatterns];

  // Find exact matches for algorithm terms
  for (const term of allTerms) {
    if (description.includes(term)) {
      keyPhrases.push(term);
    }
  }

  // Extract meaningful phrases (3-6 words)
  const words = description.split(/\s+/);
  for (let i = 0; i < words.length - 2; i++) {
    for (let len = 3; len <= Math.min(6, words.length - i); len++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (phrase.length > 10 && phrase.length < 50) {
        // Filter out common but non-specific phrases
        if (!phrase.includes('given') && !phrase.includes('return') && 
            !phrase.includes('example') && !phrase.includes('input') &&
            !phrase.includes('output') && !phrase.includes('constraint')) {
          keyPhrases.push(phrase);
        }
      }
    }
  }

  // Remove duplicates and return
  return [...new Set(keyPhrases)];
}

function extractSemanticKeywords(description) {
  const keywords = [];
  
  // Data structure indicators
  const dataStructures = {
    'array': ['array', 'list', 'nums', 'arr'],
    'string': ['string', 'str', 'text', 'word', 'character'],
    'tree': ['tree', 'node', 'root', 'leaf', 'parent', 'child'],
    'graph': ['graph', 'vertex', 'edge', 'neighbor', 'connected'],
    'matrix': ['matrix', 'grid', '2d array', 'row', 'column'],
    'stack': ['stack', 'push', 'pop', 'lifo'],
    'queue': ['queue', 'enqueue', 'dequeue', 'fifo'],
    'heap': ['heap', 'priority queue', 'min heap', 'max heap']
  };

  // Operation indicators
  const operations = {
    'search': ['find', 'search', 'locate', 'index', 'position'],
    'sort': ['sort', 'order', 'arrange', 'sorted'],
    'count': ['count', 'number of', 'how many', 'frequency'],
    'sum': ['sum', 'total', 'add', 'addition'],
    'max': ['maximum', 'max', 'largest', 'greatest'],
    'min': ['minimum', 'min', 'smallest', 'least'],
    'remove': ['remove', 'delete', 'eliminate'],
    'insert': ['insert', 'add', 'place'],
    'reverse': ['reverse', 'backward', 'flip'],
    'rotate': ['rotate', 'shift', 'move']
  };

  // Problem type indicators
  const problemTypes = {
    'optimization': ['optimize', 'best', 'efficient', 'optimal'],
    'validation': ['valid', 'check', 'verify', 'validate'],
    'transformation': ['transform', 'convert', 'change', 'modify'],
    'comparison': ['compare', 'equal', 'same', 'different'],
    'iteration': ['iterate', 'loop', 'traverse', 'visit']
  };

  const allCategories = { ...dataStructures, ...operations, ...problemTypes };

  for (const [category, terms] of Object.entries(allCategories)) {
    for (const term of terms) {
      if (description.includes(term)) {
        keywords.push(term);
      }
    }
  }

  return [...new Set(keywords)];
}

function calculateStructuralSimilarity(desc1, desc2) {
  // Check for similar sentence structures and patterns
  let score = 0;
  
  // Common problem statement patterns
  const patterns = [
    /given.*array.*integer/,
    /find.*index/,
    /return.*-1/,
    /target.*appears/,
    /smallest.*index/,
    /0.*based.*indexing/,
    /not.*found/,
    /array.*nums/,
    /integer.*target/
  ];

  for (const pattern of patterns) {
    if (pattern.test(desc1) && pattern.test(desc2)) {
      score += 2;
    }
  }

  return score;
}

function calculatePatternSimilarity(desc1, desc2) {
  // Check for common algorithmic patterns
  let score = 0;
  
  const commonWords = ['array', 'integer', 'target', 'index', 'find', 'return', 'given'];
  let matchCount = 0;
  
  for (const word of commonWords) {
    if (desc1.includes(word) && desc2.includes(word)) {
      matchCount++;
    }
  }
  
  // Score based on percentage of common words
  score = (matchCount / commonWords.length) * 3;
  
  return score;
}

async function getStatistics() {
  // Use local data if available for faster response
  if (leetcodeData && Array.isArray(leetcodeData) && leetcodeData.length > 0) {
    const stats = {
      total: leetcodeData.length,
      free: 0,
      premium: 0,
      topics: {}
    };

    leetcodeData.forEach(problem => {
      // Count free vs premium
      if (problem.isPremium) {
        stats.premium++;
      } else {
        stats.free++;
      }

      // Count topics - ensure topics array exists
      if (problem.topics && Array.isArray(problem.topics)) {
        problem.topics.forEach(topic => {
          stats.topics[topic] = (stats.topics[topic] || 0) + 1;
        });
      }
    });

    return stats;
  }

  // Fallback to API
  try {
    const response = await fetch('https://leetcode-api-pied.vercel.app/problems');

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const problems = await response.json();

    const stats = {
      total: problems.length,
      free: 0,
      premium: 0
    };

    problems.forEach(problem => {
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
  console.log('TufToLeetcode extension installed');
  
  // Create context menu for selected text
  chrome.contextMenus.create({
    id: 'searchLeetCode',
    title: 'Search "%s" on LeetCode',
    contexts: ['selection']
  });
  
  // Initialize keep-alive on installation
  keepServiceWorkerAlive();
});

// Handle browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started - LeetCode extension activating');
  loadLeetCodeData();
  keepServiceWorkerAlive();
});

// Handle service worker lifecycle events
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker suspending - cleaning up');
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  chrome.alarms.clear('keepAlive');
  
  // Store suspension time
  chrome.storage.local.set({
    lastSuspension: new Date().toISOString(),
    serviceWorkerStatus: 'suspended'
  });
});

chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('Service worker suspension canceled - reactivating');
  keepServiceWorkerAlive();
});

// Handle when service worker starts up (including after being idle)
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(
    Promise.all([
      loadLeetCodeData(),
      keepServiceWorkerAlive()
    ])
  );
});

// Handle tab updates to keep extension responsive
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react to completed page loads on relevant sites
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('leetcode.com') || tab.url.includes('takeuforward.org')) {
      // Ensure service worker is active when user visits relevant sites
      keepServiceWorkerAlive();
    }
  }
});

// Handle action clicks (popup opens)
chrome.action.onClicked.addListener(() => {
  keepServiceWorkerAlive();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'searchLeetCode') {
    chrome.storage.local.set({
      pendingSearch: info.selectionText
    });
    chrome.action.openPopup();
    keepServiceWorkerAlive();
  }
});

