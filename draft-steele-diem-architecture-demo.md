---
title: "An Architecture for DNS-Delivered Digital Emblems (Demonstration)"
abbrev: "DNS Digital Emblems Demo"
category: info

docname: draft-steele-diem-architecture-demo-latest
submissiontype: IETF
number:
date:
consensus: true
v: 3
area: "ART"
workgroup: "Digital Emblems"
keyword:
 - digital emblem
 - COSE
 - CWT
 - hash envelope
 - DNS
 - HTTPS RR
 - SVCB
 - proof of possession
 - protective marking
stand_alone: yes
smart_quotes: no
pi: [toc, sortrefs, symrefs]

venue:
  github: "OR13/emblem.red"
  latest: "https://emblem.red/draft-steele-diem-architecture-demo.html"

author:
 -
    fullname: "Orie Steele"
    organization: Tradeverifyd
    email: "orie.steele@tradeverifyd.com"

normative:

informative:


--- abstract

This document describes a demonstration architecture for issuing, verifying,
marking, and unmarking assets, identified by Fully Qualified Domain Names
(FQDNs), with digital emblems. A digital emblem is modeled as a COSE hash
envelope: a COSE single-signer structure whose payload is the cryptographic
hash of an external resource, and whose protected header carries the hash
algorithm, the resource's content type and location, a minimal set of CBOR Web
Token (CWT) claims, and a confirmation (cnf) key for later proof of possession.
The entire emblem is delivered over the Domain Name System (DNS) inside the
asset's own HTTPS resource record, in a private-use service parameter, so that
the query used to discover an emblem is indistinguishable from the query an
ordinary client already issues to connect to the asset. This lets a validator
check whether an asset is protected without revealing, to the infrastructure
provider or to an on-path observer, any intent to discover emblems. The
document is a companion to a running demonstration hosted at emblem.red. It
explores the Digital Emblems (DIEM) architecture against the working group's
use cases and requirements; it is not a standards-track specification.


--- middle

# Introduction

Physical protective emblems, such as the distinctive emblems of the Red Cross,
Red Crescent, and Red Crystal, or the Blue Shield of cultural property, signal
to observers that the marked person, object, or place is entitled to specific
protection under a normative framework such as International Humanitarian Law
(IHL). Digital emblems extend this concept to network infrastructure: an
asset, identified by a Fully Qualified Domain Name (FQDN), can signal to a
validating entity that it, or a resource it represents, should be protected or
treated in a specific way.

The Digital Emblems (DIEM) working group is chartered, in its initial phase, to
address emblems that are discoverable via DNS and that identify their bearer by
an FQDN. The working group's use cases and requirements are captured in
{{?I-D.ietf-diem-requirements}}.

This document describes one concrete architecture that satisfies a useful
subset of those requirements, and it is deliberately paired with a running
demonstration hosted at emblem.red. The demonstration allows an operator to:

- **issue** a digital emblem that attests a resource,
- **mark** an FQDN by publishing that emblem in DNS,
- **verify** an emblem discovered for an FQDN, and
- **unmark** an FQDN by removing that emblem from DNS.

Two design choices distinguish this architecture and are the focus of this
document:

1. The emblem is a COSE hash envelope
   ({{!I-D.ietf-cose-hash-envelope}}): its payload is the hash of an external
   resource rather than an inlined claim set. The signed metadata needed to act
   on the emblem (the hash algorithm, the resource's content type and location,
   a minimal set of CWT claims per {{!RFC9597}}, and a confirmation key per
   {{!RFC8747}}) travels in the COSE protected header. The **entire emblem** is
   therefore self-contained and is delivered entirely over DNS; see
   {{entire-in-dns}}.

2. The emblem is carried in the asset's **own HTTPS resource record**
   {{!RFC9460}}, in a private-use service parameter, rather than at a dedicated
   emblem-specific name. A validator issues the very query that an ordinary
   client already issues when connecting to the asset, so discovering an emblem
   does not disclose the intent to do so. See {{generic-query}}.

This document is informational and describes a demonstration. It does not
mandate a wire format for the working group, and it is not a substitute for the
working group's architecture deliverable.

# Conventions and Definitions

{::boilerplate bcp14-tagged}

This document uses the actor terminology of {{?I-D.ietf-diem-requirements}}:

Asset:
: A physical or digital resource that can present a digital emblem. In this
  document, an Asset is identified by an FQDN.

Emblem Issuer:
: The entity operating or controlling the Asset that bears the emblem.

Authorizing Entity:
: An entity competent to grant authorization to use an emblem.

