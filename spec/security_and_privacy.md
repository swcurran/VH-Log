## Security Considerations

*This section is non-normative.*

This section follows the guidelines in [[spec:RFC3552]]. It describes the
threats to VH-Log and how the requirements in this specification address them.
The requirements themselves are defined in the normative sections referenced
below.

### Threats and Attacks

The following classes of attack apply to all log operations:

- **Eavesdropping** — Log files, witness files and other log resources are
  served over HTTPS (see [Publishing and Retrieving Log
  Resources](#publishing-and-retrieving-log-resources)). The verifiability of
  VH-Log means that tampering with the contents of individual log entries is
  detectable; TLS protects against passive observation and other network-based
  risks.

- **Replay attacks** — A [[ref: Resolver]] verifies the whole log, including
  monotonic progression of versions and times and the chain of entry hashes, and
  rejects any log that does not verify, as defined in [Read
  (Resolve)](#read-resolve).

- **Message insertion, deletion, and modification** — Each log entry and witness
  proof is integrity-protected by a cryptographic signature. Any change to a log
  entry causes verification to fail, as defined in [Read (Resolve)](#read-resolve).

- **Truncation or withholding of log entries** — An attacker (or misconfigured
  intermediary) could serve an older-but-valid prefix of the log, truncating
  newer entries and presenting a stale state. Mitigations include:
    - **Resolver cache-and-compare:** a [[ref: Resolver]] that remembers the
      latest `versionId` it has seen for a log can detect a truncated copy (see
      [Comparing Copies of a Log](#comparing-copies-of-a-log)).
    - **Witness verification:** where [[ref: Log Controllers]] use witnesses,
      [[ref: Resolvers]] verify that every entry is properly witnessed, and
      ignore witness proofs for unpublished or truncated entries (see
      [Verifying Witness Proofs During
      Resolution](#verifying-witness-proofs-during-resolution)).
    - **Multi-source resolution:** a client can ask a [[ref: Resolver]] to
      retrieve the log from [[ref: watchers]] and compare the copies, using the
      `checkWatchers`, `extraWatchers` and `minCopies`
      [resolution options](#resolution-options). Copies that are behind are
      reported in the [Resolution Result](#resolution-result).
    - **End-to-end TLS:** while signatures detect per-entry tampering, TLS
      reduces opportunities for active truncation in transit.

- **Denial of Service (DoS) and amplification** — A malicious or compromised log
  server could attempt to exhaust resolver resources by serving pathologically
  large log files, or by holding a connection open and streaming log entries
  indefinitely. This risk is most acute for resolvers that encounter
  previously-unseen logs on behalf of their clients.

  - The requirement that each entry's `versionTime` be strictly greater than the
    previous one, and not in the future, constrains log length — a log file
    with implausibly rapid `versionTime` progression is likely malformed.
    However, this does not fully prevent the attack, as a patient attacker can
    pace log entry generation to match valid `versionTime` increments.

  - The size cap and timeout required in [Retrieving Log
    Resources](#retrieving-log-resources) bound the cost of a single
    resolution. A declared `Content-Length` lets a resolver reject an oversized
    log before processing begins, but cannot itself be relied on; the presence
    of HTTP range request support (`Accept-Ranges: bytes`) is a useful signal
    that a server is serving a static resource rather than generated content.
    Resolvers are also advised to apply rate limits to resolution requests,
    particularly for previously-unseen logs, and concurrency limits on
    simultaneous resolution operations.

  - What counts as "excessively large" or "repeated" is best established
    through community or ecosystem governance. These mitigations are standard
    HTTP service hardening practices and are not unique to VH-Log.

- **Man-in-the-middle (MitM)** — HTTPS and signature verification of log
  entries and witness proofs protect against undetected modification of
  individual entries. Withholding and truncation are addressed above. TLS also
  authenticates the server and reduces opportunities for active interference.

- **Conflicting parallel updates / split view** — Multiple authorized updates
  from the same parent entry can produce divergent logs. This specification
  requires [[ref: Log Controllers]] to publish only logs that extend their
  previously published log ([Update](#update)), [[ref: witnesses]] to approve at
  most one child of any entry ([Witnessing a Log Entry
  Update](#witnessing-a-log-entry-update)), and the witness file to contain no
  conflicting proofs ([The Witness Proofs File](#the-witness-proofs-file)).
  [[ref: Resolvers]] that remember the latest version they have seen can detect
  older branches, and [[ref: Resolvers]] given more than one copy fail
  resolution when the copies diverge
  ([Comparing Copies of a Log](#comparing-copies-of-a-log)). [[ref: Watchers]]
  report divergence across sources ([Watchers](#watchers)). Because no other
  party can verify that a witness has followed these rules, detecting split
  views ultimately relies on comparing copies of the log from multiple sources,
  whether by [[ref: watchers]], which any party may run, or by a
  [[ref: Resolver]] asked to check them. [[ref: Watchers]] listed in the log
  are chosen by the [[ref: Log Controller]], so the `extraWatchers`
  [resolution option](#resolution-options), naming [[ref: watchers]] the
  caller chooses, gives the stronger check against a [[ref: Log Controller]]
  showing different logs to different parties.

- **Server-Side Request Forgery (SSRF)** — A resolver acts as an HTTP client
  for a location derived from an untrusted log identifier, and, with the
  `extraWatchers` [resolution option](#resolution-options), for
  [[ref: watcher]] URLs supplied by its caller. A [[ref: Resolver]] offered as
  a service can refuse or limit `extraWatchers`. The transport
  checks in [Retrieving Log Resources](#retrieving-log-resources) are standard
  SSRF defences. They are stated normatively because common implementations
  have been found vulnerable to at least one of: following redirects,
  accepting IP literals, case-sensitive percent-decoding, and checking values
  before rather than after decoding.

- **Other attacks** — The VH-Log verification process mitigates downgrade
  attacks on cryptographic algorithms and prevents poisoning of log or witness
  files, since unauthorized changes fail signature verification. Verification
  does not, however, address availability. Operational measures such as
  [Watchers](#watchers) and well-known web techniques can improve resilience.

### Residual Risks

Residual risks include:

- Compromise of the web hosting infrastructure serving the log resources.
  - While this can impact access to the log file and associated files, it does
    not compromise the integrity of the log entries themselves, nor the
    verifiability of the log.
- Compromise of [[ref: Log Controller]] private keys.
  - A [[ref: Log Controller]] can mitigate this risk through the use of
    [pre-rotation keys](#pre-rotation-key-hash-generation-and-verification),
    treating each revealed pre-rotation key as spent and never reusing it.
    Reuse of a revealed key is not invalid, but it reduces the containment
    that pre-rotation provides.
  - Other good security practices also help, such as using hardware security
    modules (HSMs) or secure enclaves for key storage, enforcing strong access
    controls, maintaining secure backups of critical keys, and performing
    regular key rotations.
- Weaknesses in underlying cryptographic algorithms after deployment.
- Misconfiguration of cache control or TTL values.
- Implementation errors in resolvers or [[ref: Log Controllers]].
- Resolvers operating in contexts where they may encounter large numbers of
  previously-unseen logs — such as open verification services — face elevated
  resource exhaustion risk. Such resolvers are advised to implement rate
  limiting and monitoring for abusive resolution patterns, with the ability to
  block offending sources.

### Integrity Protection and Update Authentication

All log operations (create, update, deactivate) are integrity-protected by the
cryptographic verification of log entries. Update authentication is provided by
verifying the [[ref: Log Controller]]'s proof(s) against the active `updateKeys`
in the log [[ref: parameters]] (see [Authorized Keys](#authorized-keys)).

Because a VH-Log log and its entries are self-certifying, they can be verified
and trusted regardless of how they are retrieved — directly from the host, via a
cache, through a CDN, from a [[ref: watcher]], or via a trusted resolver
service. The verification process ensures authenticity and integrity
independent of the transport channel.

### Authentication Characteristics

The authentication of log updates is based on possession of the private keys
associated with the update and pre-rotation keys. The security of the log
therefore depends on the strength of these keys, their secure storage, and the
cryptographic algorithms used.

### Unique Assignment of Logs

In VH-Log, uniqueness of a log is based on the
[[ref: self-certifying identifier]] (SCID) generated at the inception of the log. The SCID is
cryptographically bound to the [[ref: Log Controller]]'s keys and ensures that
no two independently created logs can have the same identifier.

The location of the log (as defined by the [[ref: specialisation]]) is used
solely for discovery of the log file and associated files; it is not used for
verification of log control (see [The VH-Log File](#the-vh-log-file)).

### Endpoint Authentication

Log resources are served over HTTPS with TLS server authentication (see
[Publishing and Retrieving Log
Resources](#publishing-and-retrieving-log-resources)). While the verifiability
of VH-Log ensures that any tampering with the contents of individual log entries
is detectable, TLS provides additional protection against active network attacks
(including truncation or withholding) and authenticates the server providing the
log resources.

### Network Topology

VH-Log relies on web infrastructure and does not require peer-to-peer
networking. CDN caches and load balancers in front of a log host can serve stale
data; [Publishing Log Resources](#publishing-log-resources) requires [[ref: Log
Controllers]] that use them to prevent this.

### Cryptographic Protection

The following data is protected:

- **Log entries** — Signed by the [[ref: Log Controller]]'s keys.
- **Witness proofs** — Signed by witness keys.

These signatures provide integrity and update authentication but not
confidentiality; log entries are public. Private keys and other secret material
must never be exposed in the log (see [Authorized Keys](#authorized-keys)).

### Signature Implementation

VH-Log uses standard [[ref: Data Integrity]] proof mechanisms for signing log
entries and witness proofs, as defined in the cryptographic suite used. The
cryptosuites permitted for each [[ref: logVersion]] are listed in [VH-Log
Parameters](#vh-log-parameters).

### Cross-Origin Resource Sharing (CORS)

To support resolution by client applications running in a web browser, the log
file must be accessible from any origin. [Publishing Log
Resources](#publishing-log-resources) requires the
`Access-Control-Allow-Origin: *` header for this reason.

### Post Quantum Attacks

VH-Log's [[ref: Key Pre-Rotation]] approach provides enough flexibility for
"post-quantum safety." Implementers are advised to consult current guidance on
pre-rotation keys and post-quantum cryptography.

### Implementation Hygiene

The following practices are not unique to VH-Log but represent recurring
failure points observed across implementations. Implementers are advised to
treat these as baseline hygiene.

- **Dependency currency.** Keep cryptographic and HTTP dependencies on
  supported, patched versions. Run a vulnerability scanner on every build.
- **Filesystem permissions.** Create private keys and secret-bearing
  configuration files with owner-only permissions (e.g., `0600` on POSIX). Do
  not read secret material from the current working directory or other untrusted
  locations by default.
- **CLI tools.** Do not print private keys, mnemonics, or other long-lived
  secrets to stdout/stderr or shell history. Where display is necessary, prompt
  before printing and offer a file-output alternative with restrictive
  permissions.
- **HTTPS certificate validation.** Never disable certificate validation by
  default (this is required for resolvers in [Retrieving Log
  Resources](#retrieving-log-resources)).
- **Error messages.** Avoid including internal stack traces, file paths, or
  library versions in error details returned to clients.

### Resolver Validation Checklist

The following checklist maps normative resolver requirements to concrete
validation points, and is intended to assist conformance test suite authors and
implementers auditing their own resolver implementations. It does not restate
or replace the normative requirements in this specification.

**Transport:** HTTPS only; no auto 3xx; reject IP literals before & after
percent-decoding; reject private/loopback/link-local DNS resolutions in
production; normalize percent-encoding case; validate path segments after
decoding (`.`, `..`, `/`, `\`, NUL, leading/trailing whitespace); enforce max
response size with `Content-Length` first; enforce a wall-clock timeout.

**Log structure:** unbroken `1, 2, 3, ...` version sequence; strictly increasing
UTC ISO8601 `versionTime`; every `versionTime` ≤ now (bounded skew);
[[ref: entry hash]] chain verified for every entry; [[ref: logVersion]] is an explicitly supported value
(never silently downgraded).

**SCID & identity:** first entry's `parameters.scid` is the genesis self-hash;
[[ref: SCID]] never changes.

**Keys & proofs:** every proof has `type: DataIntegrityProof`, the `cryptosuite`
and `proofPurpose` required by the active [[ref: logVersion]]; `verificationMethod` key
in active `updateKeys`; under pre-rotation, `updateKeys` explicit in every entry
and every key hashes to a value in previous `nextKeyHashes`.

**Witnesses:** `threshold` is positive integer ≤ count of distinct
`witnesses[].id`; all `witnesses[].id` distinct; threshold met by counting
verified proofs from distinct witness identifiers, not total proof count; each
accepted proof's `versionId` corresponds to an entry in the log file being
verified; proofs verified using the method defined by the [[ref:
specialisation]].

**Failure modes:** unknown parameter values, malformed `witness`, hash algorithm
mismatch, and cryptosuite mismatch all fail resolution — never silently
coerced.

## Privacy Considerations

*This section is non-normative.*

This section addresses privacy considerations in alignment with
[[spec:RFC6973]] Section 5.

### Surveillance

VH-Log publishes logs to publicly accessible HTTPS endpoints. While the contents
of the log are generally intended to be public, the timing, frequency, and
correlation of updates can be observed and may reveal operational patterns or
associations.

Resolution of a log also exposes the resolver's network activity to DNS
providers and web servers, which could be used for tracking. Controllers and
resolvers can use privacy-enhancing technologies such as VPNs, TOR, or trusted
universal resolver services to reduce this risk.

### Stored Data Compromise

Log data is stored on web servers. A compromise of the hosting infrastructure
could allow tampering with log resources. HTTPS and cryptographic signatures
protect integrity, but confidentiality is not provided.

### Correlation

The use of a static log identifier and public log entries can enable
correlation of activities over time. [[ref: Log Controllers]] are advised to
avoid embedding personal identifiers or unnecessary information in [[ref:
state]] objects.

### Identification

Logs are public and can be linked to real-world identities through the hosting
location. Entities that require anonymity need to consider whether VH-Log is
appropriate for their use case.

### Right to Erasure

A [[ref: Log Controller]] can delete published data as described in
[Deactivate](#deactivate), but [[ref: watchers]] monitoring a removed log are
expected to keep caching its last known state. Complete erasure therefore
depends on [[ref: watcher]] behaviour, and the process for it is best defined by
the governance of the ecosystem — for example, through the watcher deletion
operation in [Watcher HTTP API Operations](#watcher-http-api-operations).

### Secondary Use

Information published in the log may be repurposed by third parties. [[ref: Log
Controllers]] are advised to minimise the publication of data that could be used
for purposes beyond the intended use.

### Disclosure

All data in the log is publicly accessible, so sensitive data does not belong in
it.

### Exclusion

VH-Log does not require controller ownership of any specific infrastructure. The
[[ref: specialisation]] defines the hosting location, and controllers may
publish logs on web-hosting platforms that serve static files over HTTPS. This
reduces barriers to participation.

Residual exclusion risks remain: access to such platforms typically requires an
account and compliance with provider terms of service; platforms might impose
geoblocking, payment requirements, or content restrictions; and accounts can be
suspended. [[ref: Log Controllers]] are advised to keep the ability to republish
or mirror log resources under alternative hosts (including using [[ref:
watchers]]), and to document a transition plan so that participants are not
locked out if a hosting provider becomes unavailable. The verifiable history of
the log ensures that it can be verified regardless of the source.
