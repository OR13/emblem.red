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
area: "Security"
workgroup: "Digital Emblems"
keyword:
 - digital emblem
 - CWT
 - COSE
 - DNS
 - SVCB
 - protective marking
venue:
  github: "OR13/emblem.red"
  latest: "https://emblem.red/draft-steele-diem-architecture-demo.html"

author:
 -
    fullname: "Orie Steele"
    organization: Tradeverifyd
    email: "orie@tradeverifyd.com"

normative:
  RFC8392: # CWT
  RFC9052: # COSE
  RFC9460: # SVCB/HTTPS RRs
  RFC1035: # DNS
  RFC8949: # CBOR

informative:


--- abstract

This document describes a demonstration architecture for issuing, verifying,
marking, and unmarking Fully Qualified Domain Names (FQDNs) with digital
emblems. A digital emblem is modeled as a CBOR Web Token (CWT) secured with
COSE and is delivered entirely over the Domain Name System (DNS) using Service
Binding (SVCB) resource records, including a mechanism for cleanly conveying
binary token material. This document is a companion to a running demonstration
and is intended to explore the digital emblems (DIEM) architecture and use
cases; it is not a standards-track specification.


--- middle

# Introduction

TODO Introduction.

# Conventions and Definitions

{::boilerplate bcp14-tagged}

# Architecture Overview

TODO actors and flows: issue, verify, mark, unmark.

# Emblems as CBOR Web Tokens

TODO CWT claims and COSE protection.

# Delivering Emblems over DNS with SVCB

TODO SVCB record layout and clean binary delivery.

# Security Considerations

TODO Security considerations.

# IANA Considerations

This document has no IANA actions.


--- back

# Acknowledgments
{:numbered="false"}

TODO acknowledge.
