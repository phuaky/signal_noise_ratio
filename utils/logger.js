/**
 * Centralized logging service for the Signal/Noise Ratio Chrome Extension
 * Provides structured logging with levels, storage, and consistent formatting
 */

class ExtensionLogger {
  constructor() {
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    
    this.currentLevel = this.logLevels.INFO;
    this.maxStoredLogs = 1000;
    this.componentColors = {
      'content': '#3b82f6',
      'background': '#8b5cf6',
      'popup': '#ec4899',
      'options': '#10b981',
      'analyzer': '#f59e0b',
      'llm-service': '#ef4444',
      'training': '#06b6d4'
    };
    
    // Initialize with default values immediately
    this.enableStorage = true;
    this.debugMode = false;
    
    // Promise to track initialization status
    this._initPromise = null;
    this._initialized = false;
    
    // Queue for logs that arrive before initialization
    this._logQueue = [];
  }

  /**
   * Initialize the logger with settings from Chrome storage
   */
  async init() {
    // Return existing promise if already initializing
    if (this._initPromise) {
      return this._initPromise;
    }
    
    this._initPromise = this._doInit();
    return this._initPromise;
  }
  
  async _doInit() {
    try {
      // Test storage accessibility
      await this._testStorageAccess();
      
      const settings = await chrome.storage.local.get(['logLevel', 'enableLogStorage', 'debugMode', 'maxStoredLogs']);
      this.currentLevel = this.logLevels[settings.logLevel || 'INFO'];
      this.enableStorage = settings.enableLogStorage !== false; // Default to true
      this.debugMode = settings.debugMode || false;
      this.maxStoredLogs = settings.maxStoredLogs || 1000;
      
      // Clean up old logs periodically
      this.scheduleLogCleanup();
      
      // Listen for settings changes
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          if (changes.logLevel) {
            this.currentLevel = this.logLevels[changes.logLevel.newValue];
          }
          if (changes.enableLogStorage) {
            this.enableStorage = changes.enableLogStorage.newValue;
          }
          if (changes.maxStoredLogs) {
            this.maxStoredLogs = changes.maxStoredLogs.newValue;
          }
          if (changes.debugMode) {
            this.debugMode = changes.debugMode.newValue;
          }
        }
      });
      
      this._initialized = true;
      
      // Process any queued logs
      if (this._logQueue.length > 0) {
        console.log(`[Logger] Processing ${this._logQueue.length} queued logs`);
        for (const queuedLog of this._logQueue) {
          await this._processLog(queuedLog);
        }
        this._logQueue = [];
      }
      
      console.log('[Logger] Initialized successfully', {
        enableStorage: this.enableStorage,
        logLevel: Object.keys(this.logLevels).find(k => this.logLevels[k] === this.currentLevel),
        maxStoredLogs: this.maxStoredLogs
      });
    } catch (error) {
      console.error('[Logger] Initialization failed:', error);
      // Use defaults on error
      this._initialized = true;
    }
  }
  
  /**
   * Test storage accessibility and log diagnostics
   */
  async _testStorageAccess() {
    try {
      // Test write
      const testKey = '_logger_test_' + Date.now();
      await chrome.storage.local.set({ [testKey]: true });
      
      // Test read
      const result = await chrome.storage.local.get(testKey);
      if (!result[testKey]) {
        throw new Error('Storage read verification failed');
      }
      
      // Test remove
      await chrome.storage.local.remove(testKey);
      
      // Check storage quota
      if (chrome.storage.local.getBytesInUse) {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        const percentUsed = Math.round((bytesInUse / quota) * 100);
        
        console.log('[Logger] Storage diagnostics:', {
          bytesInUse,
          quota,
          percentUsed: percentUsed + '%',
          available: quota - bytesInUse
        });
        
        if (percentUsed > 80) {
          console.warn('[Logger] Storage usage is high:', percentUsed + '%');
        }
      }
      
      // Check existing logs
      const { logs = [] } = await chrome.storage.local.get('logs');
      console.log('[Logger] Existing logs count:', logs.length);
      
    } catch (error) {
      console.error('[Logger] Storage access test failed:', error);
      throw error;
    }
  }

  /**
   * Format timestamp for log entries
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Get caller component from stack trace
   */
  getComponent() {
    try {
      const stack = new Error().stack;
      const lines = stack.split('\n');
      
      // Look for known component files in the stack
      for (const line of lines) {
        if (line.includes('content.js')) return 'content';
        if (line.includes('background.js')) return 'background';
        if (line.includes('popup.js')) return 'popup';
        if (line.includes('options.js')) return 'options';
        if (line.includes('analyzer.js')) return 'analyzer';
        if (line.includes('llm-service.js')) return 'llm-service';
        if (line.includes('training')) return 'training';
      }
    } catch (e) {
      // Fallback if stack trace fails
    }
    return 'unknown';
  }

  /**
   * Core logging method
   */
  async log(level, message, data = null) {
    const levelName = Object.keys(this.logLevels).find(key => this.logLevels[key] === level);
    const levelValue = this.logLevels[levelName] || this.logLevels.INFO;
    
    // Skip if below current log level
    if (levelValue < this.currentLevel) return;

    const component = this.getComponent();
    const timestamp = this.getTimestamp();
    
    const logEntry = {
      timestamp,
      level: levelName,
      component,
      message,
      data
    };

    // If not initialized yet, queue the log
    if (!this._initialized) {
      this._logQueue.push(logEntry);
      // Still show in console
      this.consoleOutput(logEntry);
      // Ensure init is called
      if (!this._initPromise) {
        this.init();
      }
      return;
    }
    
    await this._processLog(logEntry);
  }
  
  async _processLog(logEntry) {
    // Console output with styling
    this.consoleOutput(logEntry);
    
    // Store in Chrome storage if enabled
    if (this.enableStorage) {
      await this.storeLog(logEntry);
    }
    
    // Send to monitor dashboard if connected
    this.sendToMonitor(logEntry);
  }

  /**
   * Console output with component-based coloring
   */
  consoleOutput(logEntry) {
    const { timestamp, level, component, message, data } = logEntry;
    const color = this.componentColors[component] || '#6b7280';
    
    const prefix = `%c[${component}] %c[${level}]`;
    const styles = [
      `color: ${color}; font-weight: bold`,
      `color: ${this.getLevelColor(level)}`
    ];
    
    if (data) {
      console.log(`${prefix} ${message}`, ...styles, data);
    } else {
      console.log(`${prefix} ${message}`, ...styles);
    }
  }

  /**
   * Get color for log level
   */
  getLevelColor(level) {
    const colors = {
      DEBUG: '#9ca3af',
      INFO: '#3b82f6',
      WARN: '#f59e0b',
      ERROR: '#ef4444'
    };
    return colors[level] || '#6b7280';
  }

  /**
   * Store log entry in Chrome storage
   */
  async storeLog(logEntry, retryCount = 0) {
    try {
      const result = await chrome.storage.local.get('logs');
      const logs = result.logs || [];
      
      // Add new entry
      logs.push(logEntry);
      
      // Trim to max size
      if (logs.length > this.maxStoredLogs) {
        logs.splice(0, logs.length - this.maxStoredLogs);
      }
      
      await chrome.storage.local.set({ logs });
    } catch (error) {
      console.error('Failed to store log:', error);
      
      // Retry logic for quota exceeded errors
      if (error.message && error.message.includes('QUOTA_BYTES') && retryCount < 3) {
        console.warn(`Storage quota exceeded, attempting cleanup (retry ${retryCount + 1}/3)`);
        
        try {
          // Emergency cleanup - remove oldest 25% of logs
          const result = await chrome.storage.local.get('logs');
          const logs = result.logs || [];
          const removeCount = Math.floor(logs.length * 0.25);
          
          if (removeCount > 0) {
            logs.splice(0, removeCount);
            await chrome.storage.local.set({ logs });
            
            // Retry storing the new log
            await this.storeLog(logEntry, retryCount + 1);
          }
        } catch (cleanupError) {
          console.error('Emergency log cleanup failed:', cleanupError);
          // Add to failed queue for later retry
          this._addToFailedQueue(logEntry);
        }
      } else {
        // Add to failed queue for later retry
        this._addToFailedQueue(logEntry);
      }
    }
  }
  
  /**
   * Add log to failed queue for later retry
   */
  _addToFailedQueue(logEntry) {
    if (!this._failedLogs) {
      this._failedLogs = [];
    }
    
    this._failedLogs.push({
      log: logEntry,
      failedAt: new Date().toISOString()
    });
    
    // Keep only recent failed logs (max 50)
    if (this._failedLogs.length > 50) {
      this._failedLogs = this._failedLogs.slice(-50);
    }
    
    // Schedule retry if not already scheduled
    if (!this._retryTimeout) {
      this._retryTimeout = setTimeout(() => this._retryFailedLogs(), 30000); // Retry after 30 seconds
    }
  }
  
  /**
   * Retry storing failed logs
   */
  async _retryFailedLogs() {
    this._retryTimeout = null;
    
    if (!this._failedLogs || this._failedLogs.length === 0) {
      return;
    }
    
    console.log(`[Logger] Retrying ${this._failedLogs.length} failed logs`);
    
    const failedLogs = [...this._failedLogs];
    this._failedLogs = [];
    
    for (const { log } of failedLogs) {
      try {
        await this.storeLog(log);
      } catch (error) {
        // Will be re-added to failed queue
        console.error('Retry failed for log:', error);
      }
    }
  }

  /**
   * Send log to monitor dashboard via message passing
   */
  sendToMonitor(logEntry) {
    try {
      // Send to all tabs that might have the monitor open
      chrome.runtime.sendMessage({
        action: 'monitorLog',
        log: logEntry
      }).catch(() => {
        // Ignore errors if no listener
      });
      
      // Also send to debug panel if it exists
      if (window.debugPanel) {
        window.debugPanel.addLog(logEntry.level, logEntry.message, logEntry.data);
      }
      
      // Support for __snrDebugPanel global reference
      if (window.__snrDebugPanel) {
        window.__snrDebugPanel.addLog(logEntry);
      }
    } catch (e) {
      // Ignore if messaging fails
    }
  }

  /**
   * Schedule periodic cleanup of old logs
   */
  scheduleLogCleanup() {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        const result = await chrome.storage.local.get('logs');
        const logs = result.logs || [];
        
        // Remove logs older than 24 hours
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
        const filteredLogs = logs.filter(log => {
          const logTime = new Date(log.timestamp).getTime();
          return logTime > cutoffTime;
        });
        
        if (filteredLogs.length < logs.length) {
          await chrome.storage.local.set({ logs: filteredLogs });
        }
      } catch (error) {
        console.error('Log cleanup failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Public logging methods
   */
  debug(message, data) {
    return this.log(this.logLevels.DEBUG, message, data);
  }

  info(message, data) {
    return this.log(this.logLevels.INFO, message, data);
  }

  warn(message, data) {
    return this.log(this.logLevels.WARN, message, data);
  }

  error(message, data) {
    return this.log(this.logLevels.ERROR, message, data);
  }

  /**
   * Specialized logging methods
   */
  async logAnalysis(result) {
    const message = `Tweet analysis: ${result.isSignal ? 'Signal' : 'Noise'} (score: ${result.score})`;
    await this.info(message, {
      score: result.score,
      isSignal: result.isSignal,
      reason: result.reason,
      method: result.method,
      confidence: result.confidence,
      latency: result.latency
    });
  }

  async logConnection(status, details) {
    const message = `LLM connection ${status}`;
    await this.info(message, details);
  }

  async logPerformance(metric, value, details) {
    const message = `Performance: ${metric} = ${value}`;
    await this.debug(message, details);
  }

  /**
   * Get stored logs
   */
  async getLogs(filters = {}) {
    const result = await chrome.storage.local.get('logs');
    let logs = result.logs || [];
    
    // Apply filters
    if (filters.level) {
      const minLevel = this.logLevels[filters.level];
      logs = logs.filter(log => this.logLevels[log.level] >= minLevel);
    }
    
    if (filters.component) {
      logs = logs.filter(log => log.component === filters.component);
    }
    
    if (filters.startTime) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startTime));
    }
    
    if (filters.endTime) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endTime));
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data).toLowerCase().includes(searchLower)
      );
    }
    
    return logs;
  }

  /**
   * Clear stored logs
   */
  async clearLogs() {
    await chrome.storage.local.set({ logs: [] });
  }

  /**
   * Export logs as JSON
   */
  async exportLogs(filters = {}) {
    const logs = await this.getLogs(filters);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs as CSV
   */
  async exportLogsCSV(filters = {}) {
    const logs = await this.getLogs(filters);
    
    // CSV header
    let csv = 'Timestamp,Level,Component,Message,Data\n';
    
    // CSV rows
    logs.forEach(log => {
      const data = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : '';
      csv += `"${log.timestamp}","${log.level}","${log.component}","${log.message}","${data}"\n`;
    });
    
    return csv;
  }
  
  /**
   * Get storage status and diagnostics
   */
  async getStorageStatus() {
    const status = {
      initialized: this._initialized,
      enableStorage: this.enableStorage,
      currentLevel: Object.keys(this.logLevels).find(k => this.logLevels[k] === this.currentLevel),
      maxStoredLogs: this.maxStoredLogs,
      queuedLogs: this._logQueue.length,
      failedLogs: this._failedLogs ? this._failedLogs.length : 0
    };
    
    try {
      // Get storage metrics
      if (chrome.storage.local.getBytesInUse) {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
        
        status.storage = {
          bytesInUse,
          quota,
          percentUsed: Math.round((bytesInUse / quota) * 100),
          available: quota - bytesInUse
        };
      }
      
      // Get log count
      const { logs = [] } = await chrome.storage.local.get('logs');
      status.storedLogs = logs.length;
      
      // Test write capability
      try {
        const testKey = '_logger_test_' + Date.now();
        await chrome.storage.local.set({ [testKey]: true });
        await chrome.storage.local.remove(testKey);
        status.canWrite = true;
      } catch (error) {
        status.canWrite = false;
        status.writeError = error.message;
      }
    } catch (error) {
      status.error = error.message;
    }
    
    return status;
  }
}

// Create singleton instance
const logger = new ExtensionLogger();

// Initialize on first use
if (typeof chrome !== 'undefined' && chrome.storage) {
  logger.init().catch(console.error);
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
} else {
  window.ExtensionLogger = logger;
  // Also expose shorthand global for convenience
  window.extLog = logger;
}