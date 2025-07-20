// Training Data Manager for user-driven categorization
class TrainingDataManager {
  constructor() {
    this.maxExamplesPerCategory = 1000;
    this.maxCategories = 50;
    this.version = 1;
  }

  async initialize() {
    // Ensure training data structure exists
    const { trainingData } = await chrome.storage.local.get('trainingData');
    if (!trainingData) {
      await chrome.storage.local.set({
        trainingData: {
          version: this.version,
          examples: {},
          categories: [],
          categoryStats: {},
          modelCache: {}
        }
      });
    }
  }

  async addExample(tweetData, category) {
    const { trainingData } = await chrome.storage.local.get('trainingData');
    
    // Generate unique ID
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract features for training
    const features = this.extractFeatures(tweetData);
    
    // Create training example
    const example = {
      id,
      text: tweetData.text,
      category,
      features,
      metadata: {
        author: tweetData.author,
        timestamp: Date.now(),
        engagementMetrics: tweetData.metrics
      }
    };
    
    // Add to examples
    trainingData.examples[id] = example;
    
    // Update categories
    if (!trainingData.categories.includes(category)) {
      if (trainingData.categories.length >= this.maxCategories) {
        throw new Error(`Maximum categories (${this.maxCategories}) reached`);
      }
      trainingData.categories.push(category);
    }
    
    // Update category statistics
    if (!trainingData.categoryStats[category]) {
      trainingData.categoryStats[category] = {
        count: 0,
        lastUpdated: Date.now()
      };
    }
    trainingData.categoryStats[category].count++;
    trainingData.categoryStats[category].lastUpdated = Date.now();
    
    // Enforce example limit per category
    const categoryExamples = Object.values(trainingData.examples)
      .filter(ex => ex.category === category);
    if (categoryExamples.length > this.maxExamplesPerCategory) {
      // Remove oldest example
      const oldest = categoryExamples.sort((a, b) => 
        a.metadata.timestamp - b.metadata.timestamp
      )[0];
      delete trainingData.examples[oldest.id];
    }
    
    await chrome.storage.local.set({ trainingData });
    return example;
  }

  async removeExample(id) {
    const { trainingData } = await chrome.storage.local.get('trainingData');
    
    if (!trainingData.examples[id]) {
      throw new Error('Example not found');
    }
    
    const category = trainingData.examples[id].category;
    delete trainingData.examples[id];
    
    // Update category stats
    if (trainingData.categoryStats[category]) {
      trainingData.categoryStats[category].count--;
      if (trainingData.categoryStats[category].count === 0) {
        // Remove empty category
        trainingData.categories = trainingData.categories.filter(c => c !== category);
        delete trainingData.categoryStats[category];
      }
    }
    
    await chrome.storage.local.set({ trainingData });
  }

