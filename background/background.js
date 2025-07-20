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
    apiKey: '',
    apiProvider: 'anthropic', // 'anthropic' or 'openai'
    enableParallelModels: false,
    enabledModels: {
      anthropic: true,
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
  if (request.action === 'analyzeTweet') {
    handleTweetAnalysis(request)
      .then(result => sendResponse(result))
      .catch(error => {
        extLog.error('AI analysis failed', { error: error.message, stack: error.stack });
        sendResponse({ error: true });
      });
    
    return true; // Keep message channel open for async response
  }
  
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
});

// Handle LLM connection status
function handleLLMConnectionStatus(connected, models, error) {
  if (connected) {
    // Update badge to show LLM is active
    chrome.action.setBadgeText({ text: 'LLM' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    
    // Store connection status
    chrome.storage.local.set({ 
      llmConnected: true, 
      llmModels: models,
      llmLastConnected: Date.now() 
    });
    
    extLog.info('LLM connected with models', { models });
  } else {
    // Clear badge or show disconnected state
    chrome.action.setBadgeText({ text: '' });
    
    // Store disconnection status
    chrome.storage.local.set({ 
      llmConnected: false,
      llmLastError: error || 'Connection lost'
    });
    
    extLog.warn('LLM disconnected', { error });
  }
}

async function handleTweetAnalysis(request) {
  const { enableParallelModels, enabledModels } = await chrome.storage.local.get(['enableParallelModels', 'enabledModels']);
  
  // Check for cached result first
  const cacheKey = generateCacheKey(request.text);
  const cachedResult = await getCachedAnalysis(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }
  
  let result;
  
  if (enableParallelModels) {
    // Run multiple models in parallel
    result = await analyzeWithMultipleModels(request);
  } else {
    // Use single model
    result = await analyzeTweetWithAI(request.text, request.apiKey);
  }
  
  // Get category prediction if training data exists
  const categoryPrediction = await trainingManager.getCategoryPrediction(request.tweetData);
  if (categoryPrediction) {
    result.category = categoryPrediction.category;
    result.categoryConfidence = categoryPrediction.confidence;
  }
  
  // Cache the result
  await cacheAnalysis(cacheKey, result);
  
  return result;
}

async function analyzeTweetWithAI(text, apiKey) {
  // Get API provider setting
  const { apiProvider } = await chrome.storage.local.get('apiProvider');
  
  if (apiProvider === 'openai') {
    return analyzeWithOpenAI(text, apiKey);
  } else {
    return analyzeWithAnthropic(text, apiKey);
  }
}

async function analyzeWithMultipleModels(request) {
  const { enabledModels, apiKey, anthropicApiKey, openaiApiKey } = await chrome.storage.local.get([
    'enabledModels', 'apiKey', 'anthropicApiKey', 'openaiApiKey'
  ]);
  
  const promises = [];
  const modelNames = [];
  
  if (enabledModels.anthropic && (anthropicApiKey || apiKey)) {
    promises.push(analyzeWithAnthropic(request.text, anthropicApiKey || apiKey));
    modelNames.push('anthropic');
  }
  
  if (enabledModels.openai && (openaiApiKey || apiKey)) {
    promises.push(analyzeWithOpenAI(request.text, openaiApiKey || apiKey));
    modelNames.push('openai');
  }
  
  if (enabledModels.localLLM) {
    promises.push(analyzeWithLocalLLM(request.text));
    modelNames.push('localLLM');
  }
  
  if (promises.length === 0) {
    throw new Error('No models enabled or API keys missing');
  }
  
  // Run all models in parallel
  const results = await Promise.allSettled(promises);
  
  // Aggregate results
  return aggregateModelResults(results, modelNames);
}

async function analyzeWithLocalLLM(text) {
  // Send request to local LLM through content script
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        reject(new Error('No active tab'));
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'analyzeWithLocalLLM',
        text: text
      }, response => {
        if (chrome.runtime.lastError) {
          extLog.warn('Failed to send to content script', { error: chrome.runtime.lastError.message });
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  });
}

function aggregateModelResults(results, modelNames) {
  const successfulResults = [];
  const modelScores = {};
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      successfulResults.push(result.value);
      modelScores[modelNames[index]] = result.value.score;
    }
  });
  
  if (successfulResults.length === 0) {
    throw new Error('All models failed');
  }
  
  // Calculate weighted average score
  const totalScore = successfulResults.reduce((sum, r) => sum + r.score, 0);
  const avgScore = Math.round(totalScore / successfulResults.length);
  
  // Combine reasons
  const reasons = successfulResults.map(r => r.reason).filter(Boolean);
  const combinedReason = reasons.length > 1 
    ? `Multiple models agree: ${reasons[0]}` 
    : reasons[0] || 'Analysis complete';
  
  return {
    score: avgScore,
    reason: combinedReason,
    confidence: 'multi-model',
    modelCount: successfulResults.length,
    modelScores: modelScores,
    consensus: calculateConsensus(successfulResults)
  };
}

