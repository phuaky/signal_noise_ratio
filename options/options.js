// Options page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.local.get([
    'useAI',
    'useLocalLLM',
    'apiProvider',
    'apiKey',
    'showIndicators',
    'autoHide',
    'showDashboard',
    'useWaveform',
    'showReasoning',
    'threshold',
    'interests',
    'signalPatterns',
    'noisePatterns',
    'enableTraining',
    'enableParallelModels',
    'enabledModels',
    'enablePreAnalysis',
    'preAnalysisBatchSize',
    'preAnalysisLookAhead',
    'maxQueueSize',
    'logLevel',
    'enableLogStorage',
    'maxStoredLogs',
    'logPerformanceMetrics'
  ]);

  // Local LLM is the only method now - no need to set radio buttons
  // Remove API provider and key settings since we don't use them
  document.getElementById('show-indicators').checked = settings.showIndicators !== false;
  document.getElementById('auto-hide').checked = settings.autoHide || false;
  document.getElementById('show-dashboard').checked = settings.showDashboard !== false;
  document.getElementById('use-waveform').checked = settings.useWaveform !== false;
  document.getElementById('show-reasoning').checked = settings.showReasoning || false;
  document.getElementById('noise-threshold').value = settings.threshold || 30;
  document.getElementById('interests').value = settings.interests || '';
  document.getElementById('signal-patterns').value = settings.signalPatterns || '';
  document.getElementById('noise-patterns').value = settings.noisePatterns || '';
  document.getElementById('enable-training').checked = settings.enableTraining !== false;
  document.getElementById('enable-parallel-models').checked = settings.enableParallelModels || false;
  
  // Set pre-analysis settings
  document.getElementById('enable-preanalysis').checked = settings.enablePreAnalysis !== false;
  document.getElementById('preanalysis-lookahead').value = settings.preAnalysisLookAhead || 500;
  document.getElementById('preanalysis-batch-size').value = settings.preAnalysisBatchSize || 5;
  document.getElementById('preanalysis-queue-size').value = settings.maxQueueSize || 100;
  
  // Set model checkboxes
  if (settings.enabledModels) {
    document.getElementById('model-anthropic').checked = settings.enabledModels.anthropic !== false;
    document.getElementById('model-openai').checked = settings.enabledModels.openai || false;
    document.getElementById('model-local').checked = settings.enabledModels.localLLM !== false;
  }
  
  // Set logging settings
  document.getElementById('enable-log-storage').checked = settings.enableLogStorage !== false;
  document.getElementById('log-level').value = settings.logLevel || 'INFO';
  document.getElementById('max-stored-logs').value = settings.maxStoredLogs || 1000;
  document.getElementById('max-stored-logs-value').textContent = settings.maxStoredLogs || 1000;
  document.getElementById('log-performance-metrics').checked = settings.logPerformanceMetrics !== false;

  // Always show LLM settings and check connection
  document.getElementById('local-llm-settings').style.display = 'block';
  checkLLMConnection();

  // Update slider value display
  updateSliderValue();
  
  // Load training data stats
  loadTrainingStats();
  
  // Toggle parallel models config
  toggleParallelModelsConfig();

  // No radio buttons for analysis method anymore

  document.getElementById('noise-threshold').addEventListener('input', updateSliderValue);
  document.getElementById('preanalysis-lookahead').addEventListener('input', updateSliderValue);
  document.getElementById('preanalysis-batch-size').addEventListener('input', updateSliderValue);
  document.getElementById('preanalysis-queue-size').addEventListener('input', updateSliderValue);
  document.getElementById('max-stored-logs').addEventListener('input', updateSliderValue);
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('clear-data').addEventListener('click', clearData);
  
  // Training data management
  document.getElementById('export-training').addEventListener('click', exportTrainingData);
  document.getElementById('import-training').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importTrainingData);
  document.getElementById('clear-training').addEventListener('click', clearTrainingData);
  
  // Parallel models toggle
  document.getElementById('enable-parallel-models').addEventListener('change', toggleParallelModelsConfig);
  
  // Pre-analysis toggle
  document.getElementById('enable-preanalysis').addEventListener('change', togglePreAnalysisSettings);
  togglePreAnalysisSettings();
});

