class AnalysisQueue {
  constructor() {
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];
    this.processing = false;
    this.processedTweets = new WeakSet();
    this.pendingTweets = new WeakMap();
    this.maxQueueSize = 100;
    this.batchSize = 5;
    this.idleCallbackId = null;
  }

  addTweet(tweetElement, priority = 'low', analyzer = null) {
    if (this.processedTweets.has(tweetElement) || this.pendingTweets.has(tweetElement)) {
      return;
    }

    const tweetData = {
      element: tweetElement,
      analyzer: analyzer,
      timestamp: Date.now(),
      priority: priority
    };

    this.pendingTweets.set(tweetElement, tweetData);

    if (priority === 'high') {
      this.highPriorityQueue.push(tweetData);
    } else {
      this.lowPriorityQueue.push(tweetData);
      this.trimLowPriorityQueue();
    }

    this.scheduleProcessing();
  }

  trimLowPriorityQueue() {
    if (this.lowPriorityQueue.length > this.maxQueueSize) {
      const removed = this.lowPriorityQueue.splice(0, this.lowPriorityQueue.length - this.maxQueueSize);
      removed.forEach(tweet => this.pendingTweets.delete(tweet.element));
    }
  }

  scheduleProcessing() {
    if (this.processing) return;

    if (this.highPriorityQueue.length > 0) {
      this.processNextBatch();
    } else if (this.lowPriorityQueue.length > 0) {
      if (this.idleCallbackId) {
        cancelIdleCallback(this.idleCallbackId);
      }
      this.idleCallbackId = requestIdleCallback(() => this.processNextBatch(), {
        timeout: 2000
      });
    }
  }

  async processNextBatch() {
    if (this.processing) return;
    this.processing = true;

    try {
      const batch = this.getNextBatch();
      if (batch.length === 0) {
        this.processing = false;
        return;
      }

      // Process tweets sequentially with delay to avoid overwhelming server
      for (const tweetData of batch) {
        try {
          if (tweetData.analyzer && typeof tweetData.analyzer.analyzeTweetElement === 'function') {
            await tweetData.analyzer.analyzeTweetElement(tweetData.element);
          }
          this.processedTweets.add(tweetData.element);
          this.pendingTweets.delete(tweetData.element);
        } catch (error) {
          console.error('Error analyzing tweet:', error);
          this.pendingTweets.delete(tweetData.element);
        }
        
        // Add small delay between tweets in batch
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } finally {
      this.processing = false;
      if (this.highPriorityQueue.length > 0 || this.lowPriorityQueue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  getNextBatch() {
    const batch = [];
    
    while (batch.length < this.batchSize && this.highPriorityQueue.length > 0) {
      batch.push(this.highPriorityQueue.shift());
    }
    
    while (batch.length < this.batchSize && this.lowPriorityQueue.length > 0) {
      batch.push(this.lowPriorityQueue.shift());
    }
    
    return batch;
  }

  updatePriority(tweetElement, newPriority) {
    const tweetData = this.pendingTweets.get(tweetElement);
    if (!tweetData || tweetData.priority === newPriority) return;

    if (tweetData.priority === 'low') {
      const index = this.lowPriorityQueue.findIndex(t => t.element === tweetElement);
      if (index !== -1) {
        this.lowPriorityQueue.splice(index, 1);
        tweetData.priority = 'high';
        this.highPriorityQueue.push(tweetData);
        this.scheduleProcessing();
      }
    }
  }

  getQueueStats() {
    return {
      highPriority: this.highPriorityQueue.length,
      lowPriority: this.lowPriorityQueue.length,
      processing: this.processing
    };
  }

  clear() {
    if (this.idleCallbackId) {
      cancelIdleCallback(this.idleCallbackId);
    }
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];
    this.processing = false;
    this.pendingTweets = new WeakMap();
  }
}

window.AnalysisQueue = AnalysisQueue;