function calculateConsensus(results) {
  if (results.length < 2) return 1.0;
  
  const scores = results.map(r => r.score);
  const mean = scores.reduce((a, b) => a + b) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower std dev means higher consensus
  return Math.max(0, 1 - (stdDev / 50));
}

// Cache functions
function generateCacheKey(text) {
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `tweet_${hash}`;
}

async function getCachedAnalysis(key) {
  const { analysisCache = {} } = await chrome.storage.local.get('analysisCache');
  const cached = analysisCache[key];
  
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
    return cached.data;
  }
  
  return null;
}

async function cacheAnalysis(key, data) {
  const { analysisCache = {} } = await chrome.storage.local.get('analysisCache');
  
  // Limit cache size
  const keys = Object.keys(analysisCache);
  if (keys.length > 1000) {
    // Remove oldest entries
    keys.sort((a, b) => analysisCache[a].timestamp - analysisCache[b].timestamp);
    for (let i = 0; i < 100; i++) {
      delete analysisCache[keys[i]];
    }
  }
  
  analysisCache[key] = {
    data: data,
    timestamp: Date.now()
  };
  
  await chrome.storage.local.set({ analysisCache });
}

async function analyzeWithAnthropic(text, apiKey) {
  const prompt = `Analyze this tweet and rate it as either high-signal (valuable, informative, insightful) or low-signal/noise (rage bait, low-value, distracting). 

Tweet: "${text}"

Respond with ONLY a JSON object in this format:
{
  "score": <number between 0-100 where 100 is highest signal>,
  "reason": "<brief explanation>"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Parse JSON response
    try {
      const result = JSON.parse(content);
      return {
        score: result.score,
        reason: result.reason
      };
    } catch (e) {
      // Fallback if JSON parsing fails
      return { score: 50, reason: 'Failed to parse response' };
    }
  } catch (error) {
    extLog.error('Anthropic API error', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function analyzeWithOpenAI(text, apiKey) {
  const prompt = `Analyze this tweet and rate it as either high-signal (valuable, informative, insightful) or low-signal/noise (rage bait, low-value, distracting). 

Tweet: "${text}"

Respond with ONLY a JSON object in this format:
{
  "score": <number between 0-100 where 100 is highest signal>,
  "reason": "<brief explanation>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    try {
      const result = JSON.parse(content);
      return {
        score: result.score,
        reason: result.reason
      };
    } catch (e) {
      // Fallback if JSON parsing fails
      return { score: 50, reason: 'Failed to parse response' };
    }
  } catch (error) {
    extLog.error('OpenAI API error', { error: error.message, stack: error.stack });
    throw error;
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

// Batch processing for efficiency
let tweetBatch = [];
let batchTimeout = null;

async function addToBatch(tweet, apiKey) {
  tweetBatch.push(tweet);
  
  // Clear existing timeout
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }
  
  // Process batch after 500ms or when batch size reaches 10
  if (tweetBatch.length >= 10) {
    processBatch(apiKey);
  } else {
    batchTimeout = setTimeout(() => processBatch(apiKey), 500);
  }
}

async function processBatch(apiKey) {
  if (tweetBatch.length === 0) return;
  
  const tweets = [...tweetBatch];
  tweetBatch = [];
  
  // Create batch prompt
  const batchPrompt = `Analyze these tweets and rate each as either high-signal (valuable, informative, insightful) or low-signal/noise (rage bait, low-value, distracting).

${tweets.map((t, i) => `Tweet ${i + 1}: "${t.text}"`).join('\n\n')}

Respond with a JSON array where each object has:
{
  "index": <tweet number>,
  "score": <0-100 where 100 is highest signal>,
  "reason": "<brief explanation>"
}`;

  // Process batch with AI
  // Implementation would follow similar pattern as single tweet analysis
  // but return results for all tweets at once
}