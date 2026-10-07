## Definitions

[[def: base58btc]]

~ Applies [[spec:draft-msporny-base58-03]] to convert data to a `base58`
encoding. Used in VH-Log for encoding hashes for [[ref: SCIDs]] and
[[ref: entry hashes]].

[[def: Data Integrity]]

~ [W3C Data Integrity](https://www.w3.org/community/reports/credentials/CG-FINAL-data-integrity-20220722/)
is a specification of mechanisms for ensuring the authenticity and integrity of
structured digital documents using cryptography, such as digital signatures and
other digital mathematical proofs.

[[def: Entry Hash, entry hashes]]

~ A VH-Log entry hash is a hash generated using a formally defined process over
the input data of a [[ref: log entry]], excluding the [[ref: Data Integrity]]
proof. The input data includes the `versionId` of the predecessor entry,
ensuring that all entries are cryptographically chained together. The generated
[[ref: entry hash]] is included in the `versionId` of the [[ref: log entry]] and
**MUST** be verified by a [[ref: Resolver]].

[[def: ISO8601, ISO8601 String]]

~ A date/time expressed using the [ISO8601 Standard](https://en.wikipedia.org/wiki/ISO_8601).

[[def: JSON Canonicalization Scheme]]

~ [[spec:rfc8785]] defines a method for canonicalizing a JSON structure such
that it is suitable for verifiable hashing or signing.

[[def: JSON Lines, JSON Line]]

~ A file of JSON Lines, as described on the site
[https://jsonlines.org/](https://jsonlines.org/). In short, `JSONL` is lines of
JSON with whitespace removed and separated by a newline, convenient for handling
streaming JSON data or log files.

[[def: Log, VH Log, VH-Log log, logs]]

~ A VH-Log log is an append-only [[ref: JSON Lines]] file containing one
[[ref: log entry]] per line, recording the full history of a versioned
[[ref: state]] object. The log is identified by the [[ref: SCID]] derived from
its genesis entry.

[[def: Log Controller, Log Controllers]]

~ The entity that controls (creates, updates, and deactivates) a given
[[ref: log]]. The [[ref: Log Controller]] holds the private keys corresponding
to the authorised [[ref: update keys]] listed in the [[ref: log]]'s
[[ref: parameters]].

[[def: Log Entry, Log Entries, Entry, Entries, log entry, log entries]]

~ A log entry is a JSON object in a [[ref: VH-Log log]] that records one version
of the [[ref: state]] object. Each entry contains a `versionId`, `versionTime`,
`parameters`, `state`, and `proof`. The genesis entry establishes the initial
[[ref: state]] and the [[ref: SCID]]; subsequent entries record updates.

[[def: logVersion]]

~ The VH-Log version [[ref: parameter]]. It identifies the version of the
specification in use and defines the permitted cryptographic algorithms (hash
algorithm and [[ref: Data Integrity]] cryptosuite) for the current and subsequent
[[ref: log entries]]. Required in the first [[ref: log entry]]. A
[[ref: specialisation]] may designate its own parameter in its place, such as the
`method` parameter of did:webvh and did:vh, whose values identify a version of
the specialisation and the VH-Log version it implies. Where this specification
refers to logVersion, it means the designated parameter if there is one. See
[VH-Log Parameters](#vh-log-parameters).

[[def: multibase]]

~ A specification for encoding binary data as a string using a prefix that
indicates the encoding.

[[def: multikey]]

~ A verification method that encodes key types into a single binary stream that
is then encoded as a [[ref: multibase]] value.

[[def: multihash]]

~ Per the [[spec:multiformats]], [[ref: multihash]] is a specification for
differentiating instances of hashes. Software creating a hash prefixes data to
the hash indicating the algorithm used and the length of the hash, so that
software receiving the hash knows how to verify it. Although [[ref: multihash]]
supports many hash algorithms, for interoperability, [[ref: Log Controllers]]
**MUST** only use the hash algorithms defined as permitted by the active
[[ref: logVersion]].

[[def: next key hashes, nextKeyHashes]]

~ The `nextKeyHashes` [[ref: parameter]]: an array of hashes of [[ref: multikey]]
formatted public keys that the [[ref: Log Controller]] commits to using as
[[ref: update keys]] in the next [[ref: log entry]], enabling the [[ref:
Pre-Rotation]] feature.

[[def: parameters, parameter]]

~ VH-Log parameters are a defined set of configurations in each [[ref: log entry]]
that control how the [[ref: Log Controller]] generated the entry and how the
[[ref: Resolver]] must process the [[ref: log]]. Parameters accumulate across
entries: an entry that omits a parameter inherits the previously active value.
The use of parameters allows for the controlled evolution of log handling over
the lifetime of the [[ref: log]].

[[def: Pre-Rotation, Key Pre-Rotation]]

~ A technique for a controller of a cryptographic key to commit to the public key
it will rotate to next, without exposing that actual public key. It protects
against an attacker who gains knowledge of the current private key from being
able to rotate to a new key known only to the attacker.

[[def: Resolver, Resolvers]]

~ A party that retrieves and processes a [[ref: VH-Log log]] to produce the
current or historical [[ref: state]] object. The [[ref: Resolver]] verifies the
cryptographic chain, [[ref: Data Integrity]] proofs, and [[ref: SCID]] of the
log.

[[def: self-certifying identifier, self-certifying identifiers, SCID, SCIDs]]

~ An identifier derived from the initial content of the [[ref: log]] such that
an attacker could not create a different log with the same identifier. The input
for a VH-Log SCID is the genesis [[ref: log entry]] with the placeholder
`{SCID}` wherever the SCID is to be placed.

[[def: specialisation, specialisations]]

~ A specification that uses VH-Log as its foundation by defining the [[ref:
state]] object type, the log's location and resource naming conventions, and any
additional constraints or features. A specialisation **MUST NOT** redefine or
contradict the core VH-Log [[ref: parameters]] and processing rules.

[[def: state]]

~ The versioned object recorded in each [[ref: log entry]]. The type and schema
of the [[ref: state]] object is defined by the [[ref: specialisation]]. In
VH-Log itself, [[ref: state]] is an arbitrary JSON object.

[[def: threshold, witness threshold]]

~ An algorithm that defines when a sufficient number of [[ref: witnesses]] have
submitted valid [[ref: Data Integrity]] proofs for a [[ref: log entry]] such that
it is approved and can be published. Details are in the
[Witness Threshold Algorithm](#witness-threshold-algorithm) section.

[[def: update key, update keys, updateKeys]]

~ [[ref: Multikey]]-formatted public keys whose corresponding private keys are
authorised to sign [[ref: log entries]] that update the [[ref: log]]. The active
set of update keys is defined by the `updateKeys` [[ref: parameter]].

[[def: versionId]]

~ The identifier of a [[ref: log entry]], consisting of the entry's version
number (a positive integer starting at `1`), a literal dash `-`, and the
[[ref: entry hash]] of the entry. The `versionId` links each entry to its
predecessor and is used to identify specific versions during resolution.

[[def: watcher, watchers]]

~ Watchers are entities that monitor [[ref: logs]] for changes or updates on
behalf of their clients. Watchers maintain a historical cache of [[ref: log]]
versions and verify that the [[ref: Log Controller]] is consistently following
the prescribed evolution process. By ensuring integrity and traceability,
watchers help foster trust among clients who rely on up-to-date and authentic
log information. Watchers provide endpoints for retrieving log information and
receiving [[ref: webhooks]] notifying the watcher about updates and deletion
requests. Any party may run a watcher; it need not be listed in the log.

[[def: webhook, webhooks]]

~ A webhook is a mechanism that enables real-time communication between systems
by sending HTTP callbacks (typically POST requests) to a specified URL when an
event occurs. Webhooks are commonly used for event-driven integrations and
automation. Although webhooks are an implementation pattern rather than a formal
standard, best practices are documented in [[spec:rfc8030]].

[[def: witness, witnesses, witnessed]]

~ Witnesses are participants in the process of approving a new [[ref: log entry]]
before it is published. A witness receives from the [[ref: Log Controller]] a
[[ref: log entry]] ready for publication, verifies it according to this
specification, and approves it according to the governance of the ecosystem. If
the verification and approval are positive, the witness returns a
[[ref: Data Integrity]] proof attesting to that result. The identity format and key type of
witnesses is defined by the [[ref: specialisation]].
