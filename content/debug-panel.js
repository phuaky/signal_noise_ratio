/**
 * Debug Panel for Signal/Noise Ratio Extension
 * Provides real-time debugging information when debug mode is active
 */

class DebugPanel {
  constructor() {
    this.panel = null;
    this.isMinimized = false;
    this.logs = [];
    this.maxLogs = 50;
    this.updateInterval = null;
    this.stats = {
      totalAnalyzed: 0,
      signalCount: 0,
      noiseCount: 0,
      avgLatency: 0,
      llmStatus: 'Unknown',
      lastAnalysis: null
    };
  }

  create() {
    // Create panel container
    this.panel = document.createElement('div');
    this.panel.className = 'snr-debug-panel';
    this.panel.innerHTML = `
      <div class="snr-debug-header">
        <h3>SNR Debug Panel</h3>
        <div class="snr-debug-controls">
          <button class="snr-debug-btn" id="snr-debug-minimize">_</button>
          <button class="snr-debug-btn" id="snr-debug-close">×</button>
        </div>
      </div>
      <div class="snr-debug-content">
        <div class="snr-debug-tabs">
          <button class="snr-debug-tab active" data-tab="stats">Stats</button>
          <button class="snr-debug-tab" data-tab="logs">Logs</button>
          <button class="snr-debug-tab" data-tab="settings">Settings</button>
        </div>
        
        <!-- Stats Tab -->
        <div class="snr-debug-tab-content active" id="snr-debug-stats">
          <div class="snr-debug-stat-grid">
            <div class="snr-debug-stat">
              <span class="stat-label">Total Analyzed</span>
              <span class="stat-value" id="debug-total-analyzed">0</span>
            </div>
            <div class="snr-debug-stat">
              <span class="stat-label">Signal Count</span>
              <span class="stat-value signal" id="debug-signal-count">0</span>
            </div>
            <div class="snr-debug-stat">
              <span class="stat-label">Noise Count</span>
              <span class="stat-value noise" id="debug-noise-count">0</span>
            </div>
            <div class="snr-debug-stat">
              <span class="stat-label">Avg Latency</span>
              <span class="stat-value" id="debug-avg-latency">0ms</span>
            </div>
            <div class="snr-debug-stat">
              <span class="stat-label">LLM Status</span>
              <span class="stat-value" id="debug-llm-status">Unknown</span>
            </div>
            <div class="snr-debug-stat">
              <span class="stat-label">Signal Rate</span>
              <span class="stat-value" id="debug-signal-rate">0%</span>
            </div>
          </div>
          <div class="snr-debug-last-analysis">
            <h4>Last Analysis</h4>
            <div id="debug-last-analysis">No analysis yet</div>
          </div>
        </div>
        
        <!-- Logs Tab -->
        <div class="snr-debug-tab-content" id="snr-debug-logs">
          <div class="snr-debug-log-controls">
            <select id="debug-log-level">
              <option value="">All Levels</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
            </select>
            <button class="snr-debug-btn" id="debug-clear-logs">Clear</button>
          </div>
          <div class="snr-debug-log-container" id="debug-log-container">
            <div class="debug-log-empty">No logs yet</div>
          </div>
        </div>
        
        <!-- Settings Tab -->
        <div class="snr-debug-tab-content" id="snr-debug-settings">
          <div class="snr-debug-setting">
            <label>
              <input type="checkbox" id="debug-show-timings" checked>
              Show Analysis Timings
            </label>
          </div>
          <div class="snr-debug-setting">
            <label>
              <input type="checkbox" id="debug-show-confidence" checked>
              Show Confidence Scores
            </label>
          </div>
          <div class="snr-debug-setting">
            <label>
              <input type="checkbox" id="debug-show-raw-scores" checked>
              Show Raw Scores
            </label>
          </div>
          <div class="snr-debug-setting">
            <label>
              <input type="checkbox" id="debug-auto-scroll-logs" checked>
              Auto-scroll Logs
            </label>
          </div>
          <div class="snr-debug-setting">
            <button class="snr-debug-btn" id="debug-export-logs">Export Logs</button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();
    
    // Append to body
    document.body.appendChild(this.panel);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start update interval
    this.startUpdateInterval();
    
    // Make panel draggable
    this.makeDraggable();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .snr-debug-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        background: rgba(0, 0, 0, 0.95);
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        transition: all 0.3s ease;
      }

      .snr-debug-panel.minimized {
        height: auto;
      }

      .snr-debug-panel.minimized .snr-debug-content {
        display: none;
      }

      .snr-debug-header {
        background: rgba(59, 130, 246, 0.9);
        padding: 12px 16px;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      }

      .snr-debug-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .snr-debug-controls {
        display: flex;
        gap: 8px;
      }

      .snr-debug-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: #fff;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: background 0.2s;
      }

      .snr-debug-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .snr-debug-content {
        padding: 16px;
        max-height: 500px;
        overflow-y: auto;
      }

      .snr-debug-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .snr-debug-tab {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .snr-debug-tab:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .snr-debug-tab.active {
        background: rgba(59, 130, 246, 0.5);
        border-color: rgba(59, 130, 246, 0.8);
      }

      .snr-debug-tab-content {
        display: none;
      }

      .snr-debug-tab-content.active {
        display: block;
      }

      .snr-debug-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }

      .snr-debug-stat {
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .stat-label {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 4px;
      }

      .stat-value {
        display: block;
        font-size: 20px;
        font-weight: 600;
      }

      .stat-value.signal {
        color: #10b981;
      }

      .stat-value.noise {
        color: #ef4444;
      }

      .snr-debug-last-analysis {
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .snr-debug-last-analysis h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
      }

      #debug-last-analysis {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.5;
      }

      .snr-debug-log-controls {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        gap: 8px;
      }

      #debug-log-level {
        flex: 1;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 6px;
        border-radius: 4px;
      }

      .snr-debug-log-container {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        height: 300px;
        overflow-y: auto;
        padding: 8px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }

      .debug-log-entry {
        margin-bottom: 4px;
        padding: 4px;
        border-radius: 3px;
        word-break: break-word;
      }

      .debug-log-entry.DEBUG {
        color: #9ca3af;
      }

      .debug-log-entry.INFO {
        color: #3b82f6;
      }

      .debug-log-entry.WARN {
        color: #f59e0b;
      }

      .debug-log-entry.ERROR {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .debug-log-empty {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 20px;
      }

      .snr-debug-setting {
        margin-bottom: 12px;
      }

      .snr-debug-setting label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .snr-debug-setting input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      #debug-export-logs {
        width: 100%;
        padding: 8px;
        margin-top: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // Tab switching
    this.panel.querySelectorAll('.snr-debug-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tab states
        this.panel.querySelectorAll('.snr-debug-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content visibility
        this.panel.querySelectorAll('.snr-debug-tab-content').forEach(content => {
          content.classList.remove('active');
        });
        this.panel.querySelector(`#snr-debug-${tabName}`).classList.add('active');
      });
    });

    // Minimize/restore
    this.panel.querySelector('#snr-debug-minimize').addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      this.panel.classList.toggle('minimized');
      this.panel.querySelector('#snr-debug-minimize').textContent = this.isMinimized ? '□' : '_';
    });

    // Close
    this.panel.querySelector('#snr-debug-close').addEventListener('click', () => {
      this.destroy();
    });

    // Clear logs
    this.panel.querySelector('#debug-clear-logs').addEventListener('click', () => {
      this.logs = [];
      this.updateLogs();
    });

    // Export logs
    this.panel.querySelector('#debug-export-logs').addEventListener('click', () => {
      this.exportLogs();
    });

    // Log level filter
    this.panel.querySelector('#debug-log-level').addEventListener('change', () => {
      this.updateLogs();
    });
  }

  makeDraggable() {
    const header = this.panel.querySelector('.snr-debug-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', (e) => {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === header || e.target.parentNode === header) {
        isDragging = true;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        this.panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  startUpdateInterval() {
    this.updateInterval = setInterval(() => {
      this.updateStats();
    }, 1000);
  }

  async updateStats() {
    // Get stats from storage
    const stats = await chrome.storage.local.get(['snr_stats', 'llmConnected']);
    
    if (stats.snr_stats) {
      this.stats.totalAnalyzed = stats.snr_stats.totalAnalyzed || 0;
      this.stats.signalCount = stats.snr_stats.signalCount || 0;
      this.stats.noiseCount = stats.snr_stats.noiseCount || 0;
    }

    this.stats.llmStatus = stats.llmConnected ? 'Connected' : 'Disconnected';

    // Update UI
    this.panel.querySelector('#debug-total-analyzed').textContent = this.stats.totalAnalyzed;
    this.panel.querySelector('#debug-signal-count').textContent = this.stats.signalCount;
    this.panel.querySelector('#debug-noise-count').textContent = this.stats.noiseCount;
    this.panel.querySelector('#debug-avg-latency').textContent = this.stats.avgLatency + 'ms';
    
    const llmStatusEl = this.panel.querySelector('#debug-llm-status');
    llmStatusEl.textContent = this.stats.llmStatus;
    llmStatusEl.style.color = stats.llmConnected ? '#10b981' : '#ef4444';

    // Calculate signal rate
    const signalRate = this.stats.totalAnalyzed > 0 
      ? Math.round((this.stats.signalCount / this.stats.totalAnalyzed) * 100)
      : 0;
    this.panel.querySelector('#debug-signal-rate').textContent = signalRate + '%';
  }

  addLog(levelOrEntry, message, data) {
    let log;
    
    // Handle both formats: addLog(level, message, data) and addLog(logEntry)
    if (typeof levelOrEntry === 'object' && levelOrEntry.level) {
      log = levelOrEntry;
    } else {
      log = {
        timestamp: new Date().toISOString(),
        level: levelOrEntry,
        message,
        data
      };
    }
    
    this.logs.unshift(log);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    this.updateLogs();
  }

  updateLogs() {
    const container = this.panel.querySelector('#debug-log-container');
    const levelFilter = this.panel.querySelector('#debug-log-level').value;
    const autoScroll = this.panel.querySelector('#debug-auto-scroll-logs').checked;
    
    // Filter logs
    const filteredLogs = levelFilter 
      ? this.logs.filter(log => log.level === levelFilter)
      : this.logs;
    
    if (filteredLogs.length === 0) {
      container.innerHTML = '<div class="debug-log-empty">No logs</div>';
      return;
    }
    
    container.innerHTML = filteredLogs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      let logHtml = `<div class="debug-log-entry ${log.level}">`;
      logHtml += `[${time}] [${log.level}] ${log.message}`;
      if (log.data) {
        logHtml += `\n${JSON.stringify(log.data, null, 2)}`;
      }
      logHtml += '</div>';
      return logHtml;
    }).join('');
    
    // Auto-scroll to bottom
    if (autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  }

  updateLastAnalysis(result) {
    this.stats.lastAnalysis = result;
    
    const container = this.panel.querySelector('#debug-last-analysis');
    if (!result) {
      container.textContent = 'No analysis yet';
      return;
    }
    
    const showTimings = this.panel.querySelector('#debug-show-timings').checked;
    const showConfidence = this.panel.querySelector('#debug-show-confidence').checked;
    const showRawScores = this.panel.querySelector('#debug-show-raw-scores').checked;
    
    let html = `Score: ${result.score} (${result.isSignal ? 'Signal' : 'Noise'})<br>`;
    
    if (result.reason) {
      html += `Reason: ${result.reason}<br>`;
    }
    
    if (showConfidence && result.confidence) {
      html += `Confidence: ${result.confidence}<br>`;
    }
    
    if (showTimings && result.latency) {
      html += `Latency: ${result.latency}ms<br>`;
    }
    
    if (showRawScores && result.agentScores) {
      html += `Agent Scores:<br>`;
      Object.entries(result.agentScores).forEach(([agent, data]) => {
        html += `  - ${agent}: ${data.score}<br>`;
      });
    }
    
    container.innerHTML = html;
    
    // Update average latency
    if (result.latency) {
      // Simple moving average
      this.stats.avgLatency = Math.round(
        (this.stats.avgLatency * 0.9) + (result.latency * 0.1)
      );
    }
  }

  exportLogs() {
    const logsData = {
      exportTime: new Date().toISOString(),
      stats: this.stats,
      logs: this.logs
    };
    
    const blob = new Blob([JSON.stringify(logsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snr-debug-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.panel) {
      this.panel.remove();
    }
    
    // Notify that debug panel was closed
    window.dispatchEvent(new CustomEvent('snr-debug-panel-closed'));
  }
}

// Export for use in content script
window.DebugPanel = DebugPanel;