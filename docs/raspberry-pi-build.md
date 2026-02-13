# Raspberry Pi (arm64) build stability notes

`next build` can stall on low-memory devices while optimizing bundles or running TypeScript.

## Implemented (safe default)

- `npm run build` now uses webpack explicitly:

```bash
next build --webpack
```

This avoids newer/experimental build paths that can be less stable on constrained ARM devices.

## Additional mitigations

1. **Use the Pi-focused build command** (memory cap):

```bash
npm run build:pi
```

This runs:

```bash
NODE_OPTIONS=--max-old-space-size=1536 next build --webpack
```

2. **Add temporary swap on the Pi** when RAM is tight (system-level):
   - Helps prevent OOM stalls during optimization/type checking.
   - Keep modest (e.g., 1-2 GB) to avoid excessive SD-card wear.

3. **Run lint/tests outside build in CI/deploy scripts**:
   - Keep `npm run lint` and `npm test` as separate steps.
   - If needed, build can be retried independently without re-running all checks.
