# Contributing

Thank you for helping make appointment preparation more accessible and honest.

## Before coding

Read `SAFETY.md` and `PRIVACY.md`. Open an issue before changing emergency copy,
data flow, provider behaviour, or the boundary between preparation and medical
advice.

## Development

```bash
npm ci
npm run dev
npm run check
```

Use synthetic information in tests and screenshots. Never paste real health
records into an issue, fixture, prompt, or pull request.

## Pull-request expectations

- Explain the user-visible claim being changed.
- Add a test that would fail if the safety property regressed.
- Preserve mock mode as the default.
- Keep API credentials server-side.
- Make uncertainty and external data processing visible.
- Prefer a small falsifiable change over new architecture without evidence.
