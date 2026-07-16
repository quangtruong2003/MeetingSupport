# Meeting Support MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable Chrome Manifest V3 React/TypeScript side-panel extension with explicit meeting-tab capture, replaceable STT, bounded transcript context, and cancellable OpenRouter streaming answers.

**Architecture:** Vite produces one side-panel page and one service-worker entry. Side panel owns presentation and session orchestration; audio, STT, transcript, storage, and AI remain focused modules. Long-lived media processing stays in a page/offscreen context, never depends on service-worker lifetime.

**Tech Stack:** Chrome Manifest V3, React, TypeScript, Vite, native CSS, Zod, Vitest. No state library until measured need.

---

## Design contracts

### Shared types

```ts
export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'paused'
  | 'disconnected'
  | 'stopping'
  | 'error';

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  final: boolean;
}

export interface STTConfig {
  language: string;
  provider: string;
  endpoint?: string;
  apiKey?: string;
}

export type TranscriptCallback = (segment: TranscriptSegment) => void;
export type ErrorCallback = (error: Error) => void;

export interface SpeechToTextProvider {
  connect(config: STTConfig): Promise<void>;
  sendAudio(chunk: ArrayBuffer): void;
  disconnect(): Promise<void>;
  onPartialTranscript(callback: TranscriptCallback): void;
  onFinalTranscript(callback: TranscriptCallback): void;
  onError(callback: ErrorCallback): void;
}
```

### Runtime messages

```ts
export type RuntimeMessage =
  | { type: 'SESSION_START'; tabId: number; config: STTConfig }
  | { type: 'SESSION_PAUSE' }
  | { type: 'SESSION_RESUME' }
  | { type: 'SESSION_STOP' }
  | { type: 'SESSION_CLEAR' }
  | { type: 'SESSION_NEW' }
  | { type: 'SESSION_STATUS'; status: SessionStatus; error?: string }
  | { type: 'TRANSCRIPT_PARTIAL'; segment: TranscriptSegment }
  | { type: 'TRANSCRIPT_FINAL'; segment: TranscriptSegment };
```

### Settings schema

```ts
export interface StoredSettings {
  language: string;
  sttProvider: 'web-speech' | 'streaming-websocket';
  sttEndpoint: string;
  sttApiKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
  userProfile: string;
  systemPrompt: string;
}
```

Defaults: `vi-VN`, `web-speech`, blank STT fields, `openai/gpt-4o-mini`, blank profile, and a concise meeting-assistant system prompt. Model remains editable; this is a default, not a hardcoded request model.

