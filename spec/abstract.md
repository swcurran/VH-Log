## Abstract

The **Verifiable History Log (VH-Log)** specification defines a general-purpose,
append-only, cryptographically chained log structure for recording the history of
a versioned state object. Each entry in the log captures a new version of an
arbitrary [[ref: state]] object along with the cryptographic proofs that
authenticate it. The chain of entries forms a tamper-evident history that any
party can independently verify.

VH-Log provides the following features:

- An append-only [[ref: log]] of [[ref: log entries]], each representing a new
  version of the [[ref: state]] object.
- A [[ref: Self-Certifying Identifier]] (SCID) derived from the genesis entry and
  embedded in the log's identifier, enabling any verifier to confirm that a given
  log is the authentic log for that identifier.
- Cryptographic chaining: each entry's [[ref: versionId]] is derived from a hash
  of the entry's content, which includes the previous entry's [[ref: versionId]]
  (for the genesis entry, the [[ref: SCID]]), linking all entries together in a
  microledger.
- A [[ref: parameters]] mechanism allowing per-entry configuration — such as
  authorised [[ref: update keys]], [[ref: next key hashes]] for key pre-rotation,
  and [[ref: witnesses]] — to evolve over the lifetime of the log.
- An optional [[ref: witness]] mechanism: a threshold of external parties sign
  each entry before publication, providing additional tamper-evidence beyond the
  controller's own proof.
- An optional [[ref: watcher]] mechanism: parties that archive copies of the log
  and serve them independently of the original publisher, improving resilience and
  enabling detection of log tampering.
- A resolution algorithm that, given a log and an optional target version,
  returns the [[ref: state]] object from the entry at or before that version after
  cryptographically verifying the full chain.

The [[ref: state]] type is intentionally unspecified in VH-Log — it is an
arbitrary JSON object whose schema is defined by the [[ref: specialisation]] that
uses VH-Log as its foundation. This makes VH-Log a reusable building block for
any system that requires a verifiable, append-only history of a versioned object.

VH-Log was derived from the log mechanism in the
[did:webvh v1.0 specification](https://identity.foundation/didwebvh/), which was
iteratively developed through the specification process and two independent
implementations to arrive at a stable, proven capability. The generalisation
extracts that mechanism from its DID-specific context so it can serve as a
reusable foundation for other specifications.

The first [[ref: specialisation]] of VH-Log is the [did:vh DID
Method](https://swcurran.github.io/didvh/), in which the [[ref: state]] object is a W3C
DID Document and the DID is just `did:vh:<SCID>`. A did:vh DID contains no
location, so a client can source its log — get the log itself, or a
reference to it — from anywhere: the context in which the DID was received, a
[[ref: watcher]], a peer, or a web location. Either is passed to the resolver
as DID resolution options, and the log is verified in the same way.

VH-Log was extracted from the [did:webvh specification](https://identity.foundation/didwebvh/), which
is expected to be redefined in a future version as a [[ref: specialisation]]
of VH-Log, with the [[ref: state]] object constrained to a W3C DID Document and
the log located via a DID-to-HTTPS transformation.
