# Meeting Support MVP Design

Date: 2026-07-16
Status: Approved design, pending written-spec review

## 1. Product goal

Meeting Support is a Chrome Manifest V3 side-panel extension. User explicitly starts capture of a meeting tab, sees near-real-time transcript, and requests a streamed AI answer based on recent conversation context.

Priorities:

1. Low perceived latency.
2. Contextually relevant AI answers.
3. Clear, discreet meeting-time UI.
4. Explicit capture consent and state.

## 2. MVP scope

### Included

- Installable unpacked Manifest V3 extension.
- Chrome Side Panel UI built with React and TypeScript.
- Meeting-tab selection.
- Explicit start, pause, resume, stop, clear, and new-session actions.
- Tab audio capture lifecycle through `chrome.tabCapture` where Chrome permits it.
- Pluggable `SpeechToTextProvider` boundary.
- Browser speech-recognition fallback for usable local MVP behavior.
- Partial and final transcript reconciliation.
- Language selection.
- Rolling recent-context selection and latest-question extraction.
- OpenRouter model and API-key settings.
- User profile and system-prompt settings.
- Streaming OpenRouter answer with cancellation and copy action.
- Visible empty, connecting, listening, paused, disconnected, generating, and error states.
- Focused unit tests for transcript processing, context selection, and SSE parsing.

### Excluded

- Account system or backend proxy.
- Cross-device sync, quotas, teams, analytics, and billing.
- Meeting history and cloud transcript persistence.
- Speaker diarization guarantees.
- Automatic AI requests unless user explicitly enables a later feature.
- Rolling summaries, action items, decisions, exports, keyboard shortcuts, and floating panel.

## 3. Assumptions

- Target is current Chrome desktop with Manifest V3 and Side Panel support.
- Repository starts empty except `prompt.txt`.
- User supplies OpenRouter key, model, and any production STT credentials.
- Direct OpenRouter requests are acceptable for personal MVP use.
- Transcript is session memory by default; settings persist in `chrome.storage.local`.
- Browser speech recognition is fallback capability, not a production-quality streaming-STT guarantee.

## 4. Technical risks and constraints

### Chrome capture

`chrome.tabCapture` requires explicit user activation and a valid tab. Capture may fail because of Chrome policy, unsupported pages, tab changes, or lost streams. UI must only display listening after capture succeeds and must release every media track on stop.

Manifest V3 service workers are ephemeral. Long-running media work cannot depend on service-worker lifetime. Capture and media processing live in a page context such as the side panel or an offscreen document when required.

### Speech-to-text

OpenRouter is not treated as streaming STT. STT stays behind a provider interface. Browser speech recognition may not accept captured tab PCM directly and may depend on browser/network behavior. A production provider should receive encoded or PCM chunks through its documented WebSocket or HTTP protocol.

### API keys

Keys stored in `chrome.storage.local` remain accessible to the extension runtime and local Chrome profile. They must never be logged, embedded in builds, included in errors, or sent to unrelated services. Production multi-user deployment requires a backend proxy.

### Latency

Sub-five-second response cannot be guaranteed before measurement. Perceived latency is reduced by limiting context, selecting a fast model, starting answer rendering on first SSE token, avoiding pre-answer summarization, and supporting request cancellation.

## 5. Chosen approach

### Approach A: side-panel capture and browser STT fallback

Pros: smallest MVP, fewer extension contexts, easy debugging.  
Cons: browser STT cannot reliably consume captured tab audio on every platform.

### Approach B: offscreen audio pipeline and production WebSocket STT

Pros: correct tab-audio architecture, stable processing outside service worker, replaceable production STT.  
Cons: requires provider credentials and provider-specific encoding/protocol work.

### Approach C: remote backend for capture/STT/AI proxy

Pros: protects credentials and centralizes usage controls.  
Cons: adds backend, auth, deployment, latency, and operating cost beyond MVP.

### Decision

Build provider-neutral architecture supporting B, keep direct OpenRouter integration for MVP, and include browser recognition only as a declared fallback. No mock provider participates in production flow. If no compatible STT provider is configured and browser recognition cannot transcribe captured tab audio, UI reports limitation instead of fabricating transcript.

## 6. System architecture

### Background service worker

- Registers side-panel behavior.
- Handles extension lifecycle and command routing.
- Creates or closes offscreen document when audio pipeline requires it.
- Does not own long-running transcript state.

