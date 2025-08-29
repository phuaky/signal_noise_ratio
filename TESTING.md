# Manual Testing Guide - Signal/Noise Ratio Extension

## 🧪 Extension Testing Checklist

### Phase 1: Extension Loading Test

1. **Load Extension in Chrome**
   ```
   1. Open Chrome browser
   2. Go to chrome://extensions/
   3. Enable "Developer mode" (toggle in top right)
   4. Click "Load unpacked"
   5. Select the `dist/` folder from this project
   6. Verify extension appears in extensions list
   ```

2. **Initial Load Verification**
   - ✅ Extension icon appears in Chrome toolbar
   - ✅ No errors in Chrome DevTools Console
   - ✅ Extension badge shows connection status (OFF/ON)

### Phase 2: Settings and UI Test

3. **Extension Popup Test**
   ```
   1. Click extension icon in toolbar
   2. Popup should open with current status
   3. Verify connection status display
   4. Check for any UI errors
   ```

4. **Options Page Test**
   ```
   1. Right-click extension icon → Options
   2. OR go to chrome://extensions/ → Extension details → Extension options
   3. Verify all settings tabs load correctly
   4. Test toggling various settings
   5. Verify "Cloud AI (Coming Soon)" is disabled
   ```

### Phase 3: X.com Integration Test

5. **Navigate to X.com**
   ```
   1. Go to https://x.com or https://twitter.com
   2. Log in to your account
   3. Check Chrome DevTools Console for extension logs
   4. Verify no JavaScript errors on page load
   ```

6. **Content Script Injection Test**
   ```
   In DevTools Console on X.com, run:
   
   console.log('Extension components loaded:');
   console.log('- TweetAnalyzer:', typeof window.TweetAnalyzer);
   console.log('- LLMService:', typeof window.LLMService);
   console.log('- AnalysisQueue:', typeof window.AnalysisQueue);
   
   Expected: All should log as "function" if loaded correctly
   ```

### Phase 4: Server Connection Test

7. **Local Server Status**
   ```
   Verify local server is running:
   curl http://localhost:3001/health
   
   Expected: JSON response with status "ok"
   ```

8. **Connection Status in Extension**
   - Extension badge should show "ON" when server is running
   - Extension badge should show "OFF" when server is stopped
   - Test by stopping/starting server and checking badge

### Phase 5: UI Component Test

9. **Dashboard Display Test**
   ```
   On X.com:
   1. Look for floating dashboard (bottom-right corner)
   2. Should display signal/noise statistics
   3. Should show connection status indicator
   4. Test minimize/maximize functionality
   ```

10. **Tweet Analysis UI Test (Limited)**
    ```
    Even without working model inference:
    1. Extension should detect tweets on page
    2. No errors should appear in console
    3. UI components should be properly styled
    4. No visual glitches or layout issues
    ```

## 🔧 Troubleshooting Common Issues

### Extension Won't Load
- Check manifest.json syntax is valid
- Verify all referenced files exist in dist/
- Check Chrome extensions developer console for errors

### Content Scripts Not Working
- Verify extension has permissions for twitter.com and x.com
- Check if Content Security Policy is blocking scripts
- Look for errors in page DevTools console

### Server Connection Issues
- Ensure server is running: `cd server && npm start`
- Check firewall blocking localhost:3001
- Verify no other processes using port 3001

### Ollama Model Issues (Known)
- Models currently failing with "exit status 2"
- This is a known issue and doesn't affect UI testing
- Extension should gracefully handle model failures

## 📊 Test Results Documentation

### Expected Behavior (Working Components)
- ✅ Extension loads without errors
- ✅ Settings page functions correctly
- ✅ Content scripts inject on X.com
- ✅ Server connection status works
- ✅ UI components render properly
- ✅ No memory leaks or performance issues

### Known Issues (Documented)
- ❌ Ollama model inference failing
- ❌ Tweet analysis returns generic responses
- ⚠️ Extension will show "Content analysis failed" for tweet analysis

### Success Criteria
For this testing phase, success means:
1. Extension loads and runs without JavaScript errors
2. All UI components render correctly
3. Settings are persistent and functional
4. Server connection detection works
5. No performance impact on X.com browsing

## 🚀 Next Steps After Testing

Once basic functionality is confirmed:
1. Fix Ollama model issues (separate investigation)
2. Test actual tweet analysis when models work
3. Proceed with cloud API integration
4. Implement payment system

## 📝 Test Log Template

```
Date: ____
Tester: ____
Chrome Version: ____

Extension Loading: ✅/❌
Settings Page: ✅/❌
X.com Integration: ✅/❌
Server Connection: ✅/❌
UI Components: ✅/❌

Issues Found:
- 
- 

Notes:
- 
```

This testing guide ensures we validate all extension functionality independent of the Ollama model issues, allowing us to proceed with confidence to the next development phases.