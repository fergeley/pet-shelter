import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// 1. Heading Font
const playfairDisplayHeading = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

// 2. Primary Body & UI Font
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// 3. Technical & Metric Mono Font
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hope for Strays | Animal Rescue & Adoption (Petaling Jaya, Selangor)",
  description:
    "Hope for Strays is a non-profit animal shelter in Petaling Jaya, Selangor. Adopt rescued dogs, cats, puppies, and kittens with complete veterinary care and vaccination.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        "h-full antialiased",
        geistSans.variable,
        geistMono.variable,
        playfairDisplayHeading.variable
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('hope_for_strays_theme');
                const isDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-zinc-200/80 dark:bg-zinc-950 text-foreground font-sans selection:bg-zinc-900 selection:text-zinc-50 dark:selection:bg-zinc-100 dark:selection:text-zinc-900 p-2.5 sm:p-5 md:p-8 lg:p-10">
        <ThemeProvider defaultTheme="system" storageKey="hope_for_strays_theme">
          {/* Centered Application Frame with Softer Gray Tones */}
          <div className="mx-auto w-full max-w-6xl xl:max-w-7xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-xs flex flex-col min-h-[calc(100vh-1.25rem)] sm:min-h-[calc(100vh-2.5rem)] md:min-h-[calc(100vh-4rem)]">
            <Navbar />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