### Side panel

- Owns user interaction and visible session state.
- Sends capture and STT commands.
- Renders bounded transcript list and streamed answer.
- Persists settings through storage service.

### Audio layer

- Selects eligible tab.
- Acquires capture stream only after explicit action.
- Converts stream into provider-compatible chunks when provider needs audio.
- Implements pause, resume, stop, track cleanup, and disconnection detection.

### STT layer

```ts
interface SpeechToTextProvider {
  connect(config: STTConfig): Promise<void>;
  sendAudio(chunk: ArrayBuffer): void;
  disconnect(): Promise<void>;
  onPartialTranscript(callback: TranscriptCallback): void;
  onFinalTranscript(callback: TranscriptCallback): void;
  onError(callback: ErrorCallback): void;
}
```

Provider construction happens outside UI components. UI consumes transcript events and session status only.

### Transcript layer

- Maintains final segments plus at most one active partial segment per stream.
- Replaces partial content when final event arrives.
- Assigns stable IDs and timestamps.
- Limits rendered and AI-context windows without deleting current visible session data.
- Detects latest likely question using punctuation and lightweight language heuristics.

### AI layer

- Builds request from system prompt, user profile, latest question, and bounded recent transcript.
- Calls configured OpenRouter model.
- Parses SSE incrementally.
- Exposes first-token, chunk, completion, cancellation, and sanitized error events.
- Never logs headers, key, full transcript, or answer payload.

### Storage layer

- Validates persisted settings with Zod.
- Applies safe defaults for missing or invalid fields.
- Keeps API keys out of source and build-time environment files.

## 7. Data flow

1. User opens side panel and chooses meeting tab.
2. User presses Start.
3. UI enters connecting state.
4. Audio layer requests tab capture.
5. Successful capture starts selected STT provider.
6. Provider emits partial/final transcript events.
7. Transcript reducer reconciles events and updates visible timeline.
8. User presses Generate answer.
9. Context selector picks latest question and bounded recent final segments.
10. AI client sends OpenRouter request and parses SSE tokens.
11. Answer panel renders tokens immediately.
12. Stop-generation aborts request; stop-session disconnects STT and media tracks.

## 8. State model

Session states:

- `idle`
- `connecting`
- `listening`
- `paused`
- `disconnected`
- `stopping`
- `error`

Answer states:

- `idle`
- `generating`
- `complete`
- `cancelled`
- `error`

Invalid transitions are rejected. Stop is safe from every active session state. New session resets transient transcript and answer state but keeps settings.

## 9. Information architecture

### Main panel

1. Compact product header and recording status.
2. Tab selector and session controls.
3. Transcript timeline.
4. Latest-question strip.
5. AI answer workspace.
6. Settings access.

### Settings view

1. Speech language.
2. STT provider and provider configuration.
3. OpenRouter API key and validation action.
4. OpenRouter model.
5. User profile.
6. System prompt.
7. Privacy explanation and data-flow warning.

## 10. Component hierarchy

```text
App
├─ AppHeader
├─ SessionToolbar
│  ├─ TabSelector
│  ├─ StatusBadge
│  └─ SessionControls
├─ TranscriptPanel
│  ├─ TranscriptList
│  ├─ TranscriptSegment
│  └─ PartialTranscript
├─ QuestionBar
├─ AnswerPanel
│  ├─ AnswerStatus
│  ├─ StreamingAnswer
│  └─ AnswerActions
├─ SettingsPanel
└─ ErrorNotice
```

Components receive narrow props. Audio, STT, storage, and OpenRouter logic remain outside React presentation components.

## 11. Storage design

Persist in `chrome.storage.local`:

```ts
interface StoredSettings {
  language: string;
  sttProvider: string;
  sttConfig: Record<string, string>;
  openRouterApiKey: string;
  openRouterModel: string;
  userProfile: string;
  systemPrompt: string;
}
```

Do not persist by default:

- Captured audio.
- Transcript.
- AI answers.
- Provider runtime tokens.
- Session errors containing request details.

## 12. Permission strategy

Requested permissions:

- `sidePanel`
- `storage`
- `tabCapture`
- `activeTab`
- `offscreen` only when offscreen processing is used

Host permissions stay limited to configured STT endpoint and OpenRouter endpoint. No blanket `<all_urls>` permission.