// Removed toggleMethodSettings - no longer needed since only local LLM is supported

async function checkLLMConnection() {
  const statusEl = document.getElementById('llm-status');
  statusEl.textContent = 'Checking connection...';
  statusEl.className = '';
  
  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    
    if (data.status === 'ok' && data.ollama.connected) {
      const modelCount = data.ollama.models.length;
      if (modelCount > 0) {
        const models = data.ollama.models.map(m => m.name).join(', ');
        statusEl.textContent = `Connected! Models available: ${models}`;
        statusEl.className = 'connected';
      } else {
        statusEl.textContent = 'Server running but no models installed. Run: ollama pull llama3.2:1b';
        statusEl.className = 'disconnected';
      }
    } else {
      statusEl.textContent = 'Server running but Ollama not connected';
      statusEl.className = 'disconnected';
    }
  } catch (error) {
    statusEl.textContent = 'Cannot connect to local server. Make sure it\'s running.';
    statusEl.className = 'disconnected';
  }
}

function updateSliderValue(event) {
  const slider = event ? event.target : document.getElementById('noise-threshold');
  const value = slider.value;
  const valueDisplay = slider.parentElement.querySelector('.slider-value') || 
                       document.getElementById(slider.id + '-value');
  
  if (valueDisplay) {
    if (slider.id === 'preanalysis-lookahead') {
      valueDisplay.textContent = `${value}px`;
    } else if (slider.id === 'noise-threshold') {
      valueDisplay.textContent = `${value}%`;
    } else {
      valueDisplay.textContent = value;
    }
  }
}

function togglePreAnalysisSettings() {
  const enabled = document.getElementById('enable-preanalysis').checked;
  const settingsDiv = document.getElementById('preanalysis-settings');
  if (settingsDiv) {
    settingsDiv.style.display = enabled ? 'block' : 'none';
  }
}

async function saveSettings() {
  // Always use local LLM, never cloud AI
  const settings = {
    useAI: false,
    useLocalLLM: true,
    showIndicators: document.getElementById('show-indicators').checked,
    autoHide: document.getElementById('auto-hide').checked,
    showDashboard: document.getElementById('show-dashboard').checked,
    useWaveform: document.getElementById('use-waveform').checked,
    showReasoning: document.getElementById('show-reasoning').checked,
    threshold: parseInt(document.getElementById('noise-threshold').value),
    interests: document.getElementById('interests').value,
    signalPatterns: document.getElementById('signal-patterns').value,
    noisePatterns: document.getElementById('noise-patterns').value,
    enableTraining: document.getElementById('enable-training').checked,
    enableParallelModels: document.getElementById('enable-parallel-models').checked,
    enabledModels: {
      anthropic: document.getElementById('model-anthropic').checked,
      openai: document.getElementById('model-openai').checked,
      localLLM: document.getElementById('model-local').checked
    },
    enablePreAnalysis: document.getElementById('enable-preanalysis').checked,
    preAnalysisLookAhead: parseInt(document.getElementById('preanalysis-lookahead').value),
    preAnalysisBatchSize: parseInt(document.getElementById('preanalysis-batch-size').value),
    maxQueueSize: parseInt(document.getElementById('preanalysis-queue-size').value),
    // Logging settings
    logLevel: document.getElementById('log-level').value,
    enableLogStorage: document.getElementById('enable-log-storage').checked,
    maxStoredLogs: parseInt(document.getElementById('max-stored-logs').value),
    logPerformanceMetrics: document.getElementById('log-performance-metrics').checked
  };

  try {
    await chrome.storage.local.set(settings);
    
    // Show success message
    const status = document.getElementById('save-status');
    status.textContent = 'Settings saved successfully!';
    status.className = 'save-status success';
    
    // Hide message after 3 seconds
    setTimeout(() => {
      status.className = 'save-status';
    }, 3000);

    // Notify content scripts to update
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateSettings',
            settings: {
              autoHide: settings.autoHide,
              showIndicators: settings.showIndicators,
              threshold: settings.threshold,
              enableTraining: settings.enableTraining,
              enablePreAnalysis: settings.enablePreAnalysis,
              preAnalysisLookAhead: settings.preAnalysisLookAhead,
              preAnalysisBatchSize: settings.preAnalysisBatchSize,
              maxQueueSize: settings.maxQueueSize
            }
          });
        }
      });
    });
  } catch (error) {
    // Show error message
    const status = document.getElementById('save-status');
    status.textContent = 'Error saving settings';
    status.className = 'save-status error';
    console.error('Error saving settings:', error);
  }
}

