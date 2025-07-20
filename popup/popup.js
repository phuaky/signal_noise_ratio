// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize waveform
  const waveformCanvas = document.getElementById('popup-waveform');
  if (waveformCanvas && window.Waveform) {
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    window.popupWaveform = new Waveform(waveformCanvas, {
      lineColor: isDarkMode ? '#34d399' : '#10b981',    // Green ECG line
      glowColor: isDarkMode ? '#6ee7b7' : '#34d399',    // Glow effect for spikes
      lineWidth: 2,
      samples: 150,     // More samples for smoother ECG
      speed: 0.02,      // Animation speed
      baselineMin: 10,  // Baseline hover range
      baselineMax: 20,
      spikeHeight: 80,  // Maximum spike height
      spikeWidth: 8,    // Width of spikes
      showGrid: true    // Show ECG grid
    });
    window.popupWaveform.start();
  }
  
  // View toggle functionality
  const viewButtons = document.querySelectorAll('.view-btn');
  const chartCanvas = document.getElementById('ratio-chart');
  
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (btn.dataset.view === 'chart') {
        chartCanvas.style.display = 'block';
        waveformCanvas.style.display = 'none';
      } else {
        chartCanvas.style.display = 'none';
        waveformCanvas.style.display = 'block';
      }
    });
  });
  // Load saved settings and chart data
  const settings = await chrome.storage.local.get([
    'autoHide',
    'showIndicators',
    'threshold',
    'stats',
    'chartHistory'
  ]);

  // Initialize chart data from storage or create new
  window.chartData = settings.chartHistory || [];

  // Update UI with saved settings
  document.getElementById('auto-hide').checked = settings.autoHide || false;
  document.getElementById('show-indicators').checked = settings.showIndicators !== false;
  document.getElementById('threshold').value = settings.threshold || 30;
  document.getElementById('threshold-value').textContent = `${settings.threshold || 30}%`;

  // Update stats
  updateStats(settings.stats || {});

  // Draw initial chart
  drawChart();

  // Add event listeners
  document.getElementById('auto-hide').addEventListener('change', saveSettings);
  document.getElementById('show-indicators').addEventListener('change', saveSettings);
  document.getElementById('threshold').addEventListener('input', handleThresholdChange);
  document.getElementById('refresh-btn').addEventListener('click', refreshAnalysis);
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // Function to fetch stats
  function fetchStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('twitter.com') || tabs[0]?.url?.includes('x.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
          if (response) {
            updateStats(response);
            chrome.storage.local.set({ stats: response });
          }
        });
      }
    });
  }

  // Request initial stats
  fetchStats();

  // Set up real-time updates - poll every 3 seconds
  const updateInterval = setInterval(fetchStats, 3000);

  // Clean up interval when popup closes
  window.addEventListener('unload', () => {
    clearInterval(updateInterval);
  });
});

async function updateStats(stats) {
  const signalCount = stats.signalCount || 0;
  const noiseCount = stats.noiseCount || 0;
  const total = signalCount + noiseCount;
  const ratio = total > 0 ? (signalCount / total * 100).toFixed(0) : 0;

  document.getElementById('signal-count').textContent = signalCount;
  document.getElementById('noise-count').textContent = noiseCount;
  document.getElementById('ratio-percent').textContent = `${ratio}%`;
  document.getElementById('total-tweets').textContent = total;

  // Update waveform
  if (window.popupWaveform) {
    window.popupWaveform.updateRatio(parseFloat(ratio));
  }
  
  // Update chart data only if we have new data
  if (total > 0) {
    if (!window.chartData) {
      window.chartData = [];
    }
    
    // Add new data point with timestamp
    const newPoint = { time: Date.now(), ratio: parseFloat(ratio), total };
    
    // Check if this is actually new data (different total or ratio)
    const lastPoint = window.chartData[window.chartData.length - 1];
    if (!lastPoint || lastPoint.total !== total || lastPoint.ratio !== parseFloat(ratio)) {
      window.chartData.push(newPoint);
      
      // Keep only last 20 points
      if (window.chartData.length > 20) {
        window.chartData.shift();
      }
      
      // Persist to storage
      await chrome.storage.local.set({ chartHistory: window.chartData });
      
      drawChart();
    }
  }
}

function drawChart() {
  const canvas = document.getElementById('ratio-chart');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Initialize chart data if not exists
  if (!window.chartData || window.chartData.length === 0) {
    // Draw empty state message
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet. Visit X.com to start tracking!', width / 2, height / 2);
    return;
  }

  if (window.chartData.length < 2) {
    // Draw waiting for more data message
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data...', width / 2, height / 2);
    return;
  }

  // Draw grid lines
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw chart line
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();

  window.chartData.forEach((point, index) => {
    const x = (width / (window.chartData.length - 1)) * index;
    const y = height - (point.ratio / 100 * height);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw fill
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

function saveSettings() {
  const settings = {
    autoHide: document.getElementById('auto-hide').checked,
    showIndicators: document.getElementById('show-indicators').checked,
    threshold: parseInt(document.getElementById('threshold').value)
  };

  chrome.storage.local.set(settings);

  // Send settings to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url?.includes('twitter.com') || tabs[0]?.url?.includes('x.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'updateSettings', settings });
    }
  });
}

function handleThresholdChange(e) {
  const value = e.target.value;
  document.getElementById('threshold-value').textContent = `${value}%`;
  saveSettings();
}

function refreshAnalysis() {
  // Send refresh command to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url?.includes('twitter.com') || tabs[0]?.url?.includes('x.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'refresh' }, (response) => {
        if (response) {
          updateStats(response);
        }
      });
    }
  });

  // Visual feedback
  const btn = document.getElementById('refresh-btn');
  btn.textContent = 'Refreshing...';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'Refresh Analysis';
    btn.disabled = false;
  }, 1000);
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}