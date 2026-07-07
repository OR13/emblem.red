# emblem.red — Product & Brand Context

**Register: brand.** The homepage is identity-facing: its job is to make a
visitor understand and feel what a *digital emblem* is, then let them try it.
Design communicates the concept; it doesn't just expose a form.

## What it is

A working demonstration companion to `draft-steele-diem-architecture-demo`,
tracking the IETF **DIEM** (Digital Emblems) working group. It lets you issue,
publish (mark), verify, and remove (unmark) a **CWT-based digital emblem** for a
domain, delivered entirely over DNS **SVCB** records and verified by its COSE
(ES256) signature.

## The idea that must land

Under International Humanitarian Law, the **Red Cross, Red Crescent, and Red
Crystal** are *protective emblems*: symbols that mark protected people and
places in conflict. A digital emblem carries that same intent into networked
systems: a cryptographically signed, DNS-discoverable marker that binds a
protected status to a domain name (FQDN). This is not a toy dev tool; it is a
demo of a protocol with humanitarian weight.

## Audience

IETF participants, DNS and security engineers, and humanitarian-technology
people evaluating the DIEM architecture. They are technical and skeptical; the
page must be precise and credible, and never gimmicky.

## Personality

**Bold · Experimental · Crafted** — and, given the subject, **authoritative and
precise**. Institutional gravity (treaty / standards-document seriousness)
expressed with modern craft. The protective emblem (the red cross/plus) is the
core visual motif.

## Voice

Plain, exact, standards-literate. Name the real RFCs and the real WG. No
marketing buzzwords. The emblem is "presented" and "validated," domains are
"marked" and "unmarked" — use the protocol's own verbs.

## Non-negotiables

- The Issue / Mark / Verify / Unmark tool stays fully functional.
- Links to the IETF DIEM WG, charter, datatracker documents, and the
  `ietf-wg-diem` GitHub org are present and correct.
- `/verify/<domain>` permalinks are a first-class entry point.
- Not for production use; say so.
