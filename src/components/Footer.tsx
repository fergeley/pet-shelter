import Link from "next/link";
import { PawPrint, MapPin, Phone, Mail, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Footer() {
  return (
    <footer className="border-t border-border bg-zinc-100 dark:bg-zinc-950 text-foreground">
      <div className="w-full px-6 py-12 sm:px-8 sm:py-14 lg:px-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 md:grid-cols-2">
          {/* Column 1: Organization */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center bg-primary text-primary-foreground">
                <PawPrint className="size-4.5" />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight">
                Hope for Strays
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A registered non-profit animal rescue organisation serving Petaling Jaya and the greater Selangor area since 2016. Dedicated to rescuing, rehabilitating, and rehoming homeless dogs and cats.
            </p>
          </div>

          {/* Column 2: Navigation Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/pets" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Adoptable Dogs & Cats
                </Link>
              </li>
              <li>
                <Link href="/applications/track" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Track Adoption Application
                </Link>
              </li>
              <li>
                <Link href="/bulletins" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Shelter Updates & Bulletins
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Adoption Process & Fees
                </Link>
              </li>
              <li>
                <Link href="/#support" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Foster a Rescue Pet
                </Link>
              </li>
              <li>
                <Link href="/donate" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Shelter Wishlist & Donations
                </Link>
              </li>
              <li>
                <Link href="/admin/login" className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium">
                  Staff & Volunteer Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hours */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
              Visiting Hours
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <Clock className="size-4 text-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground">Tuesday – Sunday</p>
                  <p className="font-medium">10:00 AM – 5:00 PM</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Closed Mondays for sanctuary deep cleaning</p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 4: Location & Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
              Location & Contact
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <MapPin className="size-4 text-foreground shrink-0 mt-0.5" />
                <span className="leading-relaxed">No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-foreground shrink-0" />
                <a href="tel:+60378765432" className="text-foreground hover:underline font-semibold">
                  03-7876 5432
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-foreground shrink-0" />
                <a href="mailto:info@hopeforstrays.org" className="text-foreground hover:underline font-semibold">
                  info@hopeforstrays.org
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Hope for Strays (Persatuan Harapan Haiwan Terbiar Selangor).</p>
          <div className="flex items-center gap-4">
            <Link href="/admin/login" className="text-xs font-semibold hover:text-foreground hover:underline">
              Staff & Volunteer Login
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <p className="font-mono text-xs">ROS Reg: PPM-012-10-18042016</p>
            <ThemeToggle showLabel={true} />
          </div>
        </div>
      </div>
    </footer>
  );
}
