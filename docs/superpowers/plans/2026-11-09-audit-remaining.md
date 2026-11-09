# Remaining audit corrections

Authorized scope: finish the previously disclosed gaps, including Portuguese via i18n.

## Implementation

- Introduce source-message catalogs, persisted en-US/pt-BR locale, interpolation and Intl formatting. Keep English as default and preserve page content. Switch without remounting editors.
- Translate application-authored text throughout authentication, navigation, workspaces, editors, databases, templates, canvas, settings, activity and knowledge views. Add a language preference to sign-in and account settings.
- Consolidate conflicting stylesheet declarations at their original rules and break the source-editor bundle into meaningful deferred chunks. Preserve the established design and interactions.
- Verify locale persistence, accessible labels, keyboard use, both themes, responsive layouts and editing with a locale change. Re-run the existing full test gates.
- Inspect what assistive-technology and physical-device validation this environment supports. Report any unavailable validation explicitly; do not substitute emulation for a physical-device claim.

## Acceptance evidence

Implementation completed. Current verification and limits are tracked in [the consolidated report](../../relatorio-auditoria-2026-11-09.md).

- Reactive catalogs cover client UI and server validation diagnostics. Locale changes preserve mounted document and code editors, typed content and form values.
- Local warnings retain canonical source messages; a browser regression verifies both language directions with the warning open. The old implementation was reintroduced temporarily and the test failed on the untranslated warning; the restored fix passes.
- CSS has 341 superseded declarations and 43 obsolete native-select arms removed. Computed appearance and desktop/mobile screenshot fixtures remained unchanged.
- Final source-runtime chunk is about 388 kB; the previous 531 kB SourceView bundle is split, and no warning threshold was raised.
- Code review found the cached-warning issue above, now corrected, plus an empty-title edge case now tested. No other important issue was identified.
- Superseding final verification after the root-level copy recovery correction: check passed 293 tests across 58 files plus typecheck/lint/format/build. All 107 browser cases passed together in one frozen-source run. The extra saved-state wait was removed from the original canvas snapshot test; an additional test verifies the product behavior with real socket acknowledgements withheld. See the root-corrections plan and consolidated report for exact evidence.
- Physical device and audible screen-reader testing are unavailable through the exposed environment and are explicitly left unclaimed.