## 13. Error handling

Every recoverable error includes cause category and next action:

- Capture denied: ask user to select a valid meeting tab and retry.
- Stream ended: mark disconnected and offer reconnect.
- STT unsupported: explain fallback limitation and open provider settings.
- STT authentication: request credential correction without echoing key.
- OpenRouter authentication: show sanitized invalid-key message.
- Rate limit: preserve transcript and allow retry.
- Network loss: stop active streaming safely and retain current answer text.
- Invalid persisted settings: reset only invalid fields.

Errors never contain API keys, authorization headers, raw audio, or full transcript payloads.

## 14. UI direction

Design dials:

- Variance: 4
- Motion: 3
- Density: 6

Visual language:

- Serious desktop utility, not marketing UI.
- Warm off-white surface, deep ink text, cobalt action color, red reserved for capture/errors.
- Native CSS tokens and restrained shadows.
- Compact controls with clear hierarchy and stable layout during streaming.
- No decorative gradients, heavy glass effects, oversized headings, or continuous animation.

Core tokens:

```css
--color-bg: #f4f3ef;
--color-surface: #ffffff;
--color-text: #15202b;
--color-muted: #66727f;
--color-border: #d8dde3;
--color-primary: #2457d6;
--color-danger: #c83d3d;
--color-success: #17845b;
--radius-panel: 12px;
--radius-control: 8px;
--space-unit: 4px;
```

Accessibility:

- Visible focus rings.
- Proper labels and button names.
- `aria-live` for status and answer changes without announcing every transcript token.
- Keyboard-operable controls.
- Minimum readable contrast.
- Reduced-motion behavior.

## 15. Performance strategy

- Keep transcript reducer updates incremental.
- Use stable segment IDs.
- Render a bounded live window or virtualize only after measured need.
- Batch high-frequency partial updates to animation frames where needed.
- Send only recent final segments and latest relevant question to AI.
- Render OpenRouter chunks incrementally without reparsing full answer.
- Abort stale requests when a new request starts.

## 16. Security and privacy

- Capture starts only from explicit user action.
- Persistent visual indicator remains visible while listening or paused.
- Audio is not saved.
- Transcript is not uploaded except selected bounded context sent by explicit AI action.
- Settings explain direct-client API-key risk.
- Logs contain lifecycle metadata only, never secrets or conversation content.
- Content Security Policy permits only required extension scripts and network endpoints.

## 17. Verification strategy

Per vertical slice:

1. TypeScript check.
2. Unit tests for changed logic.
3. Production build.
4. Manifest validation through unpacked Chrome load.
5. Manual runtime check for permissions, capture lifecycle, side panel, and streaming cancellation.

Automated tests cover:

- Partial-to-final replacement.
- Multiple final segments.
- Latest-question selection.
- Context truncation.
- SSE frames split across arbitrary chunks.
- Cancellation behavior.
- Invalid stored settings.

## 18. Implementation slices

1. Project and Manifest V3 shell.
2. Side-panel application shell and tokens.
3. Tab selection and capture lifecycle.
4. STT provider contract and usable fallback/provider configuration.
5. Transcript reducer and timeline UI.
6. Settings validation and storage.
7. OpenRouter SSE client and key validation.
8. Answer generation, cancellation, and copy action.
9. Context selection and latest-question logic.
10. Error, disconnection, privacy, and accessibility states.
11. Unit tests, build checks, and unpacked-extension verification.
12. UI polish based on real runtime behavior.

## 19. Acceptance criteria

- Extension builds and loads unpacked without Manifest V3 errors.
- Capture never starts without explicit user action.
- Start, pause, resume, stop, clear, and new-session controls behave consistently.
- Partial transcript displays live and final transcript replaces it correctly.
- Language, provider, OpenRouter key, model, profile, and system prompt are configurable.
- Generate answer streams visible text and can be cancelled.
- AI requests use bounded context rather than full transcript.
- No secret or transcript logging occurs.
- Errors expose recovery actions.
- Core production flow contains no mock transcript data.
- UI remains responsive during a long transcript session.
- Latency claims are reported only after measurement.

## 20. Remaining MVP decisions

No decision blocks scaffolding. Production STT integration remains provider-dependent. Initial implementation must make this limitation explicit and leave one documented adapter location for a selected provider.
