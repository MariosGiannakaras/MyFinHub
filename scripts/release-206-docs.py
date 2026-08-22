from pathlib import Path

changelog = Path('CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
marker = '## [Unreleased]\n\n'
section = '''## [1.2.1] - 2026-08-22

### Fixed

- Fixed the installed Windows desktop backend crash that could occur immediately after valid first-run configuration. The esbuild ESM `server.mjs` bundle now provides a Node `createRequire(import.meta.url)` bridge so Express/CommonJS dependencies can resolve Node built-ins such as `tty` under the bundled Node.js 22 runtime.
- Replaced the generic local-service startup failure with structured stage/error codes and bounded startup diagnostics, preserving the actual backend cause instead of discarding `stderr`.
- Failed desktop startup now returns to the first-run/setup window for correction and retry rather than forcing an opaque quit/reinstall loop.
- Added a real HTTPS Supabase URL/publishable-key preflight before first-run configuration is persisted.
- Hardened Windows CI so a live Electron process is no longer sufficient: both unpacked and installed package smoke require the bundled `node.exe → server.mjs --serve-dist` backend to be running.

### Security & privacy

- Copyable startup diagnostics redact Supabase keys, bearer/JWT values and card-vault key material and remain bounded/in-memory; post-readiness runtime detail is intentionally omitted from copyable failure diagnostics.
- Electron renderer sandboxing, context isolation, loopback-only backend binding, HttpOnly-cookie/same-origin desktop session behavior, owner+AAL2 authorization, Supabase RLS/RPC, optimistic revisions and card-vault boundaries remain unchanged.
- No finance-data/schema migration, accounting rewrite or new runtime secret is introduced.

### Validation

- Fix PR #215 final head `a84120333e326648fff6d48775eecdafed9ba748` passed CI #839, CodeQL #793, Cross-engine/WebKit #126 and Performance #120 with zero unresolved review threads.
- Windows First Run #10 passed a real NSIS install → persisted first-run configuration → Electron safeStorage/Windows DPAPI → live packaged backend → uninstall path without runtime Supabase/card-vault environment injection.
- Windows Desktop #489 passed strengthened unpacked and installed launch checks that require the real packaged backend, plus NSIS install/launch/uninstall, checksum and evidence upload.
- The integrated v1.2.1 release-prep tree is independently revalidated under release tracker #206 before production promotion; implementation-branch results are supporting evidence only.

### Notes

- v1.2.1 is a backward-compatible Windows reliability/security-diagnostics patch over v1.2.0. Web finance behavior, database state and Android bearer API semantics are unchanged.
- Existing v1.2.0 desktop configuration can be reused; the patch does not require a new Supabase project or a card-vault-key rotation.
- The Windows build may remain unsigned for personal use, so Windows can display Unknown publisher / Microsoft Defender SmartScreen; installer integrity remains protected by the controlled release source and published SHA-256 checksum.

'''
if '## [1.2.1]' not in text:
    if marker not in text:
        raise SystemExit('Unreleased changelog marker not found')
    text = text.replace(marker, marker + section, 1)
text = text.replace(
    '[Unreleased]: https://github.com/MariosGiannakaras/MyFinHub/compare/myfinhub-v1.2.0...develop',
    '[Unreleased]: https://github.com/MariosGiannakaras/MyFinHub/compare/myfinhub-v1.2.1...develop',
)
if '[1.2.1]:' not in text:
    text = text.replace(
        '[1.2.0]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.2.0',
        '[1.2.1]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.2.1\n[1.2.0]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.2.0',
    )
changelog.write_text(text, encoding='utf-8')

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
text = text.replace('myfinhub-v1.2.0', 'myfinhub-v1.2.1')
text = text.replace('MyFinHub-Setup-1.2.0-x64.exe', 'MyFinHub-Setup-1.2.1-x64.exe')
text = text.replace('v1.2.0 release notes', 'v1.2.1 release notes')
text = text.replace('Release-v1.2.0-', 'Release-v1.2.1-')
text = text.replace('Windows-v1.2.0-', 'Windows-v1.2.1-')
text = text.replace('The current stable Windows release is **v1.2.0**.', 'The current stable Windows release is **v1.2.1**.')
old = 'The installed application contains its own Electron host, bundled Node.js runtime and local backend. Normal use does not require Git, Node.js, a terminal or a browser.'
new = old + '\n\nThe v1.2.1 desktop startup path validates the Supabase connection before saving first-run configuration. If the local backend cannot start, the setup window remains available with a structured error code/stage, safe redacted diagnostics and retry/edit capability rather than closing with a generic failure.'
if old in text and 'structured error code/stage' not in text:
    text = text.replace(old, new, 1)
readme.write_text(text, encoding='utf-8')

assert '## [1.2.1] - 2026-08-22' in changelog.read_text(encoding='utf-8')
assert 'MyFinHub-Setup-1.2.1-x64.exe' in readme.read_text(encoding='utf-8')
assert 'MyFinHub-Setup-1.2.0-x64.exe' not in readme.read_text(encoding='utf-8')
