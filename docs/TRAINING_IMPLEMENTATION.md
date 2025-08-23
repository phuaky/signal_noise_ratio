# Training & Categorization Implementation

## Overview
We've implemented a comprehensive training and categorization system for the Signal/Noise Ratio Chrome extension that allows users to train the AI by categorizing tweets, enabling personalized signal detection across different content categories.

## Key Features Implemented

### 1. Training Data Storage (background/training-manager.js)
- Persistent storage of training examples with categories
- Feature extraction from tweets (text, media, engagement, etc.)
- Similarity calculation between tweets
- Category prediction based on training data
- Import/export functionality for training data

### 2. Training Mode UI (content/training-ui.js)
- Toggle button to enable/disable training mode
- Category selector popup for quick categorization
- Visual indicators on tweets when in training mode
- Real-time category creation
- Feedback messages for successful categorization

### 3. Parallel AI Model Processing (background/background.js)
- Support for running multiple AI models simultaneously
- Model result aggregation with consensus calculation
- Caching system to reduce API calls
- Fallback mechanisms for failed models

### 4. Category-Based Analysis (content/analyzer.js)
- Dynamic weight adjustment based on category
- Integration with training data for improved accuracy
- Support for category-specific scoring

### 5. Training Data Management UI (options page)
- Display of training statistics and categories
- Export/import training data functionality
- Clear training data option
- Enable/disable training mode
- Parallel model configuration

## How It Works

### Training Flow
1. User enables training mode via the toggle button
2. When hovering over tweets, a "+" button appears
3. Clicking the button shows a category selector
4. User selects existing category or creates new one
5. Tweet features are extracted and stored with the category
6. System learns patterns for each category

### Analysis Flow
1. When analyzing a tweet, the system:
   - Predicts the category based on similarity to training examples
   - Loads category-specific weights if available
   - Runs analysis with adjusted parameters
   - Shows category in the tweet indicator

### Parallel Model Processing
1. If enabled, multiple models analyze each tweet:
   - Anthropic Claude API
   - OpenAI GPT API
   - Local LLM (Ollama)
2. Results are aggregated with consensus scoring
3. Cache prevents duplicate API calls

## Testing Instructions

### Basic Training Mode Test
1. Load extension on Twitter/X
2. Click the "Train AI" toggle button
3. Hover over tweets to see the training button
4. Click to categorize tweets into different categories
5. Verify categories appear in the badge

### Category Prediction Test
1. After training with 5+ examples per category
2. Refresh the page
3. New tweets should show predicted categories
4. Verify predictions match expected categories

### Import/Export Test
1. Go to extension options page
2. Export training data
3. Clear training data
4. Import the exported file
5. Verify categories are restored

### Parallel Models Test
1. Enable parallel models in options
2. Configure API keys for multiple providers
3. Analyze tweets and check console for multi-model results
4. Verify aggregated scores in indicators

## Configuration

### Settings Available
- `enableTraining`: Enable/disable training mode
- `enableParallelModels`: Run multiple AI models
- `enabledModels`: Which models to use in parallel
- `useCategoryWeights`: Apply category-specific scoring

### Storage Structure
```javascript
{
  trainingData: {
    version: 1,
    examples: {
      "id": {
        text: "tweet text",
        category: "tech",
        features: {...},
        metadata: {...}
      }
    },
    categories: ["tech", "news", "memes"],
    categoryStats: {
      "tech": { count: 42, lastUpdated: timestamp }
    }
  }
}
```

## Future Enhancements
- Machine learning model training from examples
- Automatic category detection
- Collaborative training data sharing
- Advanced feature engineering
- Real-time model fine-tuning