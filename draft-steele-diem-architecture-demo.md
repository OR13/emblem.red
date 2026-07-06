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
 - CWT
 - COSE
 - DNS
 - SVCB
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
marking, and unmarking Fully Qualified Domain Names (FQDNs) with digital
emblems. A digital emblem is modeled as a CBOR Web Token (CWT) secured with a
COSE single-signer structure, and it is delivered entirely over the Domain
Name System (DNS) using Service Binding (SVCB) resource records, including a
mechanism for cleanly conveying the binary token on the wire. The document is
a companion to a running demonstration hosted at emblem.red. It is intended to
explore the Digital Emblems (DIEM) architecture against the working group's use
cases and requirements; it is not a standards-track specification.


--- middle

# Introduction

Physical protective emblems, such as the distinctive emblems of the Red Cross,
Red Crescent, and Red Crystal, or the Blue Shield of cultural property, signal
to observers that the marked person, object, or place is entitled to specific
protection under a normative framework such as International Humanitarian Law
(IHL). Digital emblems extend this concept to network infrastructure: an
asset, identified by a Fully Qualified Domain Name (FQDN), can signal to a
validating entity that it should be protected or treated in a specific way.

The Digital Emblems (DIEM) working group is chartered, in its initial phase, to
address emblems that are discoverable via DNS and that identify their bearer by
an FQDN. The working group's use cases and requirements are captured in
{{?I-D.ietf-diem-requirements}}.

This document describes one concrete architecture that satisfies a useful
subset of those requirements, and it is deliberately paired with a running
demonstration hosted at emblem.red. The demonstration allows an operator to:

- **issue** a digital emblem for an FQDN,
- **verify** a digital emblem retrieved for an FQDN,
- **mark** an FQDN by publishing its emblem in DNS, and
- **unmark** an FQDN by removing that emblem from DNS.

The architecture models a digital emblem as a CBOR Web Token (CWT)
{{!RFC8392}} secured with a COSE single-signer structure ({{Section 4.2 of
!RFC9052}}), and delivers it over DNS using Service Binding (SVCB) resource
records {{!RFC9460}}. The choice of a compact, self-describing binary token and
a query-driven delivery channel is intended to keep validation possible in
constrained and partially disconnected environments.

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
: The signed CWT that carries the protective marking for an Asset.

Marking:
: The act of publishing an Emblem such that a Validator can discover it for a
  given FQDN.

Unmarking:
: The act of removing a previously published Emblem.

# Architecture Overview

The architecture defines four operations over an Asset identified by an FQDN.

~~~
+---------------+   issue    +-----------------+
| Emblem Issuer |----------->|  Emblem (CWT)   |
| (+ Authorizing|            |  COSE_Sign1     |
|    Entity)    |            +--------+--------+
+---------------+                     | mark (publish)
                                      v
                             +-----------------+
                             |  DNS (SVCB RR)  |
                             |  emblem.<fqdn>  |
                             +--------+--------+
                                      | query
                                      v
+---------------+  verify    +-----------------+
|   Validator   |<-----------|  Emblem (CWT)   |
+---------------+            +-----------------+
~~~
{: title="Information flow for the four operations"}

Issue:
: The Emblem Issuer, optionally acting under an Authorizing Entity, creates a
  CWT whose claims describe the protection asserted for the Asset, and signs it
  as a COSE_Sign1. See {{emblem-format}}.

Mark:
: The Emblem Issuer publishes the Emblem in DNS as an SVCB resource record for
  a name derived from the Asset's FQDN. See {{dns-delivery}}.

Verify:
: A Validator retrieves the Emblem for an FQDN, checks the COSE signature, and
  confirms that the Emblem was issued for that specific FQDN. See
  {{validation}}.

Unmark:
: The Emblem Issuer removes the SVCB resource record. See {{unmarking}}.

The architecture MUST NOT assume that a Validator has general Internet access
beyond the ability to resolve DNS for the queried name; this constraint follows
{{?I-D.ietf-diem-requirements}}. In particular, trust anchors and any material
required to check authorization are either provisioned out of band or carried
within the Emblem itself.

# Emblems as CBOR Web Tokens {#emblem-format}

An Emblem is a CWT {{!RFC8392}}. Claims are encoded as a CBOR {{!RFC8949}} map
using the integer keys from the CWT Claims registry. The token is protected as
a COSE_Sign1 structure {{!RFC9052}} using an algorithm from {{!RFC9053}}. When
fully tagged, the Emblem nests the CWT CBOR tag (61) around the COSE_Sign1 CBOR
tag (18).

The following claims are used:

| Emblem concept              | Claim | Key | Notes                              |
|-----------------------------|-------|:---:|------------------------------------|
| Protecting/issuing party    | iss   |  1  | Identifier of the Emblem Issuer    |
| Protected Asset             | sub   |  2  | The Asset FQDN (see below)         |
| Intended scope              | aud   |  3  | Optional                           |
| Not before                  | nbf   |  5  | Start of validity window           |
| Expiration                  | exp   |  4  | End of validity window             |
| Issued at                   | iat   |  6  | Issuance time                      |
| Emblem identifier           | cti   |  7  | Byte string, unique per Emblem     |
{: title="CWT claims used by the Emblem"}

