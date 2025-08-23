// Background service worker for API calls

// Import logger and training manager
importScripts('../utils/logger.js');
importScripts('./training-manager.js');
const trainingManager = new TrainingDataManager();

// Initialize default settings
chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.set({
    autoHide: false,
    showIndicators: true,
    threshold: 30,
    useAI: false,
    useLocalLLM: true, // Always use local LLM
    enableParallelModels: false,
    enabledModels: {
      anthropic: false,
      openai: false,
      localLLM: true
    },
    // Logging settings
    enableLogStorage: true,
    logLevel: 'INFO',
    maxStoredLogs: 1000,
    logPerformanceMetrics: true,
    debugMode: false
  });
  
  // Initialize training data
  await trainingManager.initialize();
});

// Message handler for content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Analysis is now done directly in content script via local LLM
  // We only handle training data and connection status here
  
  // Handle LLM connection status updates
  if (request.action === 'llmConnectionStatus') {
    handleLLMConnectionStatus(request.connected, request.models, request.error);
    sendResponse({ received: true });
    return false;
  }
  
  // Training data operations
  if (request.action === 'addTrainingExample') {
    trainingManager.addExample(request.tweetData, request.category)
      .then(result => sendResponse({ success: true, example: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getCategories') {
    trainingManager.getAllCategories()
      .then(categories => sendResponse({ categories }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'predictCategory') {
    trainingManager.getCategoryPrediction(request.tweetData)
      .then(prediction => sendResponse({ prediction }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'getCategoryWeights') {
    getCategoryWeights(request.category)
      .then(weights => sendResponse({ weights }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  // Training data export/import operations
  if (request.action === 'exportTrainingData') {
    trainingManager.exportTrainingData()
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'importTrainingData') {
    trainingManager.importTrainingData(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'clearTrainingData') {
    trainingManager.clearTrainingData()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Get specific training example
  if (request.action === 'getTrainingExample') {
    trainingManager.getExample(request.exampleId)
      .then(example => sendResponse({ example }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Handle LLM connection status
function handleLLMConnectionStatus(connected, models, error) {
  // Update badge to show connection status
  const badgeText = connected ? 'ON' : 'OFF';
  const badgeColor = connected ? '#10b981' : '#ef4444';
  
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  
  // Store status for popup
  if (connected) {
    chrome.storage.local.set({
      llmConnected: true,
      llmModels: models,
      llmLastError: null
    });
    
    extLog.info('LLM connected', { models });
  } else {
    chrome.storage.local.set({
      llmConnected: false,
      llmModels: [],
      llmLastError: error || 'Connection lost'
    });
    
    extLog.warn('LLM disconnected', { error });
  }
}

// Category-based weight calculation
async function getCategoryWeights(category) {
  const { trainingData } = await chrome.storage.local.get('trainingData');
  if (!trainingData || !trainingData.examples) {
    return null;
  }
  
  // Get examples for this category
  const categoryExamples = Object.values(trainingData.examples)
    .filter(ex => ex.category === category);
  
  if (categoryExamples.length < 5) {
    // Not enough examples to calculate meaningful weights
    return null;
  }
  
  // Calculate average feature values for signal tweets in this category
  const signalExamples = categoryExamples.filter(ex => ex.features.score > 50);
  const noiseExamples = categoryExamples.filter(ex => ex.features.score <= 50);
  
  if (signalExamples.length === 0 || noiseExamples.length === 0) {
    return null;
  }
  
  // Calculate feature importance based on difference between signal and noise
  const weights = {};
  const features = ['hasMedia', 'hasLinks', 'isThread', 'isVerified', 'isReply', 'hashtagCount', 'mentionCount'];
  
  features.forEach(feature => {
    const signalAvg = signalExamples.reduce((sum, ex) => sum + (ex.features[feature] || 0), 0) / signalExamples.length;
    const noiseAvg = noiseExamples.reduce((sum, ex) => sum + (ex.features[feature] || 0), 0) / noiseExamples.length;
    
    // Calculate weight based on difference
    const diff = signalAvg - noiseAvg;
    weights[feature] = diff * 0.2; // Scale down the difference
  });
  
  return weights;
}

// Simple cache implementation for analysis results
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function generateCacheKey(text) {
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

async function getCachedAnalysis(key) {
  const cached = analysisCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
}

async function cacheAnalysis(key, result) {
  analysisCache.set(key, {
    result,
    timestamp: Date.now()
  });
  
  // Clean old entries
  for (const [k, v] of analysisCache) {
    if (Date.now() - v.timestamp > CACHE_TTL) {
      analysisCache.delete(k);
    }
  }
  
  // Persist cache to storage
  const cacheData = Array.from(analysisCache.entries()).slice(-100); // Keep last 100
  await chrome.storage.local.set({ analysisCache: cacheData });
}