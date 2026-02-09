# Support Helper Examples

This directory contains example implementations and test files for the Support Helper SDK.

## 📁 Files

### [test-sdk.html](./test-sdk.html)
Complete integration test for the SDK featuring:
- Screen recording with MediaRecorder API
- Video preview and playback
- Bug report submission with AI analysis
- Web Component widget test
- API connection verification

**Usage:**
1. Build the SDK: `pnpm --filter @support-helper/sdk-web build:all`
2. Start the API: `pnpm --filter @support-helper/api dev`
3. Open `test-sdk.html` in a browser
4. Click "Start Recording" to test the SDK

### [codec-test.html](./codec-test.html)
Browser codec compatibility tester that checks which video codecs are supported by the browser's MediaRecorder API.

### [test-api.js](./test-api.js)
Node.js script for testing API endpoints directly without the SDK.

**Usage:**
```bash
node examples/test-api.js
```

### [get-sdk-key.js](./get-sdk-key.js)
Utility script to retrieve your SDK key from the API for testing purposes.

**Usage:**
```bash
node examples/get-sdk-key.js
```

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start infrastructure:**
   ```bash
   pnpm docker:up
   ```

3. **Run database migrations:**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

4. **Build the SDK:**
   ```bash
   pnpm --filter @support-helper/sdk-web build:all
   ```

5. **Start the API:**
   ```bash
   pnpm --filter @support-helper/api dev
   ```

6. **Open test file:**
   Open `test-sdk.html` in your browser or run the Node.js scripts.

## 🔧 Configuration

The examples use default configuration:
- **API URL:** `http://localhost:3001`
- **SDK Key:** `sdk_test_default_key_12345` (from seed data)

You can modify these values in the test files or use the configuration panels in the HTML examples.

## 📝 Notes

- Make sure Docker services are running before testing
- The API must be running on port 3001
- Video recording requires HTTPS in production (localhost works with HTTP)
- Check browser console for detailed logs
