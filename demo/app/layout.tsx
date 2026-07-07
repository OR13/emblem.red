import type { Metadata } from "next";
import { Nunito_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const fontSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontHeading = Nunito_Sans({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-heading",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "emblem.red — digital emblems, delivered over DNS",
  description:
    "Issue, mark, verify, and unmark domains with CWT-based digital emblems carried in the asset's own HTTPS DNS record. A demonstration companion to the IETF DIEM working group.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        fontSans.variable,
        fontHeading.variable,
        fontMono.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