async function exportData() {
  try {
    const data = await chrome.storage.local.get(null);
    
    // Get stats from all tabs
    const tabs = await chrome.tabs.query({});
    const twitterTabs = tabs.filter(tab => 
      tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))
    );
    
    const stats = [];
    for (const tab of twitterTabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
        if (response) {
          stats.push({
            tabId: tab.id,
            url: tab.url,
            ...response
          });
        }
      } catch (e) {
        // Tab might not have content script loaded
      }
    }

    const exportData = {
      settings: data,
      stats: stats,
      exportDate: new Date().toISOString()
    };

    // Create download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal-noise-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Show success message
    const btn = document.getElementById('export-data');
    const originalText = btn.textContent;
    btn.textContent = 'Exported!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data');
  }
}

async function clearData() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    
    // Reload the page to reset form
    window.location.reload();
  } catch (error) {
    console.error('Error clearing data:', error);
    alert('Error clearing data');
  }
}

// Training data management functions
async function loadTrainingStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCategories' });
    const categories = response.categories || [];
    
    const statsDiv = document.getElementById('category-stats');
    
    if (categories.length === 0) {
      statsDiv.innerHTML = '<p>No training data yet. Start categorizing tweets to train the AI!</p>';
      return;
    }
    
    const totalExamples = categories.reduce((sum, cat) => sum + cat.count, 0);
    
    statsDiv.innerHTML = `
      <p><strong>Total Training Examples:</strong> ${totalExamples}</p>
      <div class="category-list">
        ${categories.map(cat => `
          <div class="category-item">
            <span class="category-name">${cat.name}</span>
            <span class="category-count">${cat.count}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Failed to load training stats:', error);
  }
}

async function exportTrainingData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'exportTrainingData' });
    
    if (!response || !response.data) {
      alert('No training data to export');
      return;
    }
    
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Show success
    const btn = document.getElementById('export-training');
    const originalText = btn.textContent;
    btn.textContent = 'Exported!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Failed to export training data:', error);
    alert('Failed to export training data');
  }
}

async function importTrainingData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    const response = await chrome.runtime.sendMessage({
      action: 'importTrainingData',
      data: data
    });
    
    if (response.success) {
      alert('Training data imported successfully!');
      loadTrainingStats(); // Reload stats
    } else {
      alert('Failed to import training data: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Failed to import training data:', error);
    alert('Failed to import training data. Make sure the file is valid.');
  }
  
  // Clear the input
  event.target.value = '';
}

async function clearTrainingData() {
  if (!confirm('Are you sure you want to clear all training data? This cannot be undone.')) {
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'clearTrainingData' });
    
    if (response.success) {
      alert('Training data cleared successfully');
      loadTrainingStats(); // Reload stats
    } else {
      alert('Failed to clear training data');
    }
  } catch (error) {
    console.error('Failed to clear training data:', error);
    alert('Failed to clear training data');
  }
}

function toggleParallelModelsConfig() {
  const enabled = document.getElementById('enable-parallel-models').checked;
  document.getElementById('parallel-models-config').style.display = enabled ? 'block' : 'none';
}

// Tab functionality
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    
    // Update button states
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load logs if switching to logs tab
    if (tabName === 'logs') {
      loadLogs();
    }
  });
});

// Logs viewer functionality
let autoRefreshInterval;
let currentLogs = [];