  async getExamplesByCategory(category) {
    const { trainingData } = await chrome.storage.local.get('trainingData');
    return Object.values(trainingData.examples)
      .filter(ex => ex.category === category)
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  async getAllCategories() {
    const { trainingData } = await chrome.storage.local.get('trainingData');
    return trainingData.categories.map(category => ({
      name: category,
      count: trainingData.categoryStats[category]?.count || 0,
      lastUpdated: trainingData.categoryStats[category]?.lastUpdated || null
    }));
  }

  async findSimilarExamples(tweetData, limit = 5) {
    const { trainingData } = await chrome.storage.local.get('trainingData');
    const targetFeatures = this.extractFeatures(tweetData);
    
    // Calculate similarity scores
    const similarities = Object.values(trainingData.examples).map(example => ({
      ...example,
      similarity: this.calculateSimilarity(targetFeatures, example.features)
    }));
    
    // Return top similar examples
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async getCategoryPrediction(tweetData) {
    const similarExamples = await this.findSimilarExamples(tweetData, 10);
    
    if (similarExamples.length === 0) {
      return null;
    }
    
    // Weight categories by similarity
    const categoryScores = {};
    similarExamples.forEach(example => {
      if (!categoryScores[example.category]) {
        categoryScores[example.category] = 0;
      }
      categoryScores[example.category] += example.similarity;
    });
    
    // Find best category
    const sortedCategories = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a);
    
    if (sortedCategories.length === 0) {
      return null;
    }
    
    const [topCategory, topScore] = sortedCategories[0];
    const totalScore = Object.values(categoryScores).reduce((a, b) => a + b, 0);
    
    return {
      category: topCategory,
      confidence: topScore / totalScore,
      alternatives: sortedCategories.slice(1, 4).map(([cat, score]) => ({
        category: cat,
        confidence: score / totalScore
      }))
    };
  }

  extractFeatures(tweetData) {
    const text = tweetData.text.toLowerCase();
    
    return {
      // Text features
      length: text.length,
      wordCount: text.split(/\s+/).length,
      capsRatio: (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1),
      
      // Content features
      hasMedia: Boolean(tweetData.hasMedia),
      hasLinks: Boolean(tweetData.hasLinks),
      isRetweet: Boolean(tweetData.isRetweet),
      isReply: Boolean(tweetData.isReply),
      isThread: Boolean(tweetData.isThread),
      
      // Engagement features (normalized)
      likesNorm: Math.log1p(tweetData.metrics?.likes || 0),
      retweetsNorm: Math.log1p(tweetData.metrics?.retweets || 0),
      repliesNorm: Math.log1p(tweetData.metrics?.replies || 0),
      
      // Pattern features
      hashtagCount: (text.match(/#\w+/g) || []).length,
      mentionCount: (text.match(/@\w+/g) || []).length,
      emojiDensity: (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length / Math.max(text.length, 1),
      
      // Linguistic features
      questionMarks: (text.match(/\?/g) || []).length,
      exclamationMarks: (text.match(/!/g) || []).length,
      
      // Author features
      isVerified: Boolean(tweetData.author?.isVerified),
      followerCount: Math.log1p(tweetData.author?.followers || 0),
      
      // Keywords (top 10 most common words > 3 chars)
      keywords: this.extractKeywords(text)
    };
  }

  extractKeywords(text) {
    const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been', 'are', 'was', 'were', 'been']);
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  calculateSimilarity(features1, features2) {
    let similarity = 0;
    let weights = 0;
    
    // Numeric features with weights
    const numericFeatures = [
      { key: 'capsRatio', weight: 0.5 },
      { key: 'likesNorm', weight: 0.3 },
      { key: 'retweetsNorm', weight: 0.3 },
      { key: 'repliesNorm', weight: 0.3 },
      { key: 'hashtagCount', weight: 0.4 },
      { key: 'mentionCount', weight: 0.4 },
      { key: 'emojiDensity', weight: 0.5 },
      { key: 'followerCount', weight: 0.2 }
    ];
    
    numericFeatures.forEach(({ key, weight }) => {
      const diff = Math.abs(features1[key] - features2[key]);
      const maxVal = Math.max(features1[key], features2[key], 1);
      similarity += weight * (1 - diff / maxVal);
      weights += weight;
    });
    
    // Boolean features with weights
    const booleanFeatures = [
      { key: 'hasMedia', weight: 0.8 },
      { key: 'hasLinks', weight: 0.7 },
      { key: 'isRetweet', weight: 0.6 },
      { key: 'isReply', weight: 0.5 },
      { key: 'isThread', weight: 0.9 },
      { key: 'isVerified', weight: 0.4 }
    ];
    
    booleanFeatures.forEach(({ key, weight }) => {
      if (features1[key] === features2[key]) {
        similarity += weight;
      }
      weights += weight;
    });
    
    // Keyword overlap (high weight)
    const keywords1 = new Set(features1.keywords);
    const keywords2 = new Set(features2.keywords);
    const intersection = [...keywords1].filter(k => keywords2.has(k)).length;
    const union = new Set([...keywords1, ...keywords2]).size;
    const keywordSimilarity = union > 0 ? intersection / union : 0;
    similarity += keywordSimilarity * 2;
    weights += 2;
    
    return similarity / weights;
  }

  async exportTrainingData() {
    const { trainingData } = await chrome.storage.local.get('trainingData');
    return {
      version: trainingData.version,
      exportDate: new Date().toISOString(),
      categories: trainingData.categories,
      examples: Object.values(trainingData.examples),
      stats: trainingData.categoryStats
    };
  }

  async importTrainingData(data) {
    if (data.version !== this.version) {
      throw new Error('Incompatible training data version');
    }
    
    const trainingData = {
      version: data.version,
      examples: {},
      categories: data.categories || [],
      categoryStats: data.stats || {},
      modelCache: {}
    };
    
    // Convert array to object format
    data.examples.forEach(example => {
      trainingData.examples[example.id] = example;
    });
    
    await chrome.storage.local.set({ trainingData });
  }

  async clearTrainingData() {
    await chrome.storage.local.set({
      trainingData: {
        version: this.version,
        examples: {},
        categories: [],
        categoryStats: {},
        modelCache: {}
      }
    });
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrainingDataManager;
}