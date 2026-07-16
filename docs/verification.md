# Manual verification

- [ ] `npm run typecheck` passes.
- [ ] `npm test -- --run` passes.
- [ ] `npm run build` creates `dist/manifest.json`, `dist/index.html`, and `dist/assets/background.js`.
- [ ] Extension loads unpacked without Manifest V3 errors.
- [ ] Side panel opens from extension action.
- [ ] Capture does not start before pressing Start.
- [ ] Listening status appears only after capture succeeds.
- [ ] Pause disables audio tracks; Resume enables them.
- [ ] Stop closes recorder, STT provider, and media tracks.
- [ ] Partial transcript updates in place; final transcript clears partial.
- [ ] Settings persist after closing/reopening panel.
- [ ] Generate answer streams visible tokens.
- [ ] Stop generation aborts active request.
- [ ] Capture, auth, rate-limit, network, and invalid-response errors contain no API key or transcript.
- [ ] Record startup-to-first-transcript latency: ______ ms.
- [ ] Record click-to-first-answer-token latency: ______ ms.