The `sub` (2) claim MUST contain the FQDN of the marked Asset. This binds the
Emblem to a specific Asset and is the basis for the check in {{validation}}.

The signing key is identified by the COSE `kid` (label 4) header parameter in
the protected header. To allow a Validator to route or filter Emblems before
parsing the payload, an implementation MAY additionally surface selected claims
in the COSE header parameters as described in {{?RFC9597}}.

Additional protection semantics (for example, the kind of protection, a
jurisdiction, or a revocation pointer) MAY be carried as further CWT claims.
Interoperable semantics for such claims are out of scope for this demonstration
and would be defined by the working group.

# Delivering Emblems over DNS with SVCB {#dns-delivery}

The Emblem is delivered over DNS using a Service Binding (SVCB) resource record
{{!RFC9460}}. The record is published at a name derived from the Asset FQDN;
the demonstration uses the owner name `emblem.<fqdn>`.

The record MUST be in ServiceMode (SvcPriority nonzero); AliasMode records
ignore SvcParams and cannot carry the Emblem. The Emblem is carried in a
private-use SvcParamKey in the range 65280-65534 {{Section 14.3.2 of
!RFC9460}}; the demonstration uses `key65280`.

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

The Emblem's SvcParamKey MUST NOT be listed in the `mandatory` SvcParamKey
({{Section 8 of !RFC9460}}). Listing it there would cause clients that do not
understand the key to discard the entire record; leaving it out allows records
to degrade gracefully for non-DIEM consumers.

## Size and transport {#size}

A signed Emblem will routinely exceed the classic 512-octet DNS message limit.
Deployments MUST support EDNS(0) {{!RFC6891}} to advertise a larger reassembly
buffer (a starting value of 4096 octets is RECOMMENDED), and MUST fall back to
TCP when the truncation (TC) bit is set. The absolute ceiling on a single
record's RDATA is 65535 octets, imposed by the 16-bit RDLENGTH field
({{!RFC1035}}).

# Marking and Unmarking {#unmarking}

Marking an Asset consists of publishing the SVCB record described in
{{dns-delivery}}. Unmarking consists of removing that record so that a query
for `emblem.<fqdn>` no longer returns an Emblem.

The DIEM requirements identify a stronger "Removable" property in which removal
leaves no evidence that an Emblem was ever applied
({{?I-D.ietf-diem-requirements}}). Simple record deletion does not by itself
achieve this against an adversary with access to historical DNS data (for
example, passive DNS or cached zone transfers). An implementation that requires
the Removable property MUST specify a threat model and address such historical
observability; the demonstration does not claim this property.

# Validation {#validation}

A Validator processes an FQDN as follows:

1. Query DNS for an SVCB record at `emblem.<fqdn>`, using EDNS(0) and TCP
   fallback as described in {{size}}.
2. Extract the Emblem octets from the private-use SvcParamKey.
3. Parse the COSE_Sign1 and verify the signature using a key identified by the
   `kid` header and obtained from a trust anchor established out of band.
4. Confirm that the `sub` (2) claim equals the queried FQDN. If it does not,
   the Emblem MUST be rejected for that Asset.
5. Check the validity window using `nbf` (5) and `exp` (4) against the current
   time.

Step 4 satisfies the requirement that validation, when defined, ensures the
Emblem was issued for the respective Asset. A deployment MAY choose to treat an
Emblem as unverified (skipping step 3) where its use case permits, as allowed
by {{?I-D.ietf-diem-requirements}}.

# Relationship to DIEM Requirements

This architecture is intended to exercise the following requirements from
{{?I-D.ietf-diem-requirements}}:

- Format: the Emblem identifies the marked Asset by FQDN (`sub`) and is a
  self-describing CWT of minimal size overhead.
- Discovery: a Validator determines whether an Asset bears an Emblem by
  querying a well-known SVCB owner name.
- Validation: the signature check plus the `sub`-equals-FQDN check ensure the
  Emblem was issued for the Asset.
- Authorization: the trust model relies on out-of-band trust anchors and does
  not assume general Internet access; key compromise is addressed by short
  validity windows and re-issuance.

The Removable and Undetectable Validation properties are explicitly not
provided by this demonstration.

# Security Considerations

The integrity and authenticity of an Emblem derive entirely from the COSE
signature; DNS is used only as a delivery channel and is not trusted to attest
to the Emblem. Validators SHOULD, where available, use DNSSEC to detect
tampering with the delivery channel, but MUST NOT rely on DNSSEC in place of
verifying the COSE signature.

Because the Emblem is a bearer object, any party that can retrieve it can
present it. Binding the Emblem to the Asset via the `sub` claim prevents an
Emblem issued for one FQDN from being accepted for another, but it does not
prevent replay of an Emblem for the FQDN it names. Short validity windows
(`nbf`/`exp`) and re-issuance limit the impact of key compromise; a deployment
that needs stronger guarantees requires a revocation mechanism, which is out of
scope for this demonstration.

Unmarking by record deletion does not erase historical observations of a
published Emblem; see {{unmarking}}.

# IANA Considerations

This document has no IANA actions. The demonstration uses a private-use
SvcParamKey ({{Section 14.3.2 of !RFC9460}}), which does not require
registration.


--- back

# Acknowledgments
{:numbered="false"}

This work builds on the DIEM working group's use cases and requirements and on
prior experiments in transparent digital emblems.
