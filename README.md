# Meeting Support

Chrome Manifest V3 side-panel extension for explicit meeting-tab capture, near-real-time transcript, and user-triggered OpenRouter answer streaming.

## Requirements

- Chrome 116+
- Node.js 20+
- npm

## Development

```powershell
npm install
npm run typecheck
npm test -- --run
npm run build
```

Load `dist` through `chrome://extensions`:

1. Enable Developer mode.
2. Select **Load unpacked**.
3. Choose this project's `dist` directory.
4. Open a meeting tab, click extension action, then press **Bắt đầu hỗ trợ**.

## Speech-to-text

`web-speech` is an experimental fallback. Browser speech recognition may use microphone input and may not reliably transcribe tab-captured audio.

For production streaming STT, select `streaming-websocket` and configure an endpoint accepting:

- WebSocket subprotocols `token` and supplied API key.
- Binary audio chunks from `MediaRecorder` every 500 ms.
- JSON events shaped as `{ "type": "partial|final", "text": "...", "id": "...", "timestamp": 0 }`.

Provider-specific services usually need a small adapter in `src/stt/streaming-websocket-provider.ts` for authentication, audio encoding, and event shape.

## OpenRouter

Open Settings and provide:

- OpenRouter API key.
- Editable model identifier.
- Optional user profile.
- System prompt.

Answer generation sends only recent bounded transcript context and latest detected question. Requests stream directly from OpenRouter and can be cancelled.

## Privacy and security

- Capture begins only after explicit Start action.
- Audio is not persisted.
- Transcript and answers remain in session memory.
- Settings use `chrome.storage.local`.
- Direct-client API keys are acceptable only for personal MVP use. Multi-user production requires a backend proxy.
- Secrets and conversation content are not intentionally logged.

## Current limits

- Chrome tab capture availability depends on active-tab state and Chrome policy.
- Web Speech is not production tab-audio STT.
- Generic WebSocket adapter requires provider-specific protocol mapping.
- Speaker diarization is unavailable.
- No measured sub-five-second latency claim is made.

## Phase 2

Rolling summaries, action items, decisions, meeting history, transcript export, prompt templates, keyboard shortcuts, floating mini panel, advanced question detection, and provider-supported diarization.

## OpenRouter STT setup

1. Open Settings.
2. Enter OpenRouter API key.
3. Click `Check API key & tải model STT`.
4. Choose an audio-capable model from the loaded list.
5. Save settings.

OpenRouter transcription runs in sequential audio chunks. It is near-real-time, not token-level streaming STT.
