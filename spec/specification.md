## VH-Log Specification

### Conformance

As well as sections marked as non-normative, all examples, notes, and
informative checklists in this specification are non-normative. Everything
else in this specification is normative.

The key words **MAY**, **MUST**, **MUST NOT**, **NOT REQUIRED**,
**RECOMMENDED**, **REQUIRED**, **SHOULD**, and **SHOULD NOT** in this
specification are to be interpreted as described in BCP 14 [[spec:RFC2119]]
[[spec:RFC8174]] when, and only when, they appear in all capitals, as shown
here.

### The VH-Log File

The [[ref: log]] contains a list of [[ref: log entries]], one for each version
of the [[ref: state]] object. A new [[ref: log entry]] is added each time the
[[ref: state]] object is updated or the [[ref: parameters]] that control the
generation and verification of the log change.

Each entry is a JSON object consisting of the following properties.

`{ "versionId": "", "versionTime": "", "parameters": {}, "state": {}, "proof": [] }`

1. The value of `versionId` **MUST** be a string consisting of the version number
   (starting at `1` and incrementing by one per version), a literal dash `-`,
   and the [[ref: entry hash]], a hash calculated across the [[ref: log entry]] content.
   The input to the hash is chosen so as to link each entry to its predecessor
   in a ledger-like chain. The input to the hash is specified in the
   [Entry Hash Generation and Verification](#entry-hash-generation-and-verification)
   section of this specification.
2. The value of `versionTime` **MUST** be a timestamp in UTC of the entry in
   [[ref: ISO8601]] format, as asserted by the [[ref: Log Controller]]. The
   timestamp **MUST** be the time the entry will be retrieved by a [[ref:
   witness]] or [[ref: Resolver]], or before. The timestamp **MUST** be
   expressed in whole seconds, with no fractional seconds (for example,
   `2025-04-01T17:39:50Z`). Because each entry's `versionTime` must be later
   than the previous entry's, consecutive entries are at least one second
   apart.
3. The JSON object `parameters` contains the configurations set by the [[ref:
   Log Controller]] to be used in the processing of current and future [[ref:
   log entries]]. Permitted `parameters` are defined in the
   [VH-Log Parameters](#vh-log-parameters) section of this specification.
4. The JSON object `state` contains the [[ref: state]] object for this version
   of the log. The type and schema of the [[ref: state]] object is defined by
   the [[ref: specialisation]].
5. The JSON array `proof` contains a [[ref: Data Integrity]] proof created for
   the entry and signed by a key authorized to update the log.

::: issue Minimum time between entries

Requiring whole-second `versionTime` values limits a log to at most one entry
per second. Some [[ref: specialisations]] may need entries more often than
that, and others may want a longer minimum interval. Should the minimum
interval between entries, and therefore the `versionTime` precision, be
defined by the [[ref: specialisation]], with one second as the default?

:::

After creation, each entry has (per the [[ref: JSON Lines]] specification) all
extra whitespace removed, a `\n` character appended, and the result added to the
log file for publication.

The default name of the log file is `vh-log.jsonl`. A [[ref: specialisation]]
**MAY** define a different resource name. The location of the log file is defined
by the [[ref: specialisation]]. The location is used only to find the log; it
plays no part in verifying control of the log, which depends only on the
[[ref: SCID]], the hash chain and the proofs. A [[ref: specialisation]]
**SHOULD** document any assumptions it makes about log location that could
affect the uniqueness or verifiability of a log.

Log files and witness files **MUST** be published and retrieved as described
in [Publishing and Retrieving Log Resources](#publishing-and-retrieving-log-resources)
whenever they are transferred over a network.

::: example

**Examples of log entries that fail verification.** Illustrative and
non-exhaustive; the normative rejection criteria are defined in the verification
algorithm in this specification.

1. **Duplicate witness IDs.** `{"threshold": 1, "witnesses": [{"id": "W"},
   {"id": "W"}]}` — the same witness identifier appears more than once; each
   witness must be unique.

2. **Pre-rotation active but `updateKeys` omitted.** If entry N-1 commits
   `nextKeyHashes: ["H1","H2"]`, then entry N must contain an explicit
   `updateKeys` whose every member hashes to a value in `["H1","H2"]`. An
   entry N omitting `updateKeys` (intending to inherit) is invalid.

3. **Wrong cryptosuite on log-entry proof.** Rejected even if the signature is
   structurally valid, because the active [[ref: logVersion]] defines the permitted
   cryptosuite. Verifying only `proofPurpose` is **insufficient**.

4. **Unknown [[ref: logVersion]] value.** An unrecognised value **MUST** be rejected
   and **MUST NOT** be silently downgraded.

:::

#### Authoritative Sources

A [[ref: specialisation]] **MAY** define an authoritative source for a log,
such as a blockchain, that determines which entries form the log when
competing entries with the same predecessor exist. A specialisation that does
so **MUST** define:

- How the log is assembled from the authoritative source. A source can record
  more than one entry with the same predecessor, so the specialisation's rules
  decide which recorded entries are accepted; only accepted entries form the
  log.
- Which entries the authoritative source governs. These can include entries
  published before the log was first recorded in the source.
- How a [[ref: Resolver]] handles a change in what the source records, such as
  a blockchain reorganisation.

The specialisation **MUST** also designate its own version parameter, as
described for [[ref: logVersion]] in [VH-Log Parameters](#vh-log-parameters),
and the value in the log's first entry **MUST** identify a version of the
specialisation that defines the authoritative source. A [[ref: Resolver]] that
does not implement the specialisation then rejects the log, rather than
resolving it as though no authoritative source were defined.

For entries governed by an authoritative source:

- The log consists of the entries assembled from the authoritative source,
  which is the reference copy described in
  [Comparing Copies of a Log](#comparing-copies-of-a-log). Every other
  verification step in this specification, including the ordering of
  `versionTime`, applies to the assembled log.
- A copy of the log that diverges from the assembled log is discarded and does
  not cause resolution to fail. The [[ref: Resolver]] **SHOULD** report it
  with the `superseded` status and the `copy-superseded` warning described in
  [Resolution Result](#resolution-result).
- A `versionId` retained from a previous resolution that is not in the
  assembled log does not cause resolution to fail. The [[ref: Resolver]]
  **SHOULD** report it with the `authoritative-source-changed` warning.
- If the [[ref: Resolver]] cannot establish which entries the authoritative
  source includes, for example because the source is unreachable or
  incomplete, it **MUST** fail resolution. A copy of the log is not a
  substitute for the source.
- The requirements in [Update](#update) that a [[ref: Log Controller]] retain
  every published entry and not publish two entries with the same predecessor
  do not apply to entries the assembled log does not include.
- An entry that deactivates the log takes effect only once it is in the
  assembled log.

The rules for [[ref: witnesses]] are unchanged: a witness **MUST NOT** approve
more than one entry with the same predecessor, even where an authoritative
source would settle between them.

An authoritative source settles competing entries, so a fork no longer makes
the log unresolvable. The trade-off is that the authority of those entries
then depends on the authoritative source as well as on the proofs: the first
entry signed by an authorized key that the specialisation's rules accept from
the source determines the log. Someone holding a compromised key can take
control of the log by getting an entry accepted first. A log with an
authoritative source **SHOULD** use [[ref: pre-rotation]], so that the active
keys alone cannot sign an entry that would be accepted.

### Log Operations

#### Create

Creating a [[ref: log]] is done by carrying out the following steps.

1. **Determine the log identifier**
   The log identifier format is defined by the [[ref: specialisation]]. The
   identifier **MUST** incorporate the [[ref: SCID]] once it is calculated.
   Where the [[ref: SCID]] appears in the identifier or in the [[ref: state]]
   object, the placeholder string `"{SCID}"` **MUST** be used during the
   creation process until the [[ref: SCID]] is calculated and inserted.

2. **Generate the authorization key pair(s)**
   [Authorized keys](#authorized-keys) are authorized to control (create, update,
   deactivate) the log.

   1. If the log is to use [[ref: pre-rotation]], additional key generation will
      be necessary to generate the "next" authorization keys and their
      corresponding [[ref: pre-rotation]] hashes.
   2. For each authorization key pair, generate a [[ref: multikey]] based on the
      public key. The [[ref: multikey]] representations are placed in the
      `updateKeys` property in [[ref: parameters]].

3. **Create the initial [[ref: state]] object**
   The initial [[ref: state]] object is as defined by the [[ref: specialisation]].
   Where the [[ref: SCID]] is to appear in the [[ref: state]] object, the
   placeholder string `"{SCID}"` **MUST** be used.

4. **Generate a preliminary log entry** JSON object containing the same JSON
   properties that will be in the published [[ref: log entry]], but with some
   values preset, pending calculation of the [[ref: SCID]] and [[ref:
   entry hash]], and without the `proof`.

   1. The value of `versionId` **MUST** be the placeholder literal `"{SCID}"`.
   2. The value of `versionTime` **MUST** be a valid UTC [[ref: ISO8601]]
      date/time string in whole seconds, and the represented time **MUST** be
      before or equal to the current time.
   3. The value of the `parameters` property **MUST** be a JSON object as
      defined in the [VH-Log Parameters](#vh-log-parameters) section. All
      required values in the first entry **MUST** be present. Where the [[ref:
      SCID]] is referenced in the parameters, the placeholder literal string
      `{SCID}` **MUST** be used.
   4. The value of the `state` property **MUST** be the initial [[ref: state]]
      object from the previous step.

5. **Update the preliminary log entry to the initial log entry**

   1. **Calculate the [[ref: SCID]]**
      The preliminary JSON object **MUST** be used to calculate the [[ref: SCID]]
      as defined in the
      [SCID Generation and Verification](#scid-generation-and-verification)
      section of this specification.
   2. **Replace the placeholder `{SCID}`** Treating the preliminary JSON object
      as a string, perform a literal text replacement of every occurrence of
      the placeholder `{SCID}` with the calculated [[ref: SCID]].
      - NOTE: The literal string `{SCID}` cannot appear as a value anywhere in
        the first published [[ref: log entry]] — it will always be replaced.
   3. **Calculate the [[ref: Entry Hash]]**
      The updated preliminary JSON object **MUST** be used to calculate the
      [[ref: entry hash]] as defined in the
      [Entry Hash Generation and Verification](#entry-hash-generation-and-verification)
      section of this specification.
   4. **Replace the preliminary `versionId` value** The value of the `versionId`
      property **MUST** be updated with the literal string `1` (for version
      number 1), a literal `-`, followed by the [[ref: entry hash]].
   5. **Generate the [[ref: Data Integrity]] proof** A [[ref: Data Integrity]]
      proof **MUST** be generated over the updated preliminary JSON object using
      an authorized key in the `updateKeys` property in [[ref: parameters]] and
      the `proofPurpose` set to `assertionMethod`.
   6. **Add the [[ref: Data Integrity]] proof** The proof is added to the JSON
      object. The resultant JSON object is the initial [[ref: log entry]].

6. **Generate the first [[ref: JSON Line]]**
   The [[ref: log entry]] **MUST** be serialised as a [[ref: JSON Lines]] entry
   by removing extraneous white space and appending a newline character. The
   result is stored as the initial contents of the log file.

   If the [[ref: Log Controller]] has opted to use [[ref: witnesses]], the
   required proofs **MUST** be collected and published in the witness file before
   the log file is published. See the [Witnesses](#witnesses) section.

7. **Publish the log**
   The log file **MUST** be published at the location defined by the [[ref:
   specialisation]].

   If there are [[ref: watchers]] configured, a webhook is triggered to notify
   the [[ref: watchers]] that a new log is available. See the
   [Watchers](#watchers) section.

#### Read (Resolve)

The following steps **MUST** be executed to resolve the [[ref: state]] object
for a given log:

1. Retrieve the log file from the location defined by the [[ref: specialisation]],
   as described in [Retrieving Log Resources](#retrieving-log-resources).
2. The log file **MUST** be processed as described below.

A [[ref: Resolver]] **MAY** use a [[ref: watcher]] in addition to, or in place
of, retrieving the log from the source. See the [Watchers](#watchers) section.
A [[ref: Resolver]] that retrieves more than one copy of a log, or that has
retained a `versionId` from an earlier resolution of the log, **MUST** process
them as described in [Comparing Copies of a Log](#comparing-copies-of-a-log).

To process the retrieved log file, the [[ref: Resolver]] **MUST** carry out the
following steps on each [[ref: log entry]] in the order it appears in the file.
Every step **MUST** be performed for **every** entry; in particular,
[[ref: Data Integrity]] proof verification (step 2) and [[ref: entry hash]] verification (step 3)
**MUST NOT** be skipped for intermediate entries on the grounds that the
[[ref: Resolver]] only needs the latest [[ref: state]] object.

::: note Basic Note

NOTE: A [[ref: Resolver]] implementation that caches previously verified state
could retrieve only subsequent entries and resume processing after the last
verified entry rather than reprocessing the full log, provided the cached state
was itself produced by full verification and the cache has not been modified
since.

Even without caching state, a [[ref: Resolver]] can retain the latest
`versionId` it observes for each log it resolves. Comparing a later copy of the
log against that `versionId`, as described in
[Comparing Copies of a Log](#comparing-copies-of-a-log), reveals a fork,
truncation or rollback that has happened since the previous resolution.

:::

For each entry:

1. Update the currently active [[ref: parameters]] with the [[ref: parameters]]
   from the entry (if any). The `parameters` **MUST** adhere to the
   [VH-Log Parameters](#vh-log-parameters) section. Continue processing using
   the now active set of [[ref: parameters]].
   - All [[ref: parameters]] in the first [[ref: log entry]] take effect
     immediately. A change in a later entry may take effect only from the next
     entry, as set out in the **Activation** rule in
     [General Rules for Parameters](#general-rules-for-parameters).
2. The [[ref: Data Integrity]] proof in the entry **MUST** be valid and signed by
   an authorized key as defined in the [Authorized Keys](#authorized-keys)
   section, and with a `proofPurpose` set to `assertionMethod`.
   1. If the [[ref: Log Controller]] has opted to use [[ref: witnesses]],
      [[ref: Resolvers]] **MUST** retrieve and verify the witness file. For
      details, see the [Witnesses](#witnesses) section.
3. Verify the `versionId` for the entry.
   1. The version number **MUST** be `1` for the first entry and **MUST** equal
      the previous entry's version number + 1 for each subsequent entry. Gaps
      **MUST** terminate resolution.
   2. Exactly one dash `-` **MUST** follow the version number; missing or
      multiple dashes **MUST** cause rejection.
   3. The [[ref: entry hash]] **MUST** follow the dash, **MUST** be a valid [[ref:
      multihash]] in the algorithm permitted by the active [[ref: logVersion]], and
      **MUST** be verified per
      [Entry Hash Generation and Verification](#entry-hash-generation-and-verification).
      Verification **MUST** be performed for every entry.
4. The `versionTime` **MUST** be a valid UTC [[ref: ISO8601]] string with
   explicit `Z` (or `+00:00`); values without a zone designator, or expressing
   a non-UTC zone, **MUST** be rejected.
   - The `versionTime` **MUST** be in whole seconds. Values with fractional
     seconds **MUST** be rejected.
   - The `versionTime` of **every** entry **MUST** be strictly greater than the
     immediately preceding entry's. Equal timestamps **MUST** be rejected.
   - The `versionTime` of every entry **MUST NOT** be more than a small,
     implementation-defined tolerance in the future relative to the [[ref:
     Resolver]]'s current time. [[ref: Resolvers]] **SHOULD** use a tolerance of
     no more than 5 minutes. Entries that exceed this tolerance **MUST** cause
     resolution to fail.
5. When processing the first [[ref: log entry]], verify the [[ref: SCID]]
   according to the
   [SCID Generation and Verification](#scid-generation-and-verification)
   section of this specification.
6. Get the value of the [[ref: log entry]] property `state`, which is the
   [[ref: state]] object for this version. The [[ref: specialisation]] **MAY**
   define additional verification steps for the [[ref: state]] object.
7. If [[ref: Key Pre-Rotation]] is active (the previously active `nextKeyHashes`
   is non-empty), the entry being processed **MUST** include an explicit
   `parameters.updateKeys` and **MUST NOT** rely on inheritance. The hash of
   **every** [[ref: multikey]] in `parameters.updateKeys` (computed per
   [Pre-Rotation Key Hash Generation and Verification](#pre-rotation-key-hash-generation-and-verification))
   **MUST** appear in the previous entry's `nextKeyHashes`. A key not in the
   previous entry's `nextKeyHashes` **MUST** cause resolution to terminate.
8. As each [[ref: log entry]] is processed and verified, collect the following
   information about each version:
   1. The [[ref: state]] object.
   2. The `versionId` of the [[ref: log entry]].
   3. The UTC `versionTime` of the [[ref: log entry]].
   4. The latest list of active [[ref: multikey]] formatted public keys
      authorized to update the log, from the `updateKeys` lists in [[ref:
      parameters]].
   5. If [[ref: pre-rotation]] is being used, the hashes of authorized keys that
      must be used in the `updateKeys` list of the next [[ref: log entry]].
   6. All other VH-Log processing configuration settings as defined in the
      `parameters` object.
9. If the `parameters` for any of the versions define that some or all [[ref:
   log entries]] must be [[ref: witnessed]], further verification of the [[ref:
   witness]] proofs must be carried out, as defined in the
   [Witnesses](#witnesses) section.

10. Flag failed verifications appropriately, either invalidating the entire log
    or marking all entries from the first invalid entry to the end of the log
    as invalid.

11. Respond to the resolution request:
    1. If all verifications pass, return the resolved [[ref: state]] object.
    2. If the request specifies a target version (by `versionId`, `versionTime`
       or version number, as defined in [Selecting a
       Version](#selecting-a-version)), return the [[ref: state]] object from
       the [[ref: log entry]] that was active at that version or time — even if
       later entries are invalid.
    3. If the log or requested version is invalid, return an appropriate error.

[[ref: Resolvers]] **SHOULD NOT** cache a log that fails verification.

##### Comparing Copies of a Log

A [[ref: Resolver]] that retrieves more than one copy of a log (for example,
from the source and from one or more [[ref: watchers]], as requested by the
[resolution options](#resolution-options)), or that has retained a
`versionId` from a previous resolution of the log, need not verify every copy
in full. Instead, it **MUST**:

1. Choose any one copy and fully verify it. If it fails verification, discard
   it and choose another. The verified copy is the reference copy.
2. Compare each remaining copy to the reference copy by checking a single
   `versionId` in each:
   - **If the copy has the same number of entries or fewer:** compare the
     `versionId` of the copy's last entry with the reference copy's
     `versionId` for the same version number. If they match, the copy is the
     same log, possibly out of date, and needs no further verification.
   - **If the copy has more entries:** compare the `versionId` of the
     reference copy's last entry with the copy's `versionId` for the same
     version number. If they match, the copy extends the reference copy.
     Verify only the copy's additional entries, starting from the state
     reached at the reference copy's last entry. If they pass verification,
     the copy becomes the reference copy. If they fail, discard the copy.
   - **If the `versionId` values do not match:** the copy diverges from the
     reference copy. Verify it in full. If it fails verification, discard it.
     If it passes verification, the log has been forked, and the
     [[ref: Resolver]] **MUST** fail resolution as described below.
3. If the [[ref: Resolver]] has retained a `versionId` from a previous
   resolution of the log, compare it with the reference copy's `versionId` for
   the same version number. The retained `versionId` was verified when it was
   first observed, so it needs no further verification.
   - **If the reference copy has fewer entries than the retained version
     number:** there is no entry to compare. Every copy is older than the log
     previously observed, so the log has been truncated or rolled back, or
     diverges at an entry the [[ref: Resolver]] cannot compare. The
     [[ref: Resolver]] **SHOULD** either fail resolution or report the
     `retained-version-not-found` warning described in
     [Resolution Result](#resolution-result).
   - **If they match:** the reference copy is the log previously observed, or
     an extension of it.
   - **If they do not match:** the log has been forked, and the
     [[ref: Resolver]] **MUST** fail resolution as described below. In place
     of the first differing entry, the report **MUST** include the retained
     `versionId` and the reference copy's `versionId` for the same version
     number.

A copy already found to match the reference copy still matches when a longer
copy replaces it, because the longer copy extends the earlier reference copy;
earlier comparisons need not be repeated. When every copy and any retained
`versionId` have been compared, the [[ref: Resolver]] resolves from the
reference copy.

If two or more copies of a log pass verification but diverge, the log has
been forked by a party holding authorized keys, and no copy can be relied on.
The [[ref: Resolver]] **MUST** fail resolution, including for a requested
version that precedes the point of divergence, and **MUST** report the fork.
The report **MUST** identify each diverging copy (for example, by the location
it was retrieved from) and **MUST** include the version number of the first
[[ref: log entry]] at which the copies differ and each copy's `versionId` for
that entry. How the error is returned is defined by the
[[ref: specialisation]].

This does not apply where the copies, or a retained `versionId` and the
reference copy, diverge at an entry governed by an authoritative source. The
rules in [Authoritative Sources](#authoritative-sources) apply instead.

These checks rely on two properties of the log. Each [[ref: entry hash]]
covers the previous entry's `versionId`, so equal `versionId` values at entry
`k` mean the two copies commit to the same history up to and including entry
`k`. And because a `versionId` begins with its version number, entry `k` is
always on line `k` of the log file, so each comparison reads a single known
line of each copy rather than searching for the `versionId`.

##### Resolution Options

A request to resolve a log **MAY** include the following resolution options.
How a client of the [[ref: Resolver]] specifies them (for example, as query
parameters in an identifier URL, or as options passed to a resolution
function) is defined by the [[ref: specialisation]]. A [[ref: Resolver]] given
an option it does not support **MUST** fail resolution rather than ignore the
option.

- `versionId`, `versionTime`, `versionNumber` — Select a target version, as
  defined in [Selecting a Version](#selecting-a-version). At most one of these
  **MAY** be given.
- `checkWatchers` — A non-negative integer, or the string `all`. The number of
  the log's listed [[ref: watchers]] from which the [[ref: Resolver]]
  **MUST** retrieve a copy of the log. Defaults to `0`.
- `extraWatchers` — A list of [[ref: watcher]] URLs, which need not be listed
  in the log, from each of which the [[ref: Resolver]] **MUST** retrieve a copy
  of the log. Defaults to an empty list.
- `minCopies` — A positive integer. The minimum number of retrieved copies of
  the log that **MUST** match for resolution to succeed. Defaults to `1`.

The `checkWatchers`, `extraWatchers` and `minCopies` options let a caller
check the log against other copies, to detect a copy that is out of date, has
been tampered with, or has been forked. They apply as follows:

1. The [[ref: Resolver]] retrieves the log from the location defined by the
   [[ref: specialisation]], and fully verifies it as described in
   [Read (Resolve)](#read-resolve).
2. If `checkWatchers` is greater than `0`, the [[ref: Resolver]] reads the
   `watchers` [[ref: parameter]] active at the last entry of the verified copy.
   If `checkWatchers` is `all`, or is not less than the number of listed
   [[ref: watchers]], the [[ref: Resolver]] **MUST** retrieve a copy from every
   listed [[ref: watcher]]. Otherwise, it **MUST** retrieve a copy from that
   many listed [[ref: watchers]], and **SHOULD** choose them at random, so that
   which [[ref: watchers]] are checked cannot be predicted.
3. The [[ref: Resolver]] **MUST** retrieve a copy from each [[ref: watcher]] in
   `extraWatchers`.
4. Copies (including from `extraWatchers`) are retrieved from a
   [[ref: watcher]] using the
   [Watcher HTTP API Operations](#watcher-http-api-operations) and the
   [[ref: SCID]] of the log: the log file from `<WATCHER URL>/log?scid=<SCID>`
   and, if [[ref: witnesses]] are active, the witness file from
   `<WATCHER URL>/witness?scid=<SCID>`. All retrievals **MUST** follow
   [Retrieving Log Resources](#retrieving-log-resources).
5. All retrieved copies are processed as described in
   [Comparing Copies of a Log](#comparing-copies-of-a-log), and each is
   reported in `copies` in the [Resolution Result](#resolution-result).
6. If fewer than `minCopies` copies have a `status` of `current` or `behind`,
   the [[ref: Resolver]] **MUST** fail resolution, with an error defined by the
   [[ref: specialisation]]. The copy retrieved in step 1 counts towards
   `minCopies`.

A copy that cannot be retrieved, because the [[ref: watcher]] is unreachable,
does not hold the log, or returns an error, does not by itself fail
resolution. It is reported with `status` `unavailable` and a
`copy-unavailable` warning, and does not count towards `minCopies`.

`extraWatchers` causes the [[ref: Resolver]] to fetch from URLs supplied by its
caller. A [[ref: Resolver]] offered as a service to other parties **MAY**
refuse, or limit the number of, `extraWatchers` URLs. A URL that is not
retrieved for this reason **MUST** be reported with `status` `unavailable` and
a `copy-unavailable` warning stating that it was refused.

These options apply even when a target version is selected, because a forked
log fails resolution for every version, as described in
[Comparing Copies of a Log](#comparing-copies-of-a-log).

::: note
[[ref: Watchers]] listed in the log are chosen by the [[ref: Log Controller]].
Checking them detects a source that is out of date or has been altered, but
may not detect a [[ref: Log Controller]] that deliberately gives different
parties different logs, since such a [[ref: Log Controller]] could list
[[ref: watchers]] it controls. `extraWatchers` lets a caller use
[[ref: watchers]] it chooses itself, such as its own or those run by its
ecosystem, which is a stronger check.
:::

##### Selecting a Version

A request to resolve a log **MAY** specify a target version using one of the
`versionId`, `versionTime` or `versionNumber`
[resolution options](#resolution-options). A [[ref: Resolver]] **MUST**
support selecting by `versionId` and by `versionTime`, and **SHOULD** support
selecting by `versionNumber`. A request **MUST NOT** specify more than one.

- **By `versionId`:** the [[ref: log entry]] whose `versionId` is exactly
  equal to the given value.
- **By `versionTime`:** the [[ref: log entry]] that was active at the given
  [[ref: ISO8601]] time — the entry with the latest `versionTime` that is not
  later than the given time.
- **By `versionNumber`:** the [[ref: log entry]] whose version number — the
  integer that precedes the `-` in its `versionId` — equals the given positive
  integer.

If no [[ref: log entry]] matches, the [[ref: Resolver]] **MUST** return a
not-found error, as defined by the [[ref: specialisation]].

::: note
Selecting by version number is less safe than selecting by `versionId`. A
`versionId` includes the [[ref: entry hash]], so it identifies the content of
exactly one [[ref: log entry]]. A version number identifies an entry only
within the copy of the log being resolved: if two diverging copies of a log
exist, the same version number can select different [[ref: state]] objects in
each. Where a reference must identify exactly one version — for example, to
record which version of the [[ref: state]] object was relied on — `versionId`
is the safer choice.
:::

##### Resolution Result

After successful resolution, the following information is available to the caller:

- `versionId` — The `versionId` from the resolved [[ref: log entry]].
- `versionTime` — The `versionTime` from the resolved [[ref: log entry]].
- `created` — The [[ref: ISO8601]] timestamp of the log's first [[ref: log entry]].
- `updated` — The [[ref: ISO8601]] timestamp of the log's last valid [[ref: log entry]].
- `scid` — The [[ref: SCID]] of the log.
- `deactivated` — `true` if the log has been deactivated, as defined in
  [Deactivate](#deactivate), even when an earlier version was resolved;
  otherwise `false`.
- `ttl` — The suggested cache duration from the `ttl` [[ref: parameter]], in seconds.
- `witness` — The current witness configuration object, if witnesses are active.
- `watchers` — The current list of [[ref: watcher]] URLs.
- `copies` — If the [[ref: Resolver]] retrieved, or attempted to retrieve,
  more than one copy of the log, a list with one item for each copy, as
  described below.
- `warnings` — A list of conditions found during resolution that did not
  prevent it, as described below. Empty if there are none.

The "last valid [[ref: log entry]]" above refers to the case where resolution
references a version that was valid but where later [[ref: log entries]] fail
verification. If all entries pass verification, the last valid entry is the last
entry in the log.

A [[ref: Resolver]] that retrieved, or attempted to retrieve, more than one
copy of the log, as described in
[Comparing Copies of a Log](#comparing-copies-of-a-log) and
[Resolution Options](#resolution-options), **SHOULD** include `copies`. A
[[ref: Resolver]] that was given `checkWatchers`, `extraWatchers` or a
`minCopies` greater than `1` **MUST** include `copies`. Each item describes one
copy:

- `source` — Where the copy was retrieved from, such as the location of the
  log file or the URL of the [[ref: watcher]] that served it.
- `versionId` — The `versionId` of the copy's last [[ref: log entry]]. Absent
  if `status` is `unavailable`.
- `status` — One of:
  - `current` — The copy's last [[ref: log entry]] is the last entry of the
    reference copy.
  - `behind` — The copy matches the reference copy but has fewer entries.
  - `invalid` — The copy failed verification and was discarded.
  - `superseded` — The copy diverges from the log assembled from an
    authoritative source and was discarded, as described in
    [Authoritative Sources](#authoritative-sources).
  - `unavailable` — The copy could not be retrieved, or the
    [[ref: Resolver]] declined to retrieve it, as described in
    [Resolution Options](#resolution-options).

A [[ref: Resolver]] **SHOULD** include an item in `warnings` for each of the
following conditions. Each item has a `code` from the list below and a
human-readable `message`, and identifies the copy it concerns by its `source`,
where there is one.

- `copy-behind` — A copy has `status` `behind`. The message includes how many
  entries the copy is behind the reference copy.
- `copy-invalid` — A copy has `status` `invalid`. The message includes the
  version number of the first [[ref: log entry]] that failed verification.
- `copy-unavailable` — A copy has `status` `unavailable`. The message says
  why, such as the [[ref: watcher]] being unreachable, not holding the log,
  or the [[ref: Resolver]] refusing the URL.
- `invalid-entries` — Some [[ref: log entries]] at the end of the reference
  copy failed verification, so resolution used the last valid entry.
- `retained-version-not-found` — The reference copy has fewer entries than a
  `versionId` retained from a previous resolution of the log, as described in
  [Comparing Copies of a Log](#comparing-copies-of-a-log).
- `copy-superseded` — A copy has `status` `superseded`. The message includes
  the version number of the first [[ref: log entry]] at which the copy
  diverges from the assembled log.
- `authoritative-source-changed` — A `versionId` retained from a previous
  resolution of the log is not in the log assembled from an authoritative
  source, as described in [Authoritative Sources](#authoritative-sources).

A [[ref: specialisation]] **MAY** define additional warning codes. How
`copies` and `warnings` are represented in the [[ref: specialisation]]'s
result format is defined by the [[ref: specialisation]].

#### Update

To update a log, a new, verifiable [[ref: log entry]] must be generated, [[ref:
witnessed]] (if necessary), appended to the existing log file, and published:

1. Make the desired changes to the [[ref: state]] object.
2. Define the [[ref: parameters]] JSON object to include any properties that
   affect the evolution of the log. Any [[ref: parameters]] defined override the
   previously active value; any not included imply the existing values remain in
   effect. If no changes to [[ref: parameters]] are needed, an empty JSON object
   `{}` **MUST** be used.
   - All [[ref: parameters]] in the first [[ref: log entry]] take effect
     immediately. A change in a later entry may take effect only from the next
     entry, as set out in the **Activation** rule in
     [General Rules for Parameters](#general-rules-for-parameters).
3. Generate a preliminary [[ref: log entry]] JSON object:
   1. The value of `versionId` **MUST** be the value of `versionId` from the
      *previous* [[ref: log entry]].
   2. The `versionTime` **MUST** be a [[ref: ISO8601]] format UTC timestamp
      in whole seconds, strictly greater than the previous entry's
      `versionTime`, and **MUST** be
      the time the entry will be retrieved by a [[ref: witness]] or [[ref:
      Resolver]], or before.
   3. The [[ref: parameters]] as a JSON object.
   4. The `state` JSON object set to the new version of the [[ref: state]] object.
4. Calculate the new `versionId`, including incrementing the version number and
   using the process in
   [Entry Hash Generation and Verification](#entry-hash-generation-and-verification).
5. Replace the `versionId` property with the value from the previous step.
6. Generate a [[ref: Data Integrity]] proof using an authorized key as defined
   in [Authorized Keys](#authorized-keys), with `proofPurpose` set to
   `assertionMethod`.
7. If [[ref: Key Pre-Rotation]] is being used, the hash of all `updateKeys`
   entries **MUST** match a hash in `nextKeyHashes` from the previous [[ref: log entry]],
   as defined in
   [Pre-Rotation Key Hash Generation and Verification](#pre-rotation-key-hash-generation-and-verification).
8. Add the proof JSON object as the value of the `proof` property.
9. Serialise the entry as a [[ref: JSON Line]] by removing extra whitespace and
   appending a `\n`.
10. If [[ref: witnesses]] are active, collect the [[ref: threshold]] of proofs,
    update and publish the witness file **BEFORE** publishing the updated log
    file. See the [Witnesses](#witnesses) section.
11. Append the new [[ref: log entry]] to the existing log file.
12. Publish the updated log file at the location defined by the [[ref:
    specialisation]]. If there are [[ref: watchers]] configured, trigger webhooks
    to notify them. See the [Watchers](#watchers) section.

A [[ref: Log Controller]] **MUST** only publish a log that extends the log it
most recently published: every published [[ref: log entry]] is retained, and
the new [[ref: log entry]]'s predecessor is the last published [[ref: log
entry]]. A [[ref: Log Controller]] **MUST NOT** publish, or give to any party,
two different [[ref: log entries]] with the same predecessor.
[Authoritative Sources](#authoritative-sources) describes exceptions to both
requirements.

#### Deactivate

Deactivating a log permanently closes it. The [[ref: Log Controller]] signals
that the log will not be updated again, and no further [[ref: log entries]] are
valid.

To deactivate a log, the [[ref: Log Controller]] **MUST** publish a
[[ref: log entry]] whose [[ref: parameters]] include `"deactivated": true`.
That entry is the last [[ref: log entry]] in the log. Once it has been
published:

- A [[ref: Resolver]] **MUST** treat any [[ref: log entry]] after the
  deactivating entry as failing verification.
- A [[ref: Resolver]] **MUST** report the log as deactivated, by setting
  `deactivated` to `true` in the [Resolution Result](#resolution-result). This
  applies when resolving any version of the log, including versions before the
  deactivating entry.
- Whether a [[ref: Resolver]] returns the [[ref: state]] object of the
  deactivating entry, or of the version requested, is defined by the
  [[ref: specialisation]], as is how deactivation is presented in the
  [[ref: specialisation]]'s result format.

Because no entry can follow the deactivating entry, there is no need to also
remove the authorized keys when deactivating.

A [[ref: Log Controller]] can instead stop further updates without deactivating
the log, by setting `updateKeys` to `[]`. The log is not reported as
deactivated, and the final [[ref: state]] object continues to be returned, but
no further entry can be signed. If [[ref: pre-rotation]] is active, this takes
two [[ref: log entries]]: the first to stop pre-rotation by setting
`nextKeyHashes` to `[]`, and the second to set `updateKeys` to `[]`.

A [[ref: Log Controller]] can also remove the published log file. [[ref: Watchers]]
monitoring a removed log **SHOULD** continue to cache the last known valid state
indefinitely.

### VH-Log Parameters

All [[ref: log entries]] contain the JSON object `parameters`. This object
defines the VH-Log processing [[ref: parameters]] used by the [[ref: Log Controller]]
when publishing the current and subsequent [[ref: log entries]].
[[ref: Resolvers]] **MUST** use the same [[ref: parameters]] to process the log.

The `parameters` object **MUST** only include properties defined in the active
version of the VH-Log specification, or properties defined by the active
[[ref: specialisation]].

#### General Rules for Parameters

- **Default Values**: When the [[ref: logVersion]] parameter sets the version of this
  specification, any parameter introduced by that version but not explicitly set
  in the same [[ref: log entry]] **MUST** assume the default value defined in
  this section.

- **Accumulation**: Parameters accumulate across entries. An entry that omits a
  parameter inherits the previously active value, unless the parameter's
  definition requires it to be explicitly set.

- **Activation**: All parameters in the first [[ref: log entry]] take effect
  immediately. For a parameter changed in a later entry, the parameter's
  definition below, and the section it references, states whether the change
  applies to the entry that makes it or only from the next entry. For example,
  a `witness` parameter that replaces an active witness list takes effect only
  after the entry has been published, so that entry is witnessed under the
  previous list (see [Witness Lists](#witness-lists)).

- **Allowed Values**: Each parameter is constrained by the data type, structure,
  and allowed values specified in this section. A non-conformant value **MUST**
  cause [[ref: Resolvers]] to reject the [[ref: log entry]].

- **Deactivation**: Parameters that support deactivation (such as `witness` or
  `nextKeyHashes`) are set to defined values, described below, to indicate they
  are no longer active.

- The JSON `null` value **MUST NOT** be used to indicate default or deactivated
  values, as it removes the typing information required for proper interpretation.

#### Specialisation-defined Parameters

A [[ref: specialisation]] **MAY** define additional parameters beyond those
listed in this section. Specialisation-defined parameter names **MUST NOT**
conflict with VH-Log parameter names. A VH-Log [[ref: Resolver]] that does not
implement a particular [[ref: specialisation]] **MUST** ignore unrecognised
parameters rather than failing.

::: example
An example of the `parameters` property in the first [[ref: log entry]]:

```json
{
  "logVersion": "vh-log:1.0",
  "scid": "{SCID}",
  "updateKeys": [
    "z82LkqR25TU88tztBEiFydNf4fUPn8oWBANckcmuqgonz9TAbK9a7WGQ5dm7jyqyRMpaRAe"
  ],
  "nextKeyHashes": [
    "enkkrohe5ccxyc7zghic6qux5inyzthg2tqka4b57kvtorysc3aa"
  ]
}
```

:::

The following lists the [[ref: parameters]], their data types, and enumerated values.

- `logVersion`: The version parameter. Specifies the version of the
  specification to be used for processing the log. Each value defines the
  cryptographic algorithms permitted for the current and subsequent
  [[ref: log entries]]. A [[ref: specialisation]] **MAY** designate a parameter
  of its own, with its own values, as the version parameter in place of
  `logVersion`, as described below. For example, `did:webvh` uses `method`, with
  values such as `did:webvh:1.0`.
  - **MUST** appear in the first [[ref: log entry]] and **MUST** be one of the
    acceptable values enumerated below, or as defined by the
    [[ref: specialisation]] for a designated version parameter.
  - [[ref: Resolvers]] **MUST** reject any value that is not **exactly** one of
    the acceptable values for the version(s) of this specification, or of the
    [[ref: specialisation]], that the [[ref: Resolver]] supports. Unknown
    values **MUST NOT** be silently downgraded, defaulted, or ignored —
    resolution **MUST** terminate.
  - If not present in later entries, the previous value continues to be active.
  - **MAY** appear in later entries to upgrade the spec version. A change to a
    *lower* version than currently active **MUST** be rejected.
  - A specialisation's version typically covers its own rules as well as the
    log's, so each value of a designated version parameter identifies a version
    of the [[ref: specialisation]] that implies a VH-Log version. When a
    [[ref: specialisation]] designates its own version parameter:
    - Every reference to [[ref: logVersion]] in this specification, and every
      rule for it, applies to the designated parameter.
    - `logVersion` **MUST NOT** appear in the log, and [[ref: Resolvers]]
      **MUST** reject a [[ref: log entry]] that includes it.
    - The [[ref: specialisation]] **MUST** define the acceptable values of the
      designated parameter, and for each value **MUST** state the VH-Log
      version it implies and the cryptographic algorithms it permits. These
      **MUST NOT** include algorithms not permitted by the implied VH-Log
      version.
    - Moving to a later value **MUST NOT** imply a lower VH-Log version.
  - Acceptable values defined by this specification:
    - `vh-log:1.0`
      - Permitted hash algorithms: `SHA-256` [[spec:rfc6234]] (multihash code
        `0x12`) **only**. Any other algorithm **MUST** cause resolution to
        terminate.
      - Permitted [[ref: Data Integrity]] cryptosuites for both log-entry proofs
        and witness proofs: exactly `eddsa-jcs-2022` [[spec:di-eddsa-v1.0]].
        [[ref: Resolvers]] **MUST** verify the proof's `cryptosuite` property; an
        absent, mismatched, or non-conformant `cryptosuite` **MUST** cause the
        entry to be rejected. Verifying only `proofPurpose` is **insufficient**.
- `scid`: The [[ref: SCID]] value for the log.
  - **MUST** appear in the first [[ref: log entry]].
  - **MUST NOT** appear in later [[ref: log entries]].
- `updateKeys`: A JSON array of [[ref: multikey]] formatted public keys whose
  corresponding private keys are authorized to sign log entries that update the
  log. See the [Authorized Keys](#authorized-keys) section for details.
  - **MUST** appear in the first [[ref: log entry]] and **MAY** appear in
    subsequent entries.
  - If not present in later [[ref: log entries]], the previous value continues
    to apply.
  - A key from the active `updateKeys` array **MUST** be used to authorize each
    [[ref: log entry]], where active is defined as follows:
    - In the first [[ref: log entry]], the active `updateKeys` is the one defined
      in that entry.
    - In all other entries *without* [[ref: Key Pre-Rotation]] active, the active
      `updateKeys` is that of the most recent **prior** [[ref: log entry]].
    - In all other entries *with* [[ref: Key Pre-Rotation]] active, the active
      `updateKeys` is that of the **current** [[ref: log entry]].
  - `updateKeys` **SHOULD** be set to an empty array `[]` when deactivating the
    log. See the [Deactivate](#deactivate) section for details.
- `nextKeyHashes`: A JSON array of strings that are hashes of [[ref: multikey]]
  formatted public keys that **MAY** be added to the `updateKeys` list in the
  next [[ref: log entry]]. At least one entry of `nextKeyHashes` **MUST** be
  added to the next `updateKeys` list.
  - The process for generating the hashes and additional details are defined in
    [Pre-Rotation Key Hash Generation and Verification](#pre-rotation-key-hash-generation-and-verification).
  - If not set in the first [[ref: log entry]], defaults to an empty array (`[]`).
  - If not set in other entries, retained from the most recent prior value.
  - Once set to a non-empty array, [[ref: Key Pre-Rotation]] is active. While
    active, **both** `nextKeyHashes` **AND** `updateKeys` **MUST** be present as
    explicit properties in every subsequent [[ref: log entry]] until pre-rotation
    is deactivated (by setting `nextKeyHashes` to `[]`). A subsequent entry that
    omits `updateKeys` **MUST** be rejected by [[ref: Resolvers]], even if the
    omission would otherwise inherit the previous value. Inheritance of
    `updateKeys` is **never** permitted while pre-rotation is active.
  - While [[ref: Key Pre-Rotation]] is active, **every** [[ref: multikey]] in
    the current entry's `updateKeys` **MUST** have its hash in the previous
    entry's `nextKeyHashes`.
  - A [[ref: Log Controller]] **MAY** include extra hashes in `nextKeyHashes`
    that are not subsequently used. Unused hashes are ignored.
  - **MAY** be set to an empty array (`[]`) to deactivate [[ref: pre-rotation]].
- `witness`: A JSON object declaring the set of [[ref: witnesses]] and threshold
  number of witness proofs required to update the log. For details, see the
  [Witnesses](#witnesses) section.
  - Defaults to `{}` if not set in the first [[ref: log entry]].
  - If not set in other entries, retained from the most recent prior value.
  - If updated from `{}`, the change is immediately active and the corresponding
    [[ref: log entry]] **MUST** be [[ref: witnessed]].
  - **MAY** be set to `{}` to indicate witnesses are not (or no longer) being
    used. If witnesses are active when set to `{}`, that [[ref: log entry]]
    **MUST** be [[ref: witnessed]].
- `watchers`: An optional entry whose value is a JSON array containing a list of
  URLs ([[spec:rfc9110]]) identifying [[ref: watchers]] for the log. See the
  [Watchers](#watchers) section.
  - Defaults to `[]` if not set in the first [[ref: log entry]].
  - If not set in other entries, retained from the most recent prior value.
  - **MAY** be set to `[]` to indicate watchers are not (or no longer) being used.
- `deactivated`: A JSON boolean indicating whether the log has been deactivated.
  See the [Deactivate](#deactivate) section.
  - Defaults to `false` if not set in the first [[ref: log entry]].
  - If set to `true`, the log is deactivated, and the entry that sets it
    **MUST** be the last [[ref: log entry]] in the log.
- `ttl`: An unsigned integer indicating how long, in seconds, a [[ref: Resolver]]
  should cache the resolved [[ref: state]] before refreshing. Analogous to the
  `TTL` parameter in DNS [[spec:rfc2181]]. Range 0 to 2^31.
  - Defaults to `3600` (1 hour) if not set in the first [[ref: log entry]].
  - If set to `0`, the log should not be cached.

### Cryptographic Processes

The [Log Operations](#log-operations) use the following cryptographic
processes when generating and verifying [[ref: log entries]].

#### Cryptographic Agility

VH-Log is designed to support cryptographic agility — the ability to adapt to
evolving cryptographic algorithms and suites over time without breaking
compatibility or requiring global coordination.

Cryptographic agility is achieved through the following mechanisms:

- **Self-describing cryptographic formats:** All cryptographically generated data
  (e.g., hashes and signatures) use formats that encode the algorithm used.
  Hashes use the [[ref: Multihash]] format, and signatures use
  [[ref: Data Integrity]] Proofs, allowing verifiers to determine the algorithm from the data
  itself.

- **Specification versioning via the [[ref: logVersion]] parameter:** Each
  [[ref: log entry]] may include a [[ref: logVersion]] parameter specifying the
  version of the specification in use. This parameter is required in the
  initial log entry and may be updated in later entries to adopt newer
  versions.

- **Version-specific algorithm policies:** Each version of this specification
  defines the permitted cryptographic algorithms and suites, constraining what
  [[ref: Log Controllers]] may use and limiting verification requirements on
  [[ref: Resolvers]].

- **Response to cryptographic vulnerabilities:** If flaws are identified in a
  permitted algorithm, a new version of this specification will be released.
  [[ref: Log Controllers]] may then rotate to the newer version by updating the
  [[ref: logVersion]] parameter.

#### SCID Generation and Verification

The [[ref: self-certifying identifier]] (SCID) is a required [[ref: parameter]]
in the first [[ref: log entry]] and is a hash of the log's inception event.

##### Generate SCID

To generate the [[ref: SCID]] for a log, the [[ref: Log Controller]] **MUST**
execute the following function:

`base58btc(multihash(JCS(preliminary log entry with placeholders), <hash algorithm>))`

Where:

1. The `preliminary log entry with placeholders` is the pre-publication JSON
   object of what will become the first [[ref: log entry]]. The placeholder is
   the literal string "`{SCID}`".

   - The `versionId` entry, which **MUST** be `{SCID}`.
   - The `versionTime` entry, which **MUST** be a string that is the current
     time in UTC [[ref: ISO8601]] format, in whole seconds.
   - The complete `parameters` for the initial [[ref: log entry]] as defined by
     the [[ref: Log Controller]], with the placeholder wherever the [[ref: SCID]]
     will eventually be placed.
   - The `state` JSON object with the initial [[ref: state]] object, with the
     placeholder `{SCID}` wherever the [[ref: SCID]] will eventually be placed.

2. `JCS` is an implementation of the [[ref: JSON Canonicalization Scheme]]
   [[spec:rfc8785]]. It outputs a canonicalized representation of its JSON input.
3. `multihash` is an implementation of the [[ref: multihash]] specification. Its
   output is a hash of the input using the `<hash algorithm>`, prefixed with a
   hash algorithm identifier and the hash size.
4. `<hash algorithm>` is the hash algorithm used by the [[ref: Log Controller]].
   The hash algorithm **MUST** be one permitted by the active [[ref: logVersion]].
5. `base58btc` is an implementation of the [[ref: base58btc]] function. Its
   output is the base58 encoded string of its input.

##### Verify SCID

To verify the [[ref: SCID]] of a log being resolved, the [[ref: Resolver]]
**MUST** execute the following process:

1. Extract the first [[ref: log entry]] and use it for the rest of the steps.
2. Extract the `scid` property value from the [[ref: parameters]] in the first
   [[ref: log entry]].
3. Determine the hash algorithm used by the [[ref: Log Controller]] from the
   [[ref: multihash]] `scid` value. The hash algorithm **MUST** be one permitted
   by the active [[ref: logVersion]].
4. Remove the [[ref: data integrity]] proof property from the [[ref: log entry]].
5. Replace the `versionId` property value with the literal `"{SCID}"`.
6. Treat the resulting [[ref: log entry]] as a string and do a text replacement
   of the `scid` value from Step 2 with the literal string `{SCID}`.
7. Use the result and the hash algorithm (from Step 3) as input to the function
   defined in the [Generate SCID](#generate-scid) section above.
8. The output string **MUST** match the `scid` extracted in Step 2. If not,
   terminate the resolution process with an error.

#### Entry Hash Generation and Verification

The [[ref: entry hash]] follows the version number and dash character `-` in the
`versionId` property in each log entry. Each [[ref: entry hash]] is calculated across
its [[ref: log entry]], excluding the [[ref: Data Integrity]] proof. The
`versionId` used in the input to the hash is a predecessor value to the current
[[ref: log entry]], ensuring that the [[ref: entries]] are cryptographically
chained together in a microledger. For the first [[ref: log entry]], the
predecessor `versionId` is the [[ref: SCID]] (itself a hash), while for all
other entries it is the `versionId` from the previous log entry.

##### Generate Entry Hash

To generate the required hash for a [[ref: log entry]], the [[ref: Log Controller]]
**MUST** execute the process
`base58btc(multihash(JCS(entry), <hash algorithm>))` given a preliminary
[[ref: log entry]] as the string `entry`, where:

1. `JCS` is an implementation of the [[ref: JSON Canonicalization Scheme]]
   ([[spec:rfc8785]]). Its output is a canonicalized representation of its input.
2. `multihash` is an implementation of the [[ref: multihash]] specification. Its
   output is a hash of the input using the `<hash algorithm>`, prefixed with a
   hash algorithm identifier and the hash size.
3. `<hash algorithm>` is the hash algorithm used by the [[ref: Log Controller]].
   The hash algorithm **MUST** be one permitted by the active [[ref: logVersion]].
4. `base58btc` is an implementation of the [[ref: base58btc]] function. Its
   output is the base58 encoded string of its input.

The following is an example of a preliminary [[ref: log entry]] processed to
produce an [[ref: entry hash]]. As this is a first entry, the input `versionId`
is the [[ref: SCID]] of the log.

```json
{"versionId": "QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE", "versionTime": "2025-04-01T17:39:50Z", "parameters": {"witness": {"threshold": 2, "witnesses": [{"id": "witness-1"}, {"id": "witness-2"}, {"id": "witness-3"}]}, "updateKeys": ["z6MkgzBDcBFV3sk4ypPE5YXMZHmS213A3HpYY2LmcVKV15jr"], "nextKeyHashes": ["QmZreDcjvWEpyRFznQeExWNCsvMLk5i59AcRJJuQC8UodJ"], "logVersion": "vh-log:1.0", "scid": "QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE"}, "state": {"id": "example:QmdmPkUdYzbr9txmx8gM2rsHPgr5L6m3gHjJGAf4vUFoGE"}}
```

Note: the above example uses placeholder witness identifiers. A [[ref:
specialisation]] defines the required format for witness identifiers.

Resulting [[ref: entry hash]]: `QmQ6FJ4fk2xheSSQoEjVpTgx9AQPKhJgtR9hn1nr4EeCrZ`

##### Verify The Entry Hash

To verify the [[ref: entry hash]] for a given [[ref: log entry]], a [[ref: Resolver]]
**MUST** execute the following process:

1. Extract the `versionId` in the [[ref: log entry]], and remove from it the
   version number and dash prefix, leaving the [[ref: entry hash]].
2. Determine the hash algorithm from the [[ref: entry hash]], which is a
   [[ref: multihash]].
   The hash algorithm **MUST** be one permitted by the active [[ref: logVersion]].
3. Remove the [[ref: Data Integrity]] `proof` from the [[ref: log entry]].
4. Set the `versionId` in the entry object to be the `versionId` from the
   previous [[ref: log entry]]. If this is the first entry, set the value to
   the [[ref: SCID]] of the log.
5. Calculate the hash string as
   `base58btc(multihash(JCS(entry), <hash algorithm>))`, where:
   1. `entry` is the data from the previous step.
   2. `JCS` is an implementation of the [[ref: JSON Canonicalization Scheme]]
      ([[spec:rfc8785]]).
   3. `multihash` is an implementation of the [[ref: multihash]] specification.
   4. `<hash algorithm>` is the hash algorithm from Step 2.
   5. `base58btc` is an implementation of the [[ref: base58btc]] function.
6. Verify that the calculated value matches the extracted [[ref: entry hash]] from
   Step 1. If not, terminate the resolution process with an error.

#### Authorized Keys

Each entry in the [[ref: log]] **MUST** include a [[ref: Data Integrity]] `proof`
where, at minimum:

1. `type` is `DataIntegrityProof`,
2. `cryptosuite` **MUST** be one permitted by the active [[ref: logVersion]].
3. `proofPurpose` is `assertionMethod`,
4. `verificationMethod` resolves to a [[ref: multikey]] that appears verbatim in
   the **active** `updateKeys`.

[[ref: Resolvers]] **MUST** reject an entry whose proof fails *any* check. A
structurally-valid signature over a different cryptosuite than allowed by the
active [[ref: logVersion]] **MUST NOT** be accepted.

[[ref: Log Controllers]], [[ref: witnesses]] and [[ref: Resolvers]] **MUST**
generate and verify [[ref: Data Integrity]] proofs (for both [[ref: log
entries]] and witness proofs) as defined by the specification of the
cryptosuite in use.

Private keys, and any other secret material such as random seeds, used by
[[ref: Log Controllers]] and [[ref: witnesses]] **MUST** be kept in secure
storage and **MUST NOT** appear in the log, the witness file, or any other
published resource.

The authorized verification keys are the [[ref: multikey]]-formatted public keys
in the **active** `updateKeys` list from the `parameters` property. Any of the
authorized verification keys may be referenced in the [[ref: Data Integrity]]
proof.

For the first [[ref: log entry]], the **active** `updateKeys` is the one defined
in that first entry.

A [[ref: Resolver]] **MUST** verify that the key used for signing each [[ref:
log entry]] is one from the list of active `updateKeys`. If not, terminate the
resolution process with an error.

The **active** `updateKeys` for subsequent entries depends on whether [[ref:
Pre-Rotation]] is active:

##### No Key Pre-Rotation

For all subsequent entries, the **active** list is the most recent `updateKeys`
**before** the [[ref: log entry]] to be verified. Thus, each [[ref: log entry]]
is signed by the keys from the **previous** entry.

##### Pre-Rotation Active

For all subsequent entries, the **active** list is the `updateKeys` from the
**current** [[ref: log entry]] to be verified. Thus, each [[ref: log entry]] is
signed by the keys from the **current** entry.

#### Pre-Rotation Key Hash Generation and Verification

Pre-rotation requires a [[ref: Log Controller]] to commit to the authorization
keys that will be used in the next [[ref: log entry]], without exposing those
actual public keys. The purpose is that if the currently authorized keys are
compromised, the attacker cannot rotate to new keys they control, because the
next keys were already committed. Assuming the attacker has not also compromised
the committed key pairs, they cannot rotate the authorization keys without
detection.

A [[ref: Log Controller]] **MAY** include the [[ref: parameter]] `nextKeyHashes`
with a non-empty list in any [[ref: log entry]] to activate [[ref: pre-rotation]].

A [[ref: Log Controller]] may turn off pre-rotation by setting `nextKeyHashes`
to `[]` (empty array). If there is an active set of `nextKeyHashes` at the time,
pre-rotation requirements remain in effect for that [[ref: log entry]]. The
subsequent [[ref: log entry]] **MUST** use the non-pre-rotation rules.

To create a hash to be included in the `nextKeyHashes` array, the [[ref: Log Controller]]
**MUST** execute the following process for each possible future
authorization key:

1. Generate a new key pair. The key type **MUST** be compatible with the
   cryptosuites permitted by the active [[ref: logVersion]].
2. Generate a [[ref: multikey]] representation of the public key.
3. Calculate the hash string as `base58btc(multihash(multikey))`, where:
   1. `multikey` is the [[ref: multikey]] representation from Step 2.
   2. `multihash` is an implementation of the [[ref: multihash]] specification.
   3. `<hash algorithm>` is the hash algorithm used by the [[ref: Log Controller]],
      which **MUST** be one permitted by the active [[ref: logVersion]].
   4. `base58btc` is an implementation of the [[ref: base58btc]] function.
4. Insert the calculated hash into the `nextKeyHashes` array within the
   [[ref: parameters]] property.
5. The generated key pair **SHOULD** be safely stored so that it can be used in
   the next [[ref: log entry]].

A [[ref: Log Controller]] **MAY** include extra hashes in `nextKeyHashes` that
are not subsequently used. Unused hashes are ignored.

After rotating from a pre-rotation public key, the corresponding private key
**SHOULD** be treated as **spent** and **securely destroyed**. A [[ref: Log
Controller]] **SHOULD NOT** reuse a pre-rotation key once its public key has
been revealed in the log. Such reuse does not make the log invalid, and
[[ref: Resolvers]] are **NOT REQUIRED** to detect it, but a [[ref: Resolver]]
**MAY** warn when it does.

When processing other than the first [[ref: log entry]] where [[ref: pre-rotation]]
is active, a [[ref: Resolver]] **MUST**:

1. For each [[ref: multikey]] in the `updateKeys` property in the `parameters`
   of the [[ref: log entry]], calculate the hash using the algorithm permitted
   by the active [[ref: logVersion]].
2. The resultant hash **MUST** be in the `nextKeyHashes` array from the previous
   [[ref: log entry]]. If not, terminate the resolution process with an error.
3. A new `nextKeyHashes` list **MUST** be in the `parameters` of the [[ref: log entry]]
   currently being processed. If not, terminate the resolution process
   with an error.

### Witnesses and Watchers

[[ref: Witnesses]] and [[ref: watchers]] are optional external parties that
strengthen the guarantees a log provides: [[ref: witnesses]] approve each
[[ref: log entry]] before it is published, and [[ref: watchers]] hold and
re-serve independent copies of the log.

#### Witnesses

The [[ref: witness]] process provides a way for collaborators to work with the
[[ref: Log Controller]] to "witness" the publication of new versions of the log.
This specification defines the technical mechanism for using [[ref: witnesses]].
Governance and policy questions about when and how to use the technical mechanism
are outside the scope of this specification.

[[ref: Witnesses]] can prevent a [[ref: Log Controller]] from updating or removing
versions of a log without detection by the witnesses. With both the [[ref: Log Controller]]'s
authorization key(s) and the log's hosting location compromised,
a malicious actor might be able to take control of the log by rewriting its
history. By adding [[ref: witnesses]] to monitor and approve each version update,
a malicious actor cannot rewrite the previous history without having compromised
a sufficient number of [[ref: witnesses]] as well.

This protection depends on [[ref: witnesses]] behaving as this specification
requires — in particular, approving only an entry that extends their own copy
of the log (see [Witnessing a Log Entry
Update](#witnessing-a-log-entry-update)). A witness proof shows only that a
[[ref: witness]] approved an entry; a [[ref: Resolver]] cannot confirm how the
[[ref: witness]] reached that decision. How far [[ref: witnesses]] are trusted
is therefore a matter for the governance of the ecosystem. [[ref: Watchers]]
provide a way to detect conflicting logs that does not depend on that trust;
see [Watchers](#watchers).

##### Witness Lists

The list of witnesses that approve log updates is defined in the `witness`
parameter, as described in the [VH-Log Parameters](#vh-log-parameters) section.
After the first `witness` parameter has been set to other than `{}` (empty object),
and while there are active witnesses, a [[ref: threshold]] of the active witnesses
must provide valid proofs associated with each [[ref: log entry]] before the
[[ref: log entry]] can be published. If a [[ref: log entry]] contains a
replacement witness list, that new list becomes active **AFTER** the entry has
been published.

##### Witness Identity and Key Format

The format of witness identifiers and the method for deriving the verification
key from a witness identifier are defined by the [[ref: specialisation]]. The
[[ref: specialisation]] **MUST** specify an identifier format from which the
witness verification key can be derived without requiring external resolution,
in order to maintain the tamper-evident properties of the log.

##### The `witness` Parameter

The `witness` element in a [[ref: parameters]] object has the following data
structure:

```json
"witness": {
  "threshold": n,
  "witnesses": [
    {
      "id": "<witness identifier>"
    }
  ]
}
```

where:

- `threshold`: a positive integer (JSON number, no fractional part, value ≥ 1)
  that **MUST** be attained or surpassed by the count of **distinct** verified
  [[ref: witness]] approvals for a [[ref: log entry]] to be considered approved.
  The `threshold` **MUST** be between 1 and the number of **distinct**
  `witnesses[].id` values, inclusive. A `witness` parameter where `threshold`
  is missing, non-integer, < 1, or > count(distinct ids) **MUST** be rejected;
  [[ref: Resolvers]] **MUST NOT** silently coerce a malformed `witness` to
  "no witnesses" — they **MUST** terminate resolution with an error.
- `witnesses`: the array of [[ref: witnesses]] that **MUST** be non-empty, with
  each entry including the field:
  - `id`: (required) the identifier of the witness. The format is defined by
    the [[ref: specialisation]]. Each `id` **MUST** be unique within the array
    (compared byte-for-byte after Unicode NFC normalisation). Each `id`
    contributes at most one approval to threshold counting, regardless of how
    many proofs are attributed to it.

##### Witness Threshold Algorithm

The use of the [[ref: threshold]] (rather than requiring all [[ref: witnesses]])
prevents faulty witnesses from blocking publication. To determine if the [[ref:
threshold]] has been met, participants **MUST**:

1. Verify each [[ref: Data Integrity]] proof in the witness file for the relevant
   `versionId` independently.
2. Attribute each verified proof to a witness `id` from the **active**
   `witnesses` list. Proofs that cannot be attributed **MUST** be discarded.
3. Form the set of **distinct** attributed `id` values. The threshold check
   applies to the size of this set, not to the raw proof count.
4. If `|set| ≥ threshold`, the update is "[[ref: witnessed]]"; otherwise
   resolution **MUST** terminate with an error.

##### The Witness Proofs File

Proofs from [[ref: witnesses]] are placed into a separate file from the log file.
The default name of the witness file is `vh-log-witness.json`. A [[ref:
specialisation]] **MAY** define a different name. The media type of the file
**SHOULD** be `application/json`.

The data model for the witness file is:

```json
[
  {
    "versionId": "1-Qmba111111...",
    "proof": [{ ... }, { ... }]
  },
  {
    "versionId": "2-Qzmb222222...",
    "proof": [{ ... }, { ... }]
  }
]
```

Where:

- `versionId` is the `versionId` of the [[ref: log entry]] to which the
  [[ref: witness]] proofs apply.
- `proof` is an array of [[ref: Data Integrity]] proofs. The permitted [[ref:
  Data Integrity]] cryptosuite **MUST** be one permitted by the active
  [[ref: logVersion]], and the `proofPurpose` **MUST** be set to `assertionMethod`.

The method for deriving the witness verification key from the witness identifier
and for verifying witness proofs is defined by the [[ref: specialisation]].

A valid proof from a [[ref: witness]] carries the implication that **ALL** prior
[[ref: log entries]] are also approved by that witness. To maintain a manageable
witness file size, the [[ref: Log Controller]] **SHOULD** remove older proofs for
**published** [[ref: log entries]], keeping only the latest proof for each witness.

To eliminate the race condition in publishing the log file and witness file, when
a new [[ref: log entry]] is being added, [[ref: witness]] proofs **MUST** be
added to the witness file and that file published **BEFORE** publishing the
updated log file. As a result, [[ref: Resolvers]] may find proofs for unpublished
[[ref: log entries]] in the witness file. [[ref: Resolvers]] **MUST** ignore
proofs with `versionId`s not in the log file.

To avoid unnecessary clutter in the witness file, array entries without proofs
(containing only the `versionId`) **SHOULD** be removed.

A witness file **MUST NOT** contain proofs for two different `versionId`s with
the same version number. When adding proofs to the witness file, a
[[ref: Log Controller]] **MUST** reject any proof for a `versionId` that
conflicts in this way with the log it is publishing.

##### Witnessing a Log Entry Update

The following process is used to witness a log entry update:

- The [[ref: Log Controller]] prepares the full [[ref: log entry]] (including the
  `proof` element) for the new version, and shares it with the active [[ref:
  witnesses]]. The specification leaves to implementers how the [[ref: log entry]]
  data is provided to the [[ref: witnesses]].
- Each [[ref: witness]] **MUST** hold its own copy of the published log file prior
  to witnessing, and **MUST** confirm that the controller-supplied candidate entry
  verifies as the next entry to that log.
- Each [[ref: witness]] **MUST** independently verify the candidate entry using
  every step in [Read (Resolve)](#read-resolve). Any failure **MUST** cause the
  witness to refuse approval.
- A [[ref: witness]] **MUST NOT** approve more than one [[ref: log entry]] with
  the same predecessor.
- Each [[ref: witness]] determines (based on the governance of the ecosystem)
  if they approve of the update.
- If the verification is successful and approval is granted, the [[ref: witness]]
  creates and sends to the [[ref: Log Controller]] a [[ref: Data Integrity]] proof
  signed using the witness's key. The specification leaves to implementers how
  [[ref: witness]] proofs are sent to the [[ref: Log Controller]].
- The [[ref: Log Controller]] **MUST** add the proof to the record for the
  applicable `versionId` in the witness file.
  - The [[ref: Log Controller]] **MAY** publish the updated witness file as new
    proofs are added.
  - The [[ref: Log Controller]] **MUST** publish the updated witness file
    **after** a [[ref: threshold]] of proofs have been received and **before** the
    witnessed log file is published.

::: note
A [[ref: Resolver]] can verify that a [[ref: threshold]] of
[[ref: witnesses]] signed an entry, but not that each [[ref: witness]] held
its own copy of the log or checked the entry against it. The requirements on
[[ref: witnesses]] above define correct behaviour; whether a given
[[ref: witness]] meets them is a matter of trust in that [[ref: witness]].
:::

##### Verifying Witness Proofs During Resolution

A [[ref: Resolver]] **MUST** verify that all [[ref: log entries]] that have active
[[ref: witnesses]] have a [[ref: threshold]] of approving witnesses. [[ref:
Resolvers]] **MUST**:

1. Complete all non-witness verifications of the log file **before** processing
   any witness proof. Witness verification **MUST NOT** substitute for entry-hash
   or signature verification.
2. Retrieve the witness file.
3. For each entry in the witness file, confirm its `versionId` matches a
   `versionId` present in this log file. Non-matching entries, including those
   for future entries, **MUST** be discarded.
4. Verify enough proofs to meet the [[ref: threshold]] for all entries requiring
   witnessing.
5. For each entry requiring witnessing, confirm a threshold of verified,
   distinct-witness proofs whose `versionId` matches the current or any later
   published entry. Otherwise, terminate with an error.

#### Watchers

[[ref: Watchers]] are components found in some trust ecosystems that monitor logs
on behalf of clients for various purposes, such as:

- **Caching verified logs:** Storing verified [[ref: state]] objects to facilitate
  efficient resolution.
- **Ensuring persistence:** Maintaining access to logs even after removal by
  the [[ref: Log Controller]].
- **Detecting inconsistencies:** Identifying malicious behavior by the [[ref: Log Controller]],
  such as republishing altered logs, or giving different parties conflicting
  logs (duplicity). A [[ref: watcher]] does this by retrieving the log from
  each source it knows of and checking that each copy extends the copy it
  holds. This is the most reliable way to detect duplicity, because it does
  not depend on trusting the [[ref: Log Controller]] or the
  [[ref: witnesses]], but it costs a retrieval and verification of the log on
  each check, and detects only the copies the [[ref: watcher]] sees. A network
  of [[ref: watchers]] can reach consensus independently of
  [[ref: witnesses]].

Any party may set up a [[ref: watcher]] for a log, without the involvement of
the [[ref: Log Controller]] and without being listed in the log — for example,
a relying party that wants a check independent of the [[ref: Log Controller]].
A [[ref: Log Controller]] may also opt to collaborate with specific [[ref: watchers]] by publishing
their URIs in the [[ref: parameters]] of [[ref: log entries]]. It is outside the
scope of this specification how a [[ref: Log Controller]] requests a [[ref:
watcher]] to monitor a log or how a [[ref: watcher]] requests inclusion in the
log.

A [[ref: watcher]] **SHOULD** check that each copy of a log it retrieves
extends the copy it holds, and **SHOULD** report any divergence it detects
between copies.

The governance of [[ref: watchers]] is out of scope for this specification, which
defines only the technical mechanisms for notifying and querying [[ref: watcher]]
services.

##### Publishing Watcher URLs

VH-Log provides a mechanism for notifying [[ref: Resolvers]] about configured
[[ref: watchers]]. The `watchers` [[ref: parameter]] lists URIs identifying the
log's [[ref: watchers]].

When resolving a log, [[ref: Resolvers]] **MUST** provide the active list of
[[ref: watchers]] in the resolution result metadata, as noted in the
[Read (Resolve)](#read-resolve) section.

If a `watchers` entry is included in a [[ref: log entry]], it replaces the active
set of [[ref: watchers]].

If a new [[ref: watcher]] is added after a log has existed for some time, the
[[ref: Log Controller]] **SHOULD** notify the new [[ref: watcher]] about
previously created log resources.

[[ref: Watchers]] do not need to be listed in the log. [[ref: Watchers]] can
operate independently of the [[ref: Log Controller]] by polling for updates.
[[ref: Log Controllers]] **MAY** send notifications to [[ref: watchers]] that
they are aware of but do not list in the log.

##### Watcher Endpoints and Behavior

A [[ref: watcher]] is a web server accessible via HTTP that **MUST** support the
following capabilities:

- **Client Requests:**
  - Retrieve the log file for a given [[ref: SCID]].
  - Retrieve the witness file for a given [[ref: SCID]].
  - Retrieve a resource for a given [[ref: SCID]] and resource path.
- **Notifications (typically from the [[ref: Log Controller]]):**
  - Notify the [[ref: watcher]] about a new log entry.
  - Notify the [[ref: watcher]] about a new or updated log resource.
  - Request removal of a given [[ref: SCID]] from the [[ref: watcher]]'s cache.
  - Request removal of a given resource from the [[ref: watcher]]'s cache.

##### Watcher HTTP API Operations

The following HTTP API operations define the interaction between [[ref: watchers]]
and other components:

- **GET `<WATCHER URL>/log?scid=<SCID>`**: Returns the latest log file for the
  given [[ref: SCID]].
- **POST `<WATCHER URL>/log?id=<log identifier>`**: Notifies the [[ref: watcher]]
  of a log update, prompting retrieval of the latest log and witness files. The
  [[ref: watcher]] is expected to index the log using its [[ref: SCID]].
- **POST `<WATCHER URL>/log/delete?scid=<SCID>`**: Notifies the [[ref: watcher]]
  that the given `<SCID>` should be deleted from its cache. The body **MAY**
  contain a [[ref: Data Integrity]] proof from the requester for the [[ref:
  Watcher]] to use when deciding on the legitimacy of the request. The [[ref:
  Watcher]] will act (or not) according to its governance. This endpoint may be
  used to fulfill a "right to be forgotten" request.
- **GET `<WATCHER URL>/witness?scid=<SCID>`**: Returns the latest witness file
  for the given [[ref: SCID]].
- **GET `<WATCHER URL>/resource?scid=<SCID>&path=<resourcePath>`**: Retrieves
  the requested resource.
- **POST `<WATCHER URL>/resource?scid=<SCID>&path=<resourcePath>`**: Notifies
  the [[ref: watcher]] of a new or updated resource.
- **POST `<WATCHER URL>/resource/delete?scid=<SCID>&path=<resourcePath>`**:
  Notifies the [[ref: watcher]] that the given resource should be deleted from
  its cache.

### Publishing and Retrieving Log Resources

This section applies whenever a log file, witness file, or other log resource
is published to, or retrieved from, a network location. A [[ref:
specialisation]] defines where those locations are; this section defines how
they are served and fetched.

#### Publishing Log Resources

1. Log resources **MUST** be served over HTTPS, with the server authenticated
   by TLS server authentication. Plain HTTP **MUST NOT** be used, except for
   testing or non-production deployments.
2. Self-signed TLS certificates **SHOULD NOT** be used in production.
3. So that a [[ref: Resolver]] running in a web browser can retrieve it, the
   HTTP response for the log file **MUST** include the header
   `Access-Control-Allow-Origin: *`.
4. A [[ref: Log Controller]] that serves log resources through intermediaries
   such as CDN caches or load balancers **MUST** ensure that those
   intermediaries do not serve stale or altered log resources.

#### Retrieving Log Resources

A [[ref: Resolver]] fetches resources from a location derived from a log
identifier it does not control, which makes it a potential Server-Side Request
Forgery (SSRF) vector. When retrieving log resources, a [[ref: Resolver]]
**MUST**:

1. **HTTPS only.** Reject any URL scheme other than `https`, including after a
   redirect, and validate the server's TLS certificate. Certificate validation
   **MUST NOT** be disabled by default.
2. **No automatic redirects.** Not automatically follow HTTP 3xx responses when
   fetching log files or witness files. If following redirects is offered as an
   opt-in, every check in this list **MUST** be re-applied to each redirect
   target.
3. **Case-insensitive percent-decoding.** Normalise the case of percent-encoded
   octets, per [[spec:rfc3986]] §2.1, **before** making any allow or deny
   decision. For example, rejecting `%3A` but accepting `%3a` is non-compliant.
4. **Re-validate after decoding.** Apply all host and path checks to the
   decoded values. Percent-encoded IP literals and traversal sequences (such as
   `%2E%2E` and `%2e%2e`) **MUST** be rejected after decoding.
5. **IP-literal and private-address rejection.** Reject IPv4 and IPv6 literal
   hosts both (a) after percent-decoding the host taken from the log
   identifier, and (b) after DNS resolution. By default, deny loopback
   (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`, `172.16.0.0/12`,
   `192.168.0.0/16`, `fc00::/7`) and link-local (`169.254.0.0/16`,
   `fe80::/10`) addresses. Opt-ins for development **MAY** be provided, but
   **MUST** be off by default.
6. **No localhost in production.** Not issue requests to `localhost`,
   `127.0.0.0/8`, `::1`, or names resolving to them, except through a testing
   opt-in that is off by default.
7. **Response size cap.** Enforce a maximum body size for both log and witness
   files, terminating the transfer if it is exceeded regardless of any declared
   `Content-Length`. The `Content-Length` header **SHOULD** be checked before
   the body is read, and its absence treated as grounds for a stricter cap or
   for rejection. A cap of 5 MiB is **RECOMMENDED** as a default.
8. **Operation timeout.** Enforce a wall-clock timeout on the complete
   fetch-and-verify operation for a single resolution. A timeout of 30 seconds
   is **RECOMMENDED** as a default.
