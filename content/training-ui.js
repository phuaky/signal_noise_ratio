// Training UI Components for Signal/Noise Ratio Extension

class TrainingUI {
  constructor() {
    this.isTrainingMode = false;
    this.categories = [];
    this.selectedCategory = null;
    this.initializeUI();
  }

  async initializeUI() {
    // Load existing categories
    await this.loadCategories();
    
    // Create training mode toggle
    this.createTrainingModeToggle();
    
    // Create category selector
    this.createCategorySelector();
    
    // Add context menu for quick categorization
    this.setupContextMenu();
  }

  async loadCategories() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getCategories' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Failed to get categories:', chrome.runtime.lastError.message);
            resolve({ categories: [] });
          } else {
            resolve(response || { categories: [] });
          }
        });
      });
      this.categories = response.categories || [];
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.categories = [];
    }
  }

  createTrainingModeToggle() {
    const toggle = document.createElement('div');
    toggle.className = 'sn-training-toggle';
    toggle.innerHTML = `
      <button class="sn-toggle-btn" title="Toggle Training Mode">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="sn-toggle-label">Train AI</span>
      </button>
      <div class="sn-training-status" style="display: none;">
        <span class="sn-status-text">Training Mode Active</span>
        <span class="sn-category-count">${this.categories.length} categories</span>
      </div>
    `;
    
    document.body.appendChild(toggle);
    
    // Toggle handler
    const btn = toggle.querySelector('.sn-toggle-btn');
    btn.addEventListener('click', () => this.toggleTrainingMode());
  }

  createCategorySelector() {
    const selector = document.createElement('div');
    selector.className = 'sn-category-selector';
    selector.innerHTML = `
      <div class="sn-category-header">
        <h3>Select Category</h3>
        <button class="sn-close-btn">&times;</button>
      </div>
      <div class="sn-category-list">
        ${this.renderCategoryList()}
      </div>
      <div class="sn-category-input">
        <input type="text" placeholder="New category name..." class="sn-new-category">
        <button class="sn-add-category-btn">Add</button>
      </div>
    `;
    
    selector.style.display = 'none';
    document.body.appendChild(selector);
    
    // Event handlers
    selector.querySelector('.sn-close-btn').addEventListener('click', () => {
      selector.style.display = 'none';
    });
    
    selector.querySelector('.sn-add-category-btn').addEventListener('click', () => {
      const input = selector.querySelector('.sn-new-category');
      const categoryName = input.value.trim();
      if (categoryName && !this.categories.find(c => c.name === categoryName)) {
        this.addCategory(categoryName);
        input.value = '';
      }
    });
    
    // Category selection
    selector.addEventListener('click', (e) => {
      if (e.target.classList.contains('sn-category-item')) {
        this.selectedCategory = e.target.dataset.category;
        this.applyCategoryToTweet();
      }
    });
    
    this.categorySelector = selector;
  }

  renderCategoryList() {
    if (this.categories.length === 0) {
      return '<div class="sn-empty-categories">No categories yet. Create your first category below!</div>';
    }
    
    return this.categories.map(cat => `
      <div class="sn-category-item" data-category="${cat.name}">
        <span class="sn-category-name">${cat.name}</span>
        <span class="sn-category-badge">${cat.count}</span>
      </div>
    `).join('');
  }

  toggleTrainingMode() {
    this.isTrainingMode = !this.isTrainingMode;
    const toggle = document.querySelector('.sn-training-toggle');
    const btn = toggle.querySelector('.sn-toggle-btn');
    const status = toggle.querySelector('.sn-training-status');
    
    if (this.isTrainingMode) {
      btn.classList.add('active');
      status.style.display = 'block';
      document.body.classList.add('sn-training-mode');
      this.addTrainingIndicators();
    } else {
      btn.classList.remove('active');
      status.style.display = 'none';
      document.body.classList.remove('sn-training-mode');
      this.removeTrainingIndicators();
    }
  }

  addTrainingIndicators() {
    // Add training buttons to all tweets
    document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
      if (!tweet.querySelector('.sn-train-btn')) {
        const trainBtn = document.createElement('button');
        trainBtn.className = 'sn-train-btn';
        trainBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        trainBtn.title = 'Categorize this tweet';
        trainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showCategorySelector(tweet);
        });
        
        // Find a good place to insert the button
        const actionBar = tweet.querySelector('[role="group"]');
        if (actionBar) {
          actionBar.appendChild(trainBtn);
        } else {
          tweet.appendChild(trainBtn);
        }
      }
    });
  }

  removeTrainingIndicators() {
    document.querySelectorAll('.sn-train-btn').forEach(btn => btn.remove());
  }

  showCategorySelector(tweet) {
    this.currentTweet = tweet;
    const rect = tweet.getBoundingClientRect();
    
    this.categorySelector.style.display = 'block';
    this.categorySelector.style.top = `${rect.top + window.scrollY}px`;
    this.categorySelector.style.left = `${Math.min(rect.right + 10, window.innerWidth - 300)}px`;
  }

  async applyCategoryToTweet() {
    if (!this.currentTweet || !this.selectedCategory) return;
    
    // Extract tweet data
    const tweetData = this.extractTweetData(this.currentTweet);
    
    try {
      // Send to background script
      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('Training example submission timed out');
          resolve({ success: false, error: 'Timeout' });
        }, 3000);
        
        chrome.runtime.sendMessage({
          action: 'addTrainingExample',
          tweetData: tweetData,
          category: this.selectedCategory
        }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            console.warn('Chrome runtime error:', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false });
          }
        });
      });
      
      if (response.success) {
        // Visual feedback
        this.showFeedback(this.currentTweet, 'success', `Categorized as ${this.selectedCategory}`);
        
        // Update category count
        await this.loadCategories();
        this.updateCategoryList();
        
        // Hide selector
        this.categorySelector.style.display = 'none';
      } else {
        this.showFeedback(this.currentTweet, 'error', 'Failed to categorize');
      }
    } catch (error) {
      console.error('Failed to categorize tweet:', error);
      this.showFeedback(this.currentTweet, 'error', 'Error occurred');
    }
  }

  extractTweetData(tweetElement) {
    // Extract comprehensive tweet data for training
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const text = textElement ? textElement.innerText : '';
    
    // Author info
    const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
    const authorName = authorElement ? authorElement.querySelector('span')?.innerText : '';
    const isVerified = Boolean(tweetElement.querySelector('[data-testid="icon-verified"]'));
    
    // Engagement metrics
    const metrics = {
      likes: this.extractMetric(tweetElement, 'like'),
      retweets: this.extractMetric(tweetElement, 'retweet'),
      replies: this.extractMetric(tweetElement, 'reply')
    };
    
    // Content features
    const hasMedia = Boolean(tweetElement.querySelector('img[alt="Image"], video'));
    const hasLinks = Boolean(tweetElement.querySelector('a[href*="t.co"]'));
    const isRetweet = Boolean(tweetElement.querySelector('[data-testid="socialContext"]'));
    const isReply = text.startsWith('@');
    const isThread = Boolean(tweetElement.querySelector('[data-testid="tweet"] + [data-testid="tweet"]'));
    
    return {
      text,
      author: {
        name: authorName,
        isVerified,
        followers: 0 // Would need additional API call
      },
      metrics,
      hasMedia,
      hasLinks,
      isRetweet,
      isReply,
      isThread
    };
  }

  extractMetric(element, type) {
    const testId = type === 'like' ? 'like' : type === 'retweet' ? 'retweet' : 'reply';
    const metricElement = element.querySelector(`[data-testid="${testId}"]`);
    if (!metricElement) return 0;
    
    const ariaLabel = metricElement.getAttribute('aria-label');
    if (!ariaLabel) return 0;
    
    const match = ariaLabel.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async addCategory(categoryName) {
    this.categories.push({ name: categoryName, count: 0 });
    this.updateCategoryList();
  }

  updateCategoryList() {
    const listContainer = this.categorySelector.querySelector('.sn-category-list');
    listContainer.innerHTML = this.renderCategoryList();
    
    // Update count in toggle
    const countElement = document.querySelector('.sn-category-count');
    if (countElement) {
      countElement.textContent = `${this.categories.length} categories`;
    }
  }

  showFeedback(element, type, message) {
    const feedback = document.createElement('div');
    feedback.className = `sn-feedback sn-feedback-${type}`;
    feedback.textContent = message;
    
    element.appendChild(feedback);
    
    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  setupContextMenu() {
    // Right-click handler for quick categorization
    document.addEventListener('contextmenu', (e) => {
      if (!this.isTrainingMode) return;
      
      const tweet = e.target.closest('[data-testid="tweet"]');
      if (!tweet) return;
      
      // We can't actually create a custom context menu in a content script
      // But we can show our category selector on right-click
      e.preventDefault();
      this.showCategorySelector(tweet);
    });
  }

  // Observer for new tweets
  observeNewTweets() {
    const observer = new MutationObserver((mutations) => {
      if (!this.isTrainingMode) return;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const tweets = node.querySelectorAll('[data-testid="tweet"]');
            tweets.forEach(() => this.addTrainingIndicators());
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Export for use in content script
window.TrainingUI = TrainingUI;