Validator:
: An entity that queries and inspects an Asset to determine whether it bears a
  valid digital emblem.

In addition:

Emblem:
: A COSE hash envelope that carries the protective marking for an Asset, signed
  by the Emblem Issuer.

Resource:
: The external content attested by the Emblem. The Emblem's payload is the hash
  of the Resource; the Resource itself is retrieved separately, if at all.

Holder:
: The party that controls the private key confirmed by the Emblem's `cnf`
  claim and can, on demand, prove possession of it.

Marking:
: The act of publishing an Emblem such that a Validator can discover it for a
  given FQDN.

Unmarking:
: The act of removing a previously published Emblem.

# Architecture Overview

The architecture defines four operations over an Asset identified by an FQDN.

~~~
+---------------+  issue   +------------------------+
| Emblem Issuer |--------->|  Emblem                |
| (+ Authorizing|          |  COSE_Sign1 hash       |
|    Entity)    |          |  envelope over a       |
+---------------+          |  Resource; cnf key     |
                           +-----------+------------+
                                       | mark (publish in the
                                       | asset's HTTPS record)
                                       v
                           +------------------------+
                           |  DNS: HTTPS RR at       |
                           |  <fqdn>, SvcParam       |
                           |  key65280               |
                           +-----------+------------+
                                       | ordinary connection-setup query
                                       v
+---------------+ verify   +------------------------+
|   Validator   |<---------|  Emblem                |
+------+--------+          +------------------------+
       | (optional) fetch + re-hash Resource;
       | (optional) challenge Holder for proof of possession
       v
+------------------------+
|  Resource (e.g. JSON)  |
+------------------------+
~~~
{: title="Information flow for the four operations"}

Issue:
: The Emblem Issuer, optionally acting under an Authorizing Entity, hashes the
  Resource, and signs a COSE hash envelope whose payload is that hash and whose
  protected header carries the hash algorithm, the Resource's content type and
  location, minimal CWT claims, and a confirmation key. See {{emblem-format}}.

Mark:
: The Emblem Issuer publishes the Emblem in the Asset's own HTTPS resource
  record, in a private-use service parameter. See {{dns-delivery}}.

Verify:
: A Validator discovers the Emblem by issuing an ordinary HTTPS query for the
  FQDN, checks the COSE signature, and reads the signed metadata. It MAY then
  retrieve the Resource and confirm its hash, and MAY challenge the Holder to
  prove possession of the `cnf` key. See {{validation}}.

Unmark:
: The Emblem Issuer removes the emblem service parameter from the HTTPS record.
  See {{unmarking}}.

The architecture MUST NOT assume that a Validator has general Internet access
beyond the ability to resolve DNS for the queried name; this constraint follows
{{?I-D.ietf-diem-requirements}}. Trust anchors and any material required to
check authorization are provisioned out of band or carried within the Emblem
itself. Because the entire Emblem is delivered in the DNS answer, the assertion
"this Asset is protected" is verifiable from that answer alone; retrieving the
Resource is an additional, optional step (see {{entire-in-dns}}).

# The Emblem: a COSE Hash Envelope {#emblem-format}

An Emblem is a COSE_Sign1 structure ({{Section 4.2 of !RFC9052}}) shaped as a
hash envelope {{!I-D.ietf-cose-hash-envelope}}. Its payload is the hash of the
Resource; it is not an inlined claim set. When tagged, the Emblem is a
COSE_Sign1 (CBOR tag 18). The Emblem's media type is
`application/digital-emblem+cose`.

The protected header carries:

| Field                | Label | Value in the demonstration                 |
|----------------------|:-----:|--------------------------------------------|
| alg                  |   1   | ES256 (-7), from {{!RFC9053}}              |
| kid                  |   4   | Issuer key identifier                      |
| CWT Claims           |  15   | Minimal CWT claim set; see below ({{!RFC9597}}) |
| payload hash alg     |  258  | SHA-256 (-16), from {{!RFC9054}}           |
| preimage content type|  259  | Content type of the Resource (e.g. application/json) |
| payload location     |  260  | Retrieval location (URI) of the Resource   |
{: title="Emblem protected-header parameters"}

The payload is the hash of the Resource, computed with the algorithm named in
label 258. Labels 258, 259, and 260 are defined by
{{!I-D.ietf-cose-hash-envelope}}.

## CWT claims in the protected header {#claims}

Rather than an inlined CWT payload, the Emblem carries CWT claims in the COSE
protected header using the CWT Claims header parameter (label 15) of
{{!RFC9597}}. The claim set is kept minimal:

| Claim | Key | Purpose                                                       |
|-------|:---:|---------------------------------------------------------------|
| sub   |  2  | Identifies the protected Resource                             |
| cnf   |  8  | Confirmation key for proof of possession ({{!RFC8747}})       |
{: title="CWT claims carried in the protected header"}

The `cnf` (8) claim contains a COSE_Key (confirmation method key 1) holding the
Holder's public key. This binds the Emblem to a key the Holder can later prove
possession of ({{pop}}), independently of the Issuer's signing key. Additional
protection semantics (kind of protection, jurisdiction, revocation pointer) MAY
be expressed as further claims or within the Resource; interoperable semantics
are out of scope for this demonstration.

## The Resource {#resource}

The Resource is the content the Emblem attests. In the demonstration it is an
`application/json` document (GeoJSON) that describes a landmark and marks it
protected; using a widely understood media type lets structured, extensible
detail live in the Resource while the Emblem stays small and generic. The
Emblem binds the Resource by hash, so the Resource MAY be served from any
location, cached, or mirrored: its integrity does not depend on the transport
used to fetch it, only on matching the signed hash.

# Delivering the Entire Emblem over DNS {#entire-in-dns}

The complete Emblem, the COSE signature, the signed metadata, the CWT claims,
and the `cnf` key, is delivered in the DNS answer. Nothing needed to decide
"is this Asset protected, by whom, and bound to which key" is fetched from a
separate service.

This is a deliberate and load-bearing property:

- **Verifiable from the resolver path alone.** A Validator that can resolve DNS
  for the name, but has no other connectivity, can still obtain the Emblem,
  verify the Issuer's signature, and read the protected metadata. This matches
  the requirement that validation not assume general Internet access
  ({{?I-D.ietf-diem-requirements}}).

- **No second, revealing fetch for the protection decision.** If the Emblem
  were merely a pointer to be dereferenced (for example, a URL to download the
  token), then discovering protection status would require contacting that
  endpoint, an act that is observable to whoever operates it and that couples
  availability of the protection signal to availability of a separate service.
  Keeping the whole Emblem in DNS means the protection decision needs only the
  generic DNS query of {{generic-query}}.

- **Resource retrieval is optional and separable.** The Emblem attests the
  Resource by hash. A Validator MAY fetch the Resource to obtain its full
  content and confirm the hash, but this is an additional step, distinct from
  the protection decision, and is subject to its own observability
  considerations ({{security}}). Because the hash is signed and delivered in
  DNS, the Resource can be retrieved later, from a cache, or never.

# Generic Discovery and Unobservability {#generic-query}

A digital emblem declares a protected status. In the DIEM threat model, the act
of *checking* for that status can itself be sensitive: an adversary performing
target reconnaissance, or an infrastructure provider observing queries, should
not be able to tell that a party is enumerating or probing for protected
assets. {{?I-D.ietf-diem-requirements}} captures this as an Undetectable
Validation property.

Two common designs defeat this property:

- A **dedicated owner name** (for example `emblem.<fqdn>`) makes the lookup
  self-identifying. Any query for that name means "someone is looking for an
  emblem." The authoritative server necessarily sees the queried name, and so
  learns that emblems are being sought for that zone, and for which names.

- A **dedicated resource record type** for emblems is likewise
  self-identifying: the query type alone reveals the intent, even when the
  owner name is generic.

This architecture instead carries the Emblem in the record an ordinary client
already fetches during normal connection setup: the **HTTPS resource record**
(RRTYPE 65) {{!RFC9460}} at the Asset's own name, in a private-use
SvcParamKey (see {{dns-delivery}}). Consequently:

- **The query is generic.** To discover an Emblem, a Validator issues exactly
  the HTTPS query for `<fqdn>` that a browser or operating system issues to
  connect to the Asset. The authoritative operator cannot distinguish a
  protection check from an ordinary client preparing to connect; there is no
  emblem-specific name or type whose appearance would betray the intent.

- **On-path observers see ordinary traffic.** When the query is carried over
  encrypted DNS (DNS over HTTPS or DNS over TLS), an on-path observer sees
  neither the queried name nor the type. Combined with the generic query, both
  the on-path and the authoritative vantage points observe only what they would
  observe for any client of the service.

- **Ordinary clients are unaffected.** The Emblem rides beside the normal
  service parameters (such as `alpn`) in a private-use SvcParamKey that clients
  which do not implement DIEM simply ignore ({{degrade}}).

Residual signals remain and MUST be understood by deployments that rely on this
property:

- A Validator that issues the HTTPS query but never proceeds to connect can, in
  principle, be distinguished from a genuine client by the *absence* of a
  subsequent connection. Full unobservability therefore requires that
  validation ride on, or be indistinguishable from, an actual connection
  attempt.

- The authoritative operator still learns that the record was served, exactly
  as for any client; unobservability is about not revealing *emblem-seeking
  intent*, not about hiding that the name was resolved.

- Retrieving the Resource ({{resource}}) is a separate act with its own
  observability. Because the protection decision is answerable from the
  DNS-delivered Emblem alone ({{entire-in-dns}}), a Validator that must remain
  unobservable can decide protection status without fetching the Resource.

Together, {{entire-in-dns}} and this section give the core property: checking
whether an Asset is protected requires only a query that is indistinguishable
from ordinary traffic, and that query returns everything needed to decide.

# Delivering Emblems in the HTTPS Resource Record {#dns-delivery}

The Emblem is published in the Asset's HTTPS resource record {{!RFC9460}} at the
Asset's own name (the apex or service name a client would use to connect), not
at a derived emblem-specific name.

The record MUST be in ServiceMode (SvcPriority nonzero); AliasMode records
ignore SvcParams and cannot carry the Emblem. The Emblem is carried in a
private-use SvcParamKey in the range 65280-65534 ({{Section 14.3.2 of
!RFC9460}}); the demonstration uses `key65280`, alongside ordinary service
parameters such as `alpn`.

## Binary encoding {#binary}

On the wire, an SvcParamValue is a length-prefixed octet string
({{Section 2.2 of !RFC9460}}). The raw COSE/CBOR bytes of the Emblem are placed
directly in the value with no additional encoding; DNS carries binary natively
on the wire, and the 2-octet length field accommodates values up to 65535
octets.

In zone-file (presentation) form, arbitrary binary can be escaped byte-by-byte
using the `\DDD` decimal escape ({{Section 2.1 of !RFC9460}}). Because a signed
Emblem contains many non-printable octets, an implementation MAY instead author
the value as base64url ASCII for legibility; this is purely an authoring
convenience and does not change the octets carried on the wire.

## Graceful degradation {#degrade}

The Emblem's SvcParamKey MUST NOT be listed in the `mandatory` SvcParamKey
({{Section 8 of !RFC9460}}). Listing it there would cause clients that do not
understand the key to discard the entire record; leaving it out lets the record
serve its ordinary connection-setup purpose for every client while remaining a
generic query for Validators. This graceful degradation is what makes the
generic-query property of {{generic-query}} practical on production names.

## Size and transport {#size}

A signed Emblem may exceed the classic 512-octet DNS message limit. Deployments
MUST support EDNS(0) {{!RFC6891}} to advertise a larger reassembly buffer (a
starting value of 4096 octets is RECOMMENDED), and MUST fall back to TCP when
the truncation (TC) bit is set. The absolute ceiling on a single record's RDATA
is 65535 octets, imposed by the 16-bit RDLENGTH field ({{!RFC1035}}). A hash
envelope is compact because its payload is a fixed-size digest rather than the
Resource itself.

# Marking and Unmarking {#unmarking}

Marking an Asset consists of adding the emblem SvcParamKey to the Asset's HTTPS
resource record as described in {{dns-delivery}}. Unmarking consists of removing
that SvcParamKey (leaving any ordinary service parameters intact) so that the
generic HTTPS query no longer returns an Emblem.

The DIEM requirements identify a stronger "Removable" property in which removal
leaves no evidence that an Emblem was ever applied
({{?I-D.ietf-diem-requirements}}). Simple removal does not by itself achieve
this against an adversary with access to historical DNS data (for example,
passive DNS or cached zone transfers). An implementation that requires the
Removable property MUST specify a threat model and address such historical
observability; the demonstration does not claim this property.

# Validation {#validation}

A Validator processes an FQDN as follows:

1. Issue an ordinary HTTPS (RRTYPE 65) query for `<fqdn>`, using EDNS(0) and TCP
   fallback as described in {{size}}, preferably over encrypted DNS
   ({{generic-query}}).
2. Extract the Emblem octets from the private-use SvcParamKey. If none is
   present, the Asset is not marked.
3. Parse the COSE_Sign1 and verify the signature using a key identified by the
   `kid` header and obtained from a trust anchor established out of band.
4. Read the protected metadata: the hash algorithm (258), the Resource content
   type (259) and location (260), the CWT claims (15), and the `cnf` key.

Steps 1-4 decide protection status from the DNS answer alone. A Validator MAY
additionally:

5. Retrieve the Resource from its location (260), compute its hash with the
   algorithm from 258, and confirm it equals the signed payload. A mismatch
   means the Resource has changed relative to what was attested.
6. Challenge the Holder to prove possession of the `cnf` key ({{pop}}).

A deployment MAY treat an Emblem as unverified (skipping step 3) where its use
case permits, as allowed by {{?I-D.ietf-diem-requirements}}. Note that this
architecture does not bind the Emblem to the queried FQDN by a `sub`-equals-FQDN
check; the binding to the Asset is the emblem's *presence in that Asset's own
HTTPS record*, and the `sub` claim identifies the protected Resource.

# Proof of Possession {#pop}

The `cnf` (8) claim confirms a Holder key ({{!RFC8747}}). A Validator that needs
assurance that the presenter is the intended Holder, and not merely a party that
copied a bearer Emblem, MAY challenge the Holder:

1. The Validator sends a fresh, unpredictable challenge (nonce).
2. The Holder signs the challenge with the private key corresponding to the
   `cnf` COSE_Key, producing a COSE_Sign1 over the challenge.
3. The Validator verifies that proof against the `cnf` public key from the
   Emblem, and checks that the signed challenge matches the one it issued.

This detects replay of a copied Emblem by a party that does not hold the
confirmed key, and anchors any future "presentation" protocol the working group
may define. The demonstration implements and tests this exchange.

# Relationship to DIEM Requirements

This architecture is intended to exercise the following requirements from
{{?I-D.ietf-diem-requirements}}:

- Format: the Emblem is a compact, self-describing COSE hash envelope that
  attests a Resource and carries a confirmation key.
- Discovery: a Validator determines whether an Asset bears an Emblem by issuing
  the ordinary HTTPS query it would use to connect.
- Validation: the COSE signature check establishes issuer authenticity; the
  optional Resource re-hash confirms the attested content; the optional
  proof-of-possession exchange confirms the Holder.
- Undetectable Validation: because discovery uses a generic query that returns
  the entire Emblem ({{entire-in-dns}}, {{generic-query}}), a protection check
  is not distinguishable, at the authoritative server or on-path, from ordinary
  client traffic, subject to the residual signals noted in {{generic-query}}.
- Authorization: the trust model relies on out-of-band trust anchors and does
  not assume general Internet access; key compromise is addressed by
  re-issuance and, for presentation, by the `cnf` binding.

The Removable property is explicitly not fully provided by this demonstration.

# Security Considerations {#security}

The integrity and authenticity of an Emblem derive entirely from the COSE
signature; DNS is used only as a delivery channel and is not trusted to attest
to the Emblem. Validators SHOULD, where available, use DNSSEC to detect
tampering with the delivery channel, but MUST NOT rely on DNSSEC in place of
verifying the COSE signature.

Because the Emblem is a bearer object, any party that can retrieve it can
present it. The `cnf` claim ({{pop}}) lets a Validator require the presenter to
prove possession of a confirmed key, which detects presentation by a party that
merely copied the Emblem; it does not by itself prevent an on-path party from
observing a served Emblem. A deployment that needs revocation requires a
mechanism out of scope for this demonstration; re-issuance limits exposure.

The unobservability of validation ({{generic-query}}) depends on the query
being generic *and* on the Validator not producing a distinguishing follow-on
behavior (such as querying but never connecting), and on carrying the query over
encrypted DNS to hide it from on-path observers. Fetching the Resource
({{resource}}) is a separate, potentially observable act at the Resource's host;
deployments that must not reveal emblem-seeking intent SHOULD decide protection
status from the DNS-delivered Emblem alone and treat Resource retrieval as an
independent decision.

Unmarking by removal does not erase historical observations of a published
Emblem; see {{unmarking}}.

# IANA Considerations

This document has no IANA actions.

The demonstration uses a private-use SvcParamKey ({{Section 14.3.2 of
!RFC9460}}), which does not require registration. A standards-track successor
that carried emblems in the HTTPS/SVCB record would instead register a
dedicated SvcParamKey.

The demonstration labels the Emblem with the media type
`application/digital-emblem+cose`. A standards-track successor would register
this media type; this document does not request that registration.

The protected-header parameters used by the hash envelope (labels 258, 259, and
260) and the CWT Claims header parameter (label 15) are registered by
{{!I-D.ietf-cose-hash-envelope}} and {{!RFC9597}} respectively.


--- back

# Acknowledgments
{:numbered="false"}

This work builds on the DIEM working group's use cases and requirements, on
COSE hash envelopes, and on prior experiments in transparent digital emblems.
