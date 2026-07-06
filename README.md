<!-- regenerate: off (set to on to let i-d-template regenerate this file) -->

# emblem.red — DNS-Delivered Digital Emblems

This repository holds two things that are kept in sync:

1. **The Internet-Draft** `draft-steele-diem-architecture-demo` — *"An Architecture
   for DNS-Delivered Digital Emblems (Demonstration)"*, at the repository root.
2. **A running demo** (`demo/`) — a small Next.js app that issues, verifies,
   marks, and unmarks DNS names with a CWT-based digital emblem delivered over
   DNS SVCB records.

The draft explores the IETF [DIEM](https://datatracker.ietf.org/group/diem/about/)
architecture and use cases; the demo is its executable companion.

## The Draft

* [Editor's Copy](https://or13.github.io/emblem.red/#go.draft-steele-diem-architecture-demo.html)
* [Datatracker Page](https://datatracker.ietf.org/doc/draft-steele-diem-architecture-demo)
* [Individual Draft](https://datatracker.ietf.org/doc/html/draft-steele-diem-architecture-demo)
* [Compare Editor's Copy to Individual Draft](https://or13.github.io/emblem.red/#go.draft-steele-diem-architecture-demo.diff)

### Building the draft

Formatted text and HTML versions are built with `make`:

```sh
make
```

This requires `kramdown-rfc` (Ruby) and `xml2rfc` (Python 3.10+); see the
[i-d-template setup instructions](https://github.com/martinthomson/i-d-template/blob/main/doc/SETUP.md).
On a machine where `python3` cannot build a venv (e.g. a shimmed interpreter),
point the build at a real interpreter:

```sh
make PY=/opt/homebrew/bin/python3.13
```

CI (`.github/workflows/ghpages.yml`) builds the editor's copy and publishes it
to the `gh-pages` branch on every push to `main`.

## The Demo (`demo/`)

A single-page app with four operations over an Asset FQDN:

| Operation | What it does |
|-----------|--------------|
| **Issue**  | Sign a CWT ([RFC 8392](https://www.rfc-editor.org/rfc/rfc8392)) as a COSE_Sign1 ([RFC 9052](https://www.rfc-editor.org/rfc/rfc9052), ES256) with `sub` = the FQDN. |
| **Mark**   | Publish the emblem as an SVCB record ([RFC 9460](https://www.rfc-editor.org/rfc/rfc9460)) at `emblem.<fqdn>`, in a private-use SvcParamKey (`key65280`), binary-clean. |
| **Verify** | Discover the emblem (DNS-over-HTTPS SVCB query, or pasted), check the COSE signature, the validity window, and that `sub` == the queried FQDN. |
| **Unmark** | Remove the SVCB record. |

The emblem's raw COSE/CBOR bytes are carried directly in the SvcParam value; in
zone-file form binary is escaped byte-by-byte as `\DDD` (RFC 9460 §2.1).

### Run locally

```sh
cd demo
npm install
npm run dev
```

### Deploy on Vercel

Import the repo and set the project **Root Directory** to `demo`. Optional
environment variables:

| Variable | Purpose |
|----------|---------|
| `EMBLEM_ISSUER_JWK` | Private P-256 JWK (JSON) for the issuer key. If unset, a committed **insecure demo key** is used so issue/verify stay consistent. |
| `EMBLEM_ISSUER_KID` | Key id for the issuer (default `emblem-demo-1`). |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | Enable **Mark/Unmark** to write real SVCB records. Without them, the app returns the record to publish manually. |

> The demo performs real cryptography but ships an insecure, public issuer key
> by default. It is a demonstration, not a production service.

## Contributing

See the [guidelines for contributions](https://github.com/OR13/emblem.red/blob/main/CONTRIBUTING.md).

## License

The draft is under the IETF Trust license (see `LICENSE.md`); prior demo code
was Apache-2.0 (see `LICENSE`).
