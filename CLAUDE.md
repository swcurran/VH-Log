# CLAUDE.md — vh-log-spec

## About This Repository

See [README.md](README.md) for what VH-Log is, its status, its relationship to did:webvh
and did:vh, the repository layout, how to render the spec, how to add external
references, and how publishing works. Don't repeat that material here; update the README
instead. The spec itself (`spec/`) is the authority on how VH-Log works.

## Notes for Claude

- **Spec-Up:** use the official npm package v0.11.6, NOT the old
  `github:brianorwhatever/spec-up` fork. The render scripts are ESM because 0.11.6 needs
  them. `katex` was removed from `specs.json` (unused; a 0.11.6 packaging bug leaves its
  fonts missing).
- **External references:** add them to `spec_refs` in `specs.json` (see README). Do NOT
  use `external_specs`: in 0.11.6 it only fetches other Spec-Up pages for `[[xref:]]`
  terms, and fetching non-Spec-Up pages produces huge jsdom CSS error dumps.
- **`next/`** is rendered output and git-ignored: don't edit or commit it.
- **Heading anchors:** did:vh (and later specialisations) link here by absolute anchor
  URL. Before renaming a heading, check `/d2/repos/didvh/spec/` for links to it.
- **Check after edits:** `npm run render`, then confirm every `href="#..."` in
  `next/index.html` has a matching `id`, and that did:vh's links into VH-Log still
  resolve.

## Authoring Guidelines

- Write normative requirements using RFC 2119 terms (MUST, SHOULD, MAY).
- Security and Privacy Considerations sections are **non-normative** (following DID Core
  §9/§10; changed 2026-10-05, also in did:vh). Put every RFC 2119 requirement in the
  normative body and have the considerations sections describe threats and link to it.
  VH-Log's transport/TLS/CORS/SSRF rules live in "Publishing and Retrieving Log Resources".
- Each normative statement should be individually testable.
- Keep DID-specific content out of this spec — if something is DID-specific, note it as
  specialisation-defined behaviour.
- Test vectors must be provided for all cryptographic operations (SCID derivation, entry
  hashing, chain verification).
- Cross-reference did:webvh where alignment is intentional.

## Relationship to Other Specs in This Work

- **vp-vh-spec**: A specialisation of VH Log where `state` is a W3C Verifiable Presentation.
  Depends on this spec.
- **whois-vh-spec**: A specialisation of VP-VH where discovery is via `/.well-known/whois-vh`
  or a DIDDoc service entry. Depends on vp-vh-spec.
- **whois-vh** (implementation): TypeScript implementation of whois-vh resolution and
  management. Depends on all three specs.
- **eddsa-jcs-prerotation-2026** (planned, hosted in this repo): Data Integrity cryptosuite
  extending eddsa-jcs-2022 to automate VH-Log's mandatory key pre-rotation. See Planned updates.
- **did:vh** and **did:webvh**: see README. did:vh's local clone is `/d2/repos/didvh`;
  its design decisions and TODOs live in that repo's CLAUDE.md. did:vh was split out of
  this repo on 2026-10-05. A reworked did:webvh copy was briefly kept here as
  `spec-didwebvh/` and removed the same day.

## Current Work and Next Steps

### History

- 2026-06-06: migrated Spec-Up from the old GitHub fork to npm v0.11.6.
- `spec/` reworked into the generalised VH-Log spec: DID-specific content stripped,
  `did.jsonl` replaced with `vh-log.jsonl`, DIDDoc replaced with the generic `state` object,
  header status "Pre-Draft — Editors Draft v0.1".
- 2026-10-05: did:vh moved to its own repo; the did:webvh copy removed; repo cleaned up for
  GitHub Pages publishing.

### Version parameter (resolved 2026-10-07)

`logVersion` is VH-Log's version parameter. A specialisation MAY designate its own
parameter in its place (did:webvh and did:vh use `method`); then `logVersion` MUST
NOT appear, and each specialisation value states the VH-Log version it implies.
This keeps existing did:webvh logs (`method: did:webvh:1.0`) valid.

### Planned updates (agreed 2026-09-16)

1. **Mandatory key pre-rotation.** Remove `updateKeys` entirely. Rename `nextKeyHashes` →
   `prerotationHashes` (list of hashes), required on every entry. The key(s) used to produce an
   entry's proof(s) MUST correspond to a hash present in the *previous* entry's
   `prerotationHashes`. Exception: the genesis entry, whose signing key is self-asserted (same
   bootstrap trust model used today for `updateKeys` in entry 0 — no change to SCID derivation).

2. **New cryptosuite spec: `eddsa-jcs-prerotation-2026`**, hosted in this repo (new `specs.json`
   entry, e.g. `spec-eddsa-jcs-prerotation/`). Extends
   [`eddsa-jcs-2022`](https://w3c.github.io/vc-di-eddsa/), adding to each `proof`: a sequential
   proof number (incrementing once per proof across the whole log's history, not per entry) and
   a `prerotationHashes` array. Using this cryptosuite with VH-Log makes pre-rotation
   self-describing in the proof, so the log-level `prerotationHashes` parameter from item 1
   becomes unnecessary when it's in use. Rule: a key MUST NOT be reused anywhere in the proof
   sequence — the source of the quantum-resistance claim (a public key is revealed only at the
   moment of use, once). Enforceable directly as "never reuse a proof number."

3. **Complete witness/watcher specification.** `spec/specification.md` already has
   `#### Witnesses` and `#### Watchers` sections — this is an audit/completeness pass on
   existing content, not net-new material.

4. **Move shared did:vh / did:webvh material into VH-Log.** Material shared by the DID
   specialisations belongs here so they reference VH-Log rather than each other. did:vh
   still references did:webvh for resolution metadata, the DID-to-HTTPS transformation (`src`
   web locations), witness `did:key` rules, and `#files`/`#whois` dereferencing — candidates
   to move. (Version selection already moved here 2026-10-04 as "Selecting a Version".)
