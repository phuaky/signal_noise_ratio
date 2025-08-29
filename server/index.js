import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import OllamaClient from './ollama-client.js';
import logger from './logger.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Allow Chrome extensions
      if (origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }
      
      // Allow localhost variations
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      // Allow X.com and Twitter.com
      if (origin === 'https://x.com' || origin === 'https://twitter.com') {
        return callback(null, true);
      }
      
      // Log rejected origins for debugging
      logger.debug('Socket.IO CORS rejected origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const ollamaClient = new OllamaClient(process.env.OLLAMA_HOST);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost variations
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow X.com and Twitter.com
    if (origin === 'https://x.com' || origin === 'https://twitter.com') {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging
    logger.debug('CORS rejected origin:', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const ollamaHealthy = await ollamaClient.checkHealth();
  const models = await ollamaClient.listModels();
  
  res.json({
    status: 'ok',
    ollama: {
      connected: ollamaHealthy,
      models: models.map(m => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at
      }))
    }
  });
});

// Simplified content-only analysis endpoint
app.post('/analyze-multi-agent', async (req, res) => {
  const { tweetData, userPreferences = {} } = req.body;
  
  if (!tweetData || !tweetData.text) {
    return res.status(400).json({ error: 'Tweet data with text is required' });
  }

  // Just analyze the content, ignore author and media
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  try {
    const startTime = Date.now();
    const result = await ollamaClient.analyzeContent(tweetData.text, userPreferences);
    const latency = Date.now() - startTime;

    logger.logTweetAnalysis({
      requestId,
      tweet: tweetData.text,
      score: result.score,
      isSignal: result.isSignal,
      reason: result.reason,
      latency,
      model: 'Content Analysis'
    });

    res.json({
      ...result,
      latency,
      requestId
    });
  } catch (error) {
    logger.logError('Content analysis', error, requestId);
    res.status(500).json({
      error: 'Content analysis failed',
      score: 50,
      isSignal: false,
      confidence: 'error'
    });
  }
});

// Single tweet analysis endpoint (backward compatibility)
app.post('/analyze', async (req, res) => {
  const { text, interests = [], signalPatterns = [], noisePatterns = [], threshold = 30 } = req.body;
  
  // Allow empty strings (for media-only tweets) but not undefined/null
  if (text === undefined || text === null) {
    logger.logError('Missing tweet text in request', new Error(`Missing text field in request body: ${JSON.stringify(req.body)}`), 'analyze-400');
    return res.status(400).json({ error: 'Tweet text is required' });
  }
  
  // Skip tweets without text
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'No text content to analyze' });
  }
  const tweetText = text;

  // Build user preferences object
  const userPreferences = {
    interests,
    signalPatterns,
    noisePatterns,
    threshold
  };

  // Generate request ID for tracking
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  try {
    const startTime = Date.now();
    
    // Always use simple content analysis
    const result = await ollamaClient.analyzeContent(tweetText, userPreferences);
    
    const latency = Date.now() - startTime;

    // Response is already logged by ollama-client.js

    res.json({
      ...result,
      latency,
      model: ollamaClient.defaultModel
    });
  } catch (error) {
    logger.logError('Single tweet analysis', error, requestId);
    res.status(500).json({
      error: 'Analysis failed',
      score: 50,
      isSignal: false,
      confidence: 'error'
    });
  }
});

// Batch analysis endpoint
app.post('/analyze-batch', async (req, res) => {
  const { tweets, interests = [] } = req.body;
  
  if (!tweets || !Array.isArray(tweets)) {
    return res.status(400).json({ error: 'Tweets array is required' });
  }

  try {
    const startTime = Date.now();
    const results = await ollamaClient.analyzeTweetBatch(tweets, interests);
    const latency = Date.now() - startTime;

    res.json({
      results,
      latency,
      model: ollamaClient.defaultModel
    });
  } catch (error) {
    logger.logError('Batch analysis', error);
    res.status(500).json({
      error: 'Batch analysis failed',
      results: tweets.map(() => ({
        score: 50,
        isSignal: false,
        confidence: 'error'
      }))
    });
  }
});

// WebSocket connection for real-time analysis
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('analyze', async (data) => {
    const { text, interests = [], requestId } = data;
    
    try {
      const result = await ollamaClient.analyzeTweet(text, interests);
      socket.emit('analysis-result', {
        requestId,
        ...result
      });
    } catch (error) {
      socket.emit('analysis-error', {
        requestId,
        error: error.message
      });
    }
  });

  socket.on('analyze-batch', async (data) => {
    const { tweets, interests = [], requestId } = data;
    
    try {
      const results = await ollamaClient.analyzeTweetBatch(tweets, interests);
      socket.emit('batch-result', {
        requestId,
        results
      });
    } catch (error) {
      socket.emit('batch-error', {
        requestId,
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start server
httpServer.listen(PORT, async () => {
  logger.info(`Signal/Noise server running on port ${PORT}`);
  
  // Check Ollama connection
  const ollamaHealthy = await ollamaClient.checkHealth();
  if (ollamaHealthy) {
    const models = await ollamaClient.listModels();
    logger.logConnection('connected', `${models.length} models available`);
    logger.info(`Available models: ${models.map(m => m.name).join(', ')}`);
  } else {
    logger.logConnection('disconnected', 'Cannot connect to Ollama');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Server closed');
  });
});