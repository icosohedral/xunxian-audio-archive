# Project invariants

- Never modify files under `original_data/`.
- Never commit original or generated audio files.
- Public catalog files must not include absolute local paths.
- Audio IDs are derived from the full relative path, including the extension.
- All audio paths must be normalized and checked against the music/sound allowlist.
- BGM and sound effects use separate player instances.
- The sounds page must never render all records at once.
- Run `pnpm check` before considering a feature complete.
