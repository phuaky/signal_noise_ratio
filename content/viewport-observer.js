class ViewportObserver {
  constructor(analysisQueue) {
    this.analysisQueue = analysisQueue;
    this.observer = null;
    this.observedTweets = new WeakSet();
    this.visibilityThreshold = 0.1;
    this.lookAheadPixels = 500;
    this.init();
  }

  init() {
    const options = {
      root: null,
      rootMargin: `${this.lookAheadPixels}px 0px ${this.lookAheadPixels}px 0px`,
      threshold: [0, this.visibilityThreshold, 0.5, 1.0]
    };

    this.observer = new IntersectionObserver((entries) => {
      this.handleIntersection(entries);
    }, options);
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      const tweet = entry.target;
      
      if (entry.isIntersecting) {
        if (entry.intersectionRatio >= this.visibilityThreshold) {
          this.analysisQueue.updatePriority(tweet, 'high');
        }
      }
    });
  }

  observe(tweetElement) {
    if (!this.observedTweets.has(tweetElement)) {
      this.observer.observe(tweetElement);
      this.observedTweets.add(tweetElement);
    }
  }

  unobserve(tweetElement) {
    this.observer.unobserve(tweetElement);
    this.observedTweets.delete(tweetElement);
  }

  updateLookAhead(pixels) {
    this.lookAheadPixels = pixels;
    this.disconnect();
    this.init();
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  isElementNearViewport(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    
    return (
      rect.bottom >= -this.lookAheadPixels &&
      rect.top <= windowHeight + this.lookAheadPixels
    );
  }
}

window.ViewportObserver = ViewportObserver;