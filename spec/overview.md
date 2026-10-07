## Overview

Many digital systems need to track the history of a versioned object — a
configuration, an identity document, a credential, a policy — in a way that
allows any party to verify that the history has not been tampered with. Existing
approaches tend to rely on either a trusted central authority (which introduces a
single point of failure and requires ongoing trust in that authority) or a
distributed ledger (which introduces significant infrastructure complexity and
cost).

VH-Log takes a different approach: the history is recorded as an append-only
chain of signed entries, where each entry's identifier is derived from a hash of
its own content including the previous entry's identifier. This cryptographic
chaining makes the log self-verifying — a verifier does not need to trust the
party serving the log, only the cryptographic proofs within it.

The following is a summary of how VH-Log works:

1. A [[ref: Log Controller]] creates a [[ref: log]] by producing the first
   [[ref: log entry]], which establishes the initial [[ref: state]] object. The
   [[ref: SCID]] for the log is derived from the content of this first entry and
   embedded in the log's identifier.

2. The [[ref: log]] is a [[ref: JSON Lines]] file containing one [[ref: log entry]]
   per line. Each [[ref: log entry]] is a JSON object with the following properties:
   - `versionId` — a string combining the entry's version number and a hash of
     the entry content. The hash input includes the previous entry's `versionId`,
     chaining entries together.
   - `versionTime` — the time of the entry, as asserted by the [[ref: Log Controller]].
   - `parameters` — configuration that takes effect from this entry onward, such
     as the authorised [[ref: update keys]] and [[ref: logVersion]].
   - `state` — the new version of the [[ref: state]] object. The type and schema
     of the [[ref: state]] object is defined by the [[ref: specialisation]].
   - `proof` — one or more [[ref: Data Integrity]] proofs signed by an authorised
     [[ref: update key]].

3. When creating the first entry, the [[ref: Log Controller]] uses the placeholder
   string `{SCID}` wherever the [[ref: SCID]] will eventually appear, calculates
   the [[ref: SCID]] from the resulting entry, then replaces all placeholders with
   the calculated [[ref: SCID]] before signing and publishing.

4. To update the log, the [[ref: Log Controller]] appends a new [[ref: log entry]],
   signed by an authorised [[ref: update key]], to the log file and publishes the
   updated file. If [[ref: witnesses]] are configured, the required threshold of
   witness proofs must be collected and published before the updated log is made
   available.

5. A [[ref: Resolver]] retrieves the log file from whatever location the
   [[ref: specialisation]] defines, then processes each [[ref: log entry]] in
   order: verifying the cryptographic chain, verifying each entry's proof, and
   accumulating [[ref: parameters]]. The result is the [[ref: state]] object from
   the latest valid entry, or from the entry at a requested version.

6. Because each [[ref: log entry]] is cryptographically bound to all prior entries
   via the hash chain, and the log's identifier is bound to the genesis entry via
   the [[ref: SCID]], the log can be verified regardless of where it is retrieved
   from — whether from the original publisher, a [[ref: watcher]], a cache, or
   any other source.

### Specialisations

VH-Log defines the log structure, cryptographic mechanisms, and resolution
algorithm. The [[ref: state]] type, the log's location and resource naming
conventions, and any additional constraints or features are left to be defined by
a **specialisation** — a specification that uses VH-Log as its foundation.

For example, the [did:vh specification](https://swcurran.github.io/didvh/) is a
specialisation of VH-Log in which:

- The [[ref: state]] is a W3C DID Document.
- The log's identifier is the DID `did:vh:<SCID>`, which contains no location.
  The specialisation describes the sources from which a client can get the
  log itself or a reference to it — context, [[ref: watchers]],
  peer-to-peer exchange, and web locations — and passes either to the
  resolver as DID resolution options.
- The log file is named `did.jsonl` and the witness file is named
  `did-witness.json`.
- Witnesses are identified using `did:key` DIDs.
- The `method` parameter (a did:vh-specific parameter) specifies the
  did:vh spec version and implies the VH-Log base version.

The [did:webvh specification](https://identity.foundation/didwebvh/), from which VH-Log was extracted,
is closely related and is expected to become a VH-Log specialisation in a
future version. It differs from did:vh mainly in placing a domain and path in the DID and
locating the log via a DID-to-HTTPS transformation.

A specialisation **MAY** define additional [[ref: parameters]], additional
resource naming conventions, and additional constraints on the [[ref: state]]
object. A specialisation **MUST NOT** redefine or contradict the core VH-Log
[[ref: parameters]] and processing rules defined in this specification.
