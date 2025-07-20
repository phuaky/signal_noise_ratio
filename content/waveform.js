/**
 * ECG/Heartbeat style waveform visualization for Signal/Noise Ratio
 * Creates medical monitor-style visualization with baseline hovering and signal spikes
 */
class Waveform {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Configuration
    this.options = {
      lineWidth: options.lineWidth || 2,
      lineColor: options.lineColor || '#10b981', // Primary line color
      glowColor: options.glowColor || '#34d399', // Glow color for spikes
      backgroundColor: options.backgroundColor || 'transparent',
      samples: options.samples || 150, // More samples for smoother ECG
      speed: options.speed || 0.03,
      smoothing: options.smoothing || 0.3,
      baselineMin: options.baselineMin || 10,  // Baseline hover range minimum
      baselineMax: options.baselineMax || 20,  // Baseline hover range maximum
      spikeHeight: options.spikeHeight || 80,  // Maximum spike height
      spikeWidth: options.spikeWidth || 8,     // Width of spike in samples
      ...options
    };
    
    // Animation state
    this.offset = 0;
    this.animationId = null;
    this.currentRatio = 50; // Default 50% signal
    this.targetRatio = 50;
    this.isRunning = false;
    
    // ECG state
    this.spikePositions = [];
    this.nextSpikeIn = 0;
    this.baselineNoise = 0;
    this.waveformData = new Array(this.options.samples).fill(this.options.baselineMin);
  }
  
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }
  
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  updateRatio(ratio) {
    this.targetRatio = Math.max(0, Math.min(100, ratio));
  }
  
  animate() {
    if (!this.isRunning) return;
    
    // Smooth transition to target ratio
    this.currentRatio += (this.targetRatio - this.currentRatio) * this.options.smoothing;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Update waveform data
    this.updateWaveformData();
    
    // Draw waveform
    this.drawWaveform();
    
    // Update offset for animation
    this.offset += this.options.speed;
    
    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  updateWaveformData() {
    const signalStrength = this.currentRatio / 100;
    const { baselineMin, baselineMax, spikeHeight, spikeWidth } = this.options;
    
    // Shift waveform data left (create scrolling effect)
    this.waveformData.shift();
    
    // Calculate spike probability based on signal strength
    const spikeProbability = signalStrength * 0.02; // Adjust for spike frequency
    
    // Determine if we should create a spike
    if (this.nextSpikeIn <= 0 && Math.random() < spikeProbability && signalStrength > 0.3) {
      // Start a spike
      this.nextSpikeIn = Math.floor(20 / signalStrength); // Space between spikes
      this.spikePositions.push({
        position: this.waveformData.length - 1,
        phase: 0,
        height: spikeHeight * (0.7 + Math.random() * 0.3) * signalStrength
      });
    } else {
      this.nextSpikeIn--;
    }
    
    // Update spike positions and remove old ones
    this.spikePositions = this.spikePositions.filter(spike => {
      spike.position--;
      spike.phase++;
      return spike.position > -spikeWidth;
    });
    
    // Generate new data point
    let newValue;
    
    // Check if we're in a spike
    const activeSpike = this.spikePositions.find(spike => 
      spike.position >= this.waveformData.length - spikeWidth &&
      spike.position <= this.waveformData.length
    );
    
    if (activeSpike) {
      // Create spike shape (sharp rise and fall)
      const spikeProgress = (spikeWidth - (this.waveformData.length - activeSpike.position)) / spikeWidth;
      
      if (spikeProgress < 0.3) {
        // Sharp rise
        newValue = baselineMin + (activeSpike.height - baselineMin) * (spikeProgress / 0.3);
      } else if (spikeProgress < 0.5) {
        // Peak
        newValue = activeSpike.height;
      } else {
        // Sharp fall
        newValue = activeSpike.height - (activeSpike.height - baselineMin) * ((spikeProgress - 0.5) / 0.5);
      }
    } else {
      // Baseline hovering with noise
      const noiseRange = baselineMax - baselineMin;
      this.baselineNoise += (Math.random() - 0.5) * 0.5;
      this.baselineNoise = Math.max(-1, Math.min(1, this.baselineNoise));
      
      // Mix baseline hover with signal influence
      const baseline = (baselineMin + baselineMax) / 2;
      const noiseAmount = (1 - signalStrength) * noiseRange * 0.5;
      newValue = baseline + this.baselineNoise * noiseAmount;
      
      // Add subtle signal influence even at baseline
      newValue += Math.sin(this.offset * 2) * 2 * signalStrength;
    }
    
    // Add new value to waveform data
    this.waveformData.push(newValue);
  }
  
  drawWaveform() {
    const { samples, lineWidth, lineColor, glowColor, spikeHeight } = this.options;
    const step = this.width / samples;
    const signalStrength = this.currentRatio / 100;
    
    // Convert waveform data values to canvas coordinates
    // Canvas Y coordinates: 0 = top, height = bottom
    // Waveform values: 0-100 where higher = better signal
    const dataToY = (value) => {
      return this.height - (value / 100) * this.height;
    };
    
    // Draw glow effect for spikes
    if (signalStrength > 0.3) {
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = 10 * signalStrength;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }
    
    // Main ECG line
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.globalAlpha = 0.8 + signalStrength * 0.2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    
    // Draw the waveform
    for (let i = 0; i < this.waveformData.length; i++) {
      const x = i * step;
      const y = dataToY(this.waveformData[i]);
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        // Use quadratic curves for smoother lines
        const prevX = (i - 1) * step;
        const prevY = dataToY(this.waveformData[i - 1]);
        const cpX = (prevX + x) / 2;
        const cpY = (prevY + y) / 2;
        
        this.ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
      }
    }
    
    // Complete the path to the last point
    if (this.waveformData.length > 0) {
      const lastX = (this.waveformData.length - 1) * step;
      const lastY = dataToY(this.waveformData[this.waveformData.length - 1]);
      this.ctx.lineTo(lastX, lastY);
    }
    
    this.ctx.stroke();
    
    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    
    // Draw subtle grid lines (optional ECG paper effect)
    if (this.options.showGrid) {
      this.ctx.strokeStyle = 'rgba(156, 163, 175, 0.1)';
      this.ctx.lineWidth = 0.5;
      
      // Horizontal lines
      for (let y = 0; y <= 100; y += 20) {
        const yPos = dataToY(y);
        this.ctx.beginPath();
        this.ctx.moveTo(0, yPos);
        this.ctx.lineTo(this.width, yPos);
        this.ctx.stroke();
      }
    }
    
    // Reset alpha
    this.ctx.globalAlpha = 1;
  }
  
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }
  
  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
  
  destroy() {
    this.stop();
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.Waveform = Waveform;
}