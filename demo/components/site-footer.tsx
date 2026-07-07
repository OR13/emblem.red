import { BrandMark } from "@/components/brand-mark";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Working group",
    links: [
      { label: "DIEM working group", href: "https://datatracker.ietf.org/group/diem/about/" },
      { label: "Charter", href: "https://datatracker.ietf.org/doc/charter-ietf-diem/" },
      { label: "Datatracker documents", href: "https://datatracker.ietf.org/group/diem/documents/" },
      { label: "GitHub · ietf-wg-diem", href: "https://github.com/ietf-wg-diem" },
    ],
  },
  {
    heading: "This demo",
    links: [
      {
        label: "Architecture draft",
        href: "https://or13.github.io/emblem.red/draft-steele-diem-architecture-demo.html",
      },
      { label: "Contribute · OR13/emblem.red", href: "https://github.com/OR13/emblem.red" },
      { label: "Issues", href: "https://github.com/OR13/emblem.red/issues" },
    ],
  },
  {
    heading: "Specifications",
    links: [
      { label: "RFC 8392 · CWT", href: "https://www.rfc-editor.org/rfc/rfc8392" },
      { label: "RFC 9052 · COSE", href: "https://www.rfc-editor.org/rfc/rfc9052" },
      { label: "RFC 9460 · SVCB/HTTPS", href: "https://www.rfc-editor.org/rfc/rfc9460" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="font-heading text-base font-extrabold tracking-tight">emblem.red</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            A demonstration companion to the IETF DIEM working group. Not for production use.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {col.heading}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-5 py-4 text-xs text-muted-foreground">
          Emblems are CBOR Web Tokens (RFC 8392) protected with COSE (RFC 9052), carried in the
          asset&apos;s own HTTPS record (RFC 9460).
        </div>
      </div>
    </footer>
  );
}