async function loadLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '<div class="logs-loading">Loading logs...</div>';
  
  try {
    // Get filter values
    const levelFilter = document.getElementById('log-level-filter').value;
    const componentFilter = document.getElementById('log-component-filter').value;
    const searchFilter = document.getElementById('log-search').value;
    
    // Get logs with filters
    const logs = await extLog.getLogs({
      level: levelFilter,
      component: componentFilter,
      search: searchFilter
    });
    
    currentLogs = logs;
    
    // Update stats
    document.getElementById('log-count').textContent = `${logs.length} logs`;
    const sizeInKB = Math.ceil(JSON.stringify(logs).length / 1024);
    document.getElementById('log-size').textContent = `${sizeInKB} KB`;
    
    // Render logs
    if (logs.length === 0) {
      container.innerHTML = '<div class="logs-loading">No logs found</div>';
    } else {
      container.innerHTML = '';
      
      // Render in reverse order (newest first)
      logs.reverse().forEach(log => {
        const entry = createLogEntry(log);
        container.appendChild(entry);
      });
    }
  } catch (error) {
    container.innerHTML = '<div class="logs-loading">Failed to load logs</div>';
    console.error('Failed to load logs:', error);
  }
}

function createLogEntry(log) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const timestamp = new Date(log.timestamp).toLocaleString();
  
  entry.innerHTML = `
    <span class="log-timestamp">${timestamp}</span>
    <span class="log-level ${log.level}">${log.level}</span>
    <span class="log-component">[${log.component}]</span>
    <span class="log-message">${escapeHtml(log.message)}</span>
  `;
  
  if (log.data) {
    const dataDiv = document.createElement('div');
    dataDiv.className = 'log-data';
    dataDiv.textContent = JSON.stringify(log.data, null, 2);
    entry.appendChild(dataDiv);
  }
  
  return entry;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Log filters
document.getElementById('log-level-filter').addEventListener('change', loadLogs);
document.getElementById('log-component-filter').addEventListener('change', loadLogs);
document.getElementById('log-search').addEventListener('input', debounce(loadLogs, 300));

// Log actions
document.getElementById('refresh-logs').addEventListener('click', loadLogs);

document.getElementById('clear-logs').addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all logs?')) {
    await extLog.clearLogs();
    loadLogs();
  }
});

document.getElementById('export-logs').addEventListener('click', () => {
  showExportDialog();
});

// Auto-refresh
document.getElementById('auto-refresh').addEventListener('change', (e) => {
  if (e.target.checked) {
    autoRefreshInterval = setInterval(loadLogs, 5000); // Refresh every 5 seconds
  } else {
    clearInterval(autoRefreshInterval);
  }
});

// Export functionality
function showExportDialog() {
  // Create dialog if it doesn't exist
  let dialog = document.querySelector('.export-dialog');
  let overlay = document.querySelector('.dialog-overlay');
  
  if (!dialog) {
    overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.addEventListener('click', hideExportDialog);
    
    dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    dialog.innerHTML = `
      <h3>Export Logs</h3>
      <div class="export-options">
        <button class="btn btn-secondary" onclick="exportLogs('json')">Export as JSON</button>
        <button class="btn btn-secondary" onclick="exportLogs('csv')">Export as CSV</button>
      </div>
      <button class="btn btn-primary" onclick="hideExportDialog()">Cancel</button>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
  }
  
  overlay.classList.add('active');
  dialog.classList.add('active');
}

window.hideExportDialog = function() {
  document.querySelector('.dialog-overlay').classList.remove('active');
  document.querySelector('.export-dialog').classList.remove('active');
}

window.exportLogs = async function(format) {
  try {
    const levelFilter = document.getElementById('log-level-filter').value;
    const componentFilter = document.getElementById('log-component-filter').value;
    const searchFilter = document.getElementById('log-search').value;
    
    let content;
    let filename;
    let mimeType;
    
    if (format === 'json') {
      content = await extLog.exportLogs({
        level: levelFilter,
        component: componentFilter,
        search: searchFilter
      });
      filename = `snr-logs-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else {
      content = await extLog.exportLogsCSV({
        level: levelFilter,
        component: componentFilter,
        search: searchFilter
      });
      filename = `snr-logs-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    }
    
    // Create download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    hideExportDialog();
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export logs');
  }
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Start auto-refresh if enabled by default
if (document.getElementById('auto-refresh').checked) {
  autoRefreshInterval = setInterval(loadLogs, 5000);
}