## File map

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`: build, typecheck, test tooling.
- `public/manifest.json`: MV3 permissions, side panel, service worker, extension CSP.
- `public/icons/*`: unpacked-extension icons.
- `src/background/service-worker.ts`: side-panel registration and short-lived routing only.
- `src/background/offscreen.ts`: optional media page for capture/audio processing.
- `src/shared/types.ts`: shared domain contracts.
- `src/shared/messages.ts`: typed message constructors and guards.
- `src/shared/constants.ts`: defaults, endpoint constants, limits.
- `src/shared/errors.ts`: sanitized error categories and user messages.
- `src/storage/settings.ts`: Zod validation and `chrome.storage.local` persistence.
- `src/audio/capture-adapter.ts`: injectable Chrome capture boundary.
- `src/audio/tab-capture.ts`: explicit capture state machine and track cleanup.
- `src/stt/provider.ts`: provider interface and callback types.
- `src/stt/web-speech-provider.ts`: browser fallback adapter.
- `src/stt/streaming-websocket-provider.ts`: documented production adapter seam; no fake transcript path.
- `src/stt/provider-factory.ts`: provider selection and configuration validation.
- `src/transcript/reducer.ts`: pure partial/final reconciliation.
- `src/transcript/context.ts`: latest-question detection and bounded context.
- `src/ai/sse.ts`: chunk-safe SSE parser.
- `src/ai/openrouter.ts`: request construction, stream, abort, sanitization.
- `src/ai/openrouter-schema.ts`: Zod response boundary.
- `src/sidepanel/main.tsx`, `src/sidepanel/App.tsx`: UI entry and orchestration.
- `src/sidepanel/hooks/useMeetingSession.ts`: session lifecycle hook.
- `src/sidepanel/hooks/useAnswerGeneration.ts`: answer stream lifecycle hook.
- `src/sidepanel/components/*`: focused UI components.
- `src/sidepanel/styles.css`: scoped design tokens, responsive layout, reduced motion.
- `src/tests/*.test.ts`: pure logic and client tests.
- `README.md`: setup, provider configuration, build, load, limits, Phase 2.
- `docs/verification.md`: manual Chrome verification checklist.

---

## Task 1: Initialize package and scripts

**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`.

- [ ] Create scripts: `dev`, `build`, `typecheck`, `test`.
- [ ] Add React, TypeScript, Vite, Zod, Vitest, and React type dependencies.
- [ ] Configure strict TypeScript, DOM, Chrome extension types, and no implicit `any`.
- [ ] Configure Vite to build side panel and service worker entries into `dist`.
- [ ] Run `npm install`; expected: lockfile created, no install errors.

## Task 2: Define MV3 manifest and extension shell

**Files:** `public/manifest.json`, `src/sidepanel/main.tsx`, `src/sidepanel/App.tsx`, `src/sidepanel/styles.css`, `public/icons/*`.

- [ ] Add manifest version 3, name, action, side panel, service worker, icons, and minimum Chrome version.
- [ ] Request only `sidePanel`, `storage`, `tabCapture`, `activeTab`; add `offscreen` only when code requires it.
- [ ] Add extension CSP allowing bundled scripts and required `connect-src` endpoints without unsafe-eval.
- [ ] Render `idle` shell with status badge, empty transcript, and settings button.
- [ ] Run `npm run typecheck` and `npm run build`; expected: `dist/manifest.json` exists.

## Task 3: Define shared contracts and constants

**Files:** `src/shared/types.ts`, `src/shared/messages.ts`, `src/shared/constants.ts`, `src/shared/errors.ts`.

- [ ] Add the exact contracts shown above.
- [ ] Add constants for context character limit, answer timeout, default language/model, and provider IDs.
- [ ] Add typed runtime message constructors and a type guard for unknown messages.
- [ ] Add sanitized error categories: capture, permission, STT, network, authentication, rate-limit, invalid-response, cancelled.
- [ ] Run typecheck; expected: no duplicate or mismatched contract names.

## Task 4: Add settings schema and storage

**Files:** `src/storage/settings.ts`, `src/tests/settings.test.ts`.

- [ ] Create Zod schema matching `StoredSettings`.
- [ ] Implement `loadSettings`, `saveSettings`, and `validateOpenRouterKey` input checks.
- [ ] Merge invalid/missing persisted fields with defaults; never throw away valid fields.
- [ ] Avoid logging key values or storage payloads.
- [ ] Test defaults, valid persistence, invalid field reset, and blank-key rejection.
- [ ] Run `npm test -- --run src/tests/settings.test.ts`.

## Task 5: Define Chrome capture adapter

**Files:** `src/audio/capture-adapter.ts`, `src/tests/capture-adapter.test.ts`.

- [ ] Define injectable adapter returning `Promise<MediaStream | null>`.
- [ ] Wrap `chrome.tabCapture.capture` and convert callback failure to sanitized error.
- [ ] Test success, null stream, and Chrome runtime error without requiring real Chrome.

## Task 6: Implement capture state machine

**Files:** `src/audio/tab-capture.ts`, `src/tests/tab-capture.test.ts`.

- [ ] Implement `start(tabId)`, `pause()`, `resume()`, `stop()`, `getStatus()`, and status subscription.
- [ ] Start only after explicit `start()` call; no mount-time capture.
- [ ] Transition `idle → connecting → listening`; reject invalid tab/capture state.
- [ ] Transition to `disconnected` when any required track ends.
- [ ] Stop all tracks and remove listeners on stop, failure, and disconnect.
- [ ] Test valid transitions, invalid transitions, cleanup, and idempotent stop.

## Task 7: Define provider-neutral STT boundary

**Files:** `src/stt/provider.ts`, `src/stt/provider-factory.ts`, `src/tests/stt-provider.test.ts`.

- [ ] Export the exact provider interface and callback signatures.
- [ ] Validate `STTConfig` before provider creation.
- [ ] Return `web-speech` or `streaming-websocket`; reject unknown provider with settings error.
- [ ] Ensure provider disconnect is safe when connect failed.
- [ ] Test factory selection and invalid endpoint/key combinations.

## Task 8: Implement Web Speech fallback

**Files:** `src/stt/web-speech-provider.ts`, `src/tests/web-speech-provider.test.ts`.

- [ ] Wrap `SpeechRecognition`/`webkitSpeechRecognition` through a narrow browser interface.
- [ ] Set `lang`, `continuous`, and `interimResults` from config.
- [ ] Map interim results to `final: false` and completed results to `final: true`.
- [ ] Normalize browser errors and support stop/disconnect without duplicate callbacks.
- [ ] Display settings text that browser recognition may not transcribe tab-captured audio reliably.
- [ ] Test recognition event mapping using a fake browser adapter.

## Task 9: Add production STT adapter seam

**Files:** `src/stt/streaming-websocket-provider.ts`, `src/tests/streaming-websocket-provider.test.ts`, `README.md`.

- [ ] Implement WebSocket lifecycle using configured endpoint and key.
- [ ] Encode/send only audio chunks supplied by capture pipeline; do not create transcript text locally.
- [ ] Parse provider-neutral `{ type, text, id, timestamp }` events.
- [ ] Map close/error/auth events to sanitized errors.
- [ ] Document required provider protocol and exact adapter replacement point.
- [ ] Test connection, chunk send, partial/final event mapping, and disconnect.

## Task 10: Implement transcript reducer

**Files:** `src/transcript/reducer.ts`, `src/tests/transcript.test.ts`.

- [ ] Store final segments and one active partial segment.
- [ ] Replace matching partial with final without duplicate text.
- [ ] Preserve order and timestamps; generate stable IDs only at event boundary.
- [ ] Add clear and new-session actions that reset transcript state.
- [ ] Test partial update, final replacement, multiple final segments, clear, and long-session bounded render selector.

## Task 11: Implement context selector and question detection

**Files:** `src/transcript/context.ts`, `src/tests/context.test.ts`.

- [ ] Select final segments from newest backward under `MAX_CONTEXT_CHARS`.
- [ ] Always include latest question when it fits; otherwise truncate older context first.
- [ ] Detect question marks plus Vietnamese/English interrogative cues.
- [ ] Return structured `{ recentContext, latestQuestion }`.
- [ ] Test Vietnamese, English, punctuation-free questions, empty transcript, and truncation.

## Task 12: Implement chunk-safe SSE parser

**Files:** `src/ai/sse.ts`, `src/tests/sse.test.ts`.

- [ ] Accept arbitrary `Uint8Array` chunks and retain incomplete frame buffer.
- [ ] Parse `data:` lines, ignore comments, emit JSON payloads, and stop on `[DONE]`.
- [ ] Surface malformed JSON as `invalid-response` without including raw sensitive payload.
- [ ] Test one frame, split frame, multiple frames, blank lines, done marker, and malformed data.

## Task 13: Define OpenRouter request schema

**Files:** `src/ai/openrouter-schema.ts`, `src/tests/openrouter-schema.test.ts`.

- [ ] Validate response choices and delta content with Zod.
- [ ] Reject missing content safely; tolerate provider metadata fields.
- [ ] Test valid delta, empty delta, malformed response, and error payload.

## Task 14: Implement OpenRouter streaming client

**Files:** `src/ai/openrouter.ts`, `src/tests/openrouter.test.ts`.

- [ ] Build request using configured model, system prompt, profile, latest question, and bounded context.
- [ ] Never include full transcript outside selected context.
- [ ] Send authorization only in fetch headers; do not log request or key.
- [ ] Parse response body through SSE parser and invoke `onChunk`, `onComplete`, `onError`.
- [ ] Support `AbortSignal`, timeout, HTTP auth failure, rate limit, and network loss.
- [ ] Test request body bounds, headers, first chunk, done, abort, 401, 429, and malformed body.

## Task 15: Add service worker and side-panel registration

**Files:** `src/background/service-worker.ts`, `src/shared/messages.ts`.

- [ ] Register side panel behavior on extension action click.
- [ ] Route only short control/status messages; keep runtime media/transcript state outside worker.
- [ ] Reject unknown messages with typed error response.
- [ ] Build and inspect service-worker bundle for forbidden DOM APIs.

## Task 16: Add side-panel session hook

**Files:** `src/sidepanel/hooks/useMeetingSession.ts`, `src/shared/runtime.ts`, `src/sidepanel/App.tsx`.

- [ ] Load settings and available tabs on mount without starting capture.
- [ ] Send typed start/pause/resume/stop/clear/new messages.
- [ ] Apply transcript events through reducer.
- [ ] Keep capture/STT cleanup in effect teardown and stop action.
- [ ] Expose session state, transcript, selected tab, and recoverable error to UI.
- [ ] Test hook reducer integration with mocked runtime messages.

## Task 17: Build session toolbar and tab selector

**Files:** `src/sidepanel/components/SessionToolbar.tsx`, `TabSelector.tsx`, `StatusBadge.tsx`.

- [ ] Show eligible tabs with title and URL origin only; do not expose full URL unnecessarily.
- [ ] Disable start without selected tab; disable pause/resume based on state.
- [ ] Show explicit listening indicator and stop action.
- [ ] Render capture-denied and disconnected recovery actions.

## Task 18: Build transcript UI

**Files:** `src/sidepanel/components/TranscriptPanel.tsx`, `TranscriptSegment.tsx`, `src/sidepanel/styles.css`.

- [ ] Render final segments and active partial segment distinctly.
- [ ] Show compact timestamp and empty state.
- [ ] Keep auto-scroll paused when user scrolls away from bottom.
- [ ] Avoid per-token screen-reader announcements; announce state changes through `aria-live`.
- [ ] Verify long transcript does not grow layout without bound.

## Task 19: Build answer generation hook and question bar

**Files:** `src/sidepanel/hooks/useAnswerGeneration.ts`, `QuestionBar.tsx`, `AnswerPanel.tsx`.

- [ ] Select bounded context and latest question before request.
- [ ] Require API key and non-empty question/context; show actionable validation error.
- [ ] Append chunks incrementally and expose generating/complete/cancelled/error states.
- [ ] Abort active request on stop-generation and new request.
- [ ] Add copy action using `navigator.clipboard` with fallback error state.

## Task 20: Build settings panel

**Files:** `src/sidepanel/components/SettingsPanel.tsx`, `SettingsField.tsx`.

- [ ] Edit language, provider, STT endpoint/key, OpenRouter key/model, profile, and system prompt.
- [ ] Save validated values; keep invalid values local until corrected.
- [ ] Add explicit API-key check that makes a minimal configured request and sanitizes result.
- [ ] Explain direct-client key risk and session-only transcript behavior.

## Task 21: Apply Taste Skill UI system

**Files:** `src/sidepanel/styles.css`, UI components.

- [ ] Use warm utility palette, cobalt primary action, compact 4px spacing scale, 8–12px radii, restrained shadow.
- [ ] Avoid generic AI-purple gradients, marketing hero layout, excessive glass, and decorative animation.
- [ ] Add visible focus, contrast-safe states, reduced-motion media query, and stable streaming layout.
- [ ] Verify loading, empty, error, listening, paused, disconnected, and generating states visually.

## Task 22: Add privacy-safe error handling

**Files:** `src/shared/errors.ts`, `src/sidepanel/components/ErrorNotice.tsx`, all clients.

- [ ] Map technical errors to category, user message, and recovery action.
- [ ] Redact API keys, authorization headers, transcript, answer, and raw audio from logs/errors.
- [ ] Preserve transcript when answer request fails.
- [ ] Stop media tracks on capture/STT error and expose retry.

## Task 23: Add documentation

**Files:** `README.md`, `docs/verification.md`.

- [ ] Document Node/npm prerequisites, `npm install`, `npm run dev`, `npm run build`, and `npm run typecheck`.
- [ ] Document unpacked load through `chrome://extensions` and side-panel opening.
- [ ] Document STT fallback limitation and production WebSocket adapter configuration.
- [ ] Document OpenRouter key/model/profile/system-prompt setup and direct-client risk.
- [ ] Document current limitations, no latency guarantee, and Phase 2 list.
- [ ] Add manual checklist for permission, capture, pause/resume/stop, transcript reconciliation, AI streaming, cancellation, and reload-free normal flow.

## Task 24: Verification gate

**Files:** all touched files; no new source unless failure requires it.

- [ ] Run `npm test -- --run`; expected: all unit tests pass.
- [ ] Run `npm run typecheck`; expected: zero TypeScript errors.
- [ ] Run `npm run build`; expected: `dist` contains manifest, side panel, worker, and assets.
- [ ] Run `git diff --check` only if repository is initialized; expected: no whitespace errors.
- [ ] Load `dist` unpacked and inspect `chrome://extensions` errors.
- [ ] Verify no capture before explicit start, visible listening state, clean stop, partial/final replacement, settings persistence, streaming, cancellation, and sanitized errors.
- [ ] Measure startup-to-first-transcript and click-to-first-answer-token; report values instead of claiming `<5s`.

## Acceptance coverage

- Installable unpacked and MV3-valid: Tasks 1, 2, 24.
- Explicit capture and lifecycle controls: Tasks 5, 6, 17, 24.
- Partial/final transcript and long-session UI: Tasks 10, 18, 24.
- Language and STT abstraction: Tasks 7, 8, 9, 20.
- OpenRouter key/model/profile/prompt and streaming: Tasks 13, 14, 19, 20, 24.
- Bounded context/latest question: Tasks 10, 11, 19.
- Cancellation and recovery: Tasks 14, 19, 22, 24.
- Privacy/no logging/no silent capture: Tasks 6, 14, 22, 24.
- Taste Skill UI and accessibility: Tasks 18, 21.
- No mock production flow: Tasks 8, 9, 14.
- Setup and Phase 2 documentation: Task 23.

## Scope gaps made explicit

- A real STT provider requires provider credentials and protocol details not present in `prompt.txt`; the adapter seam is implemented, while provider-specific production configuration remains user-supplied.
- Direct OpenRouter calls are an MVP compromise; backend proxy is Phase 3.
- Under-five-second latency remains a measurement target, not a promise.
- Speaker diarization, history, summary, export, auth, team features, billing, and integrations remain Phase 2/3.
