"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Heart, Menu, HeartHandshake, Compass } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/providers/ThemeToggle";
import { LanguageToggle } from "@/components/providers/LanguageToggle";
import { PetMatchQuiz } from "@/components/features/pets/PetMatchQuiz";
import { SponsorshipModal } from "@/components/features/pets/SponsorshipModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);

  const navLinks = [
    { href: "/pets", label: t("nav.adoptablePets", "Adoptable Pets") },
    { href: "/donate", label: t("nav.donate", "Donate") },
    { href: "/applications/track", label: t("nav.trackApplication", "Track Application") },
    { href: "/bulletins", label: t("nav.bulletins", "Updates & News") },
    { href: "/faq", label: t("nav.faq", "FAQ") },
    { href: "/#how-it-works", label: t("nav.adoptionProcess", "Adoption Process") },
    { href: "/#support", label: t("nav.volunteerFoster", "Volunteer & Foster") },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-6 sm:px-8 lg:px-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 focus-visible:ring-2">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-[1rem] bg-[#f8dfd7] text-primary-foreground shadow-[0_8px_16px_rgba(214,122,111,0.18)] ring-1 ring-[#edc9c0] dark:bg-[#382d2d] dark:ring-[#5b4040]">
              <Image src="/android-icon-192x192.png" alt="Hope for Strays" width={36} height={36} className="h-full w-full object-cover" priority />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold tracking-tight text-foreground leading-tight">
                Hope for Strays
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {t("nav.sanctuaryLocation", "Petaling Jaya, Selangor")}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href) && !link.href.includes("#");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-foreground focus-visible:ring-2 ${
                    isActive
                      ? "text-foreground font-semibold border-b-2 border-foreground pb-0.5"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Action */}
          <div className="hidden items-center gap-3 lg:flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQuizOpen(true)}
              className="text-xs font-semibold gap-1.5 h-8 px-2.5 cursor-pointer"
            >
              <Compass className="size-3.5" />
              {t("nav.matchQuiz", "Match Quiz")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSponsorshipOpen(true)}
              className="text-xs font-semibold gap-1.5 h-8 px-2.5 cursor-pointer"
            >
              <HeartHandshake className="size-3.5" />
              {t("nav.sponsor", "Sponsor")}
            </Button>

            <LanguageToggle />
            <ThemeToggle />

            <Link
              href="/pets"
              className={buttonVariants({
                size: "sm",
                className: "text-xs font-semibold uppercase tracking-wider gap-1.5 h-8 px-3.5 focus-visible:ring-2",
              })}
            >
              <Heart className="size-3.5 fill-current" />
              {t("nav.adopt", "Adopt")}
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageToggle showIcon={false} />
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQuizOpen(true)}
              className="h-8 px-2 text-xs font-bold gap-1 cursor-pointer"
            >
              <Compass className="size-3" />
              {t("nav.matchQuiz", "Quiz")}
            </Button>
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger
                className="inline-flex size-9 items-center justify-center text-foreground hover:bg-muted focus-visible:ring-2"
                aria-label="Open Navigation Menu"
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[290px] bg-card">
                <SheetHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex size-6 items-center justify-center overflow-hidden rounded-sm bg-primary/10 ring-1 ring-border">
                      <Image src="/android-icon-192x192.png" alt="Hope for Strays" width={24} height={24} className="h-full w-full object-cover" />
                    </div>
                    <SheetTitle className="font-heading text-base font-bold">Hope for Strays</SheetTitle>
                  </div>
                </SheetHeader>
                <div className="flex flex-col gap-3 px-6 py-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">Bahasa / Language</span>
                    <LanguageToggle />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMobileOpen(false);
                      setIsQuizOpen(true);
                    }}
                    className="w-full justify-center text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Compass className="size-3.5" />
                    {t("nav.matchQuiz", "Pet Compatibility Quiz")}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMobileOpen(false);
                      setIsSponsorshipOpen(true);
                    }}
                    className="w-full justify-center text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <HeartHandshake className="size-3.5" />
                    {t("nav.sponsor", "Sponsor Rescue Care")}
                  </Button>

                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileOpen(false)}
                      className="text-sm font-medium py-1.5 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Phone: {t("nav.phone", "03-7876 5432")}</p>
                    <p>{t("nav.visitingHours", "Tue–Sun: 10:00 AM – 5:00 PM")}</p>
                    <p>{t("nav.sanctuaryLocation", "Petaling Jaya, Selangor")}</p>
                    <Link
                      href="/pets"
                      onClick={() => setIsMobileOpen(false)}
                      className={buttonVariants({
                        className: "w-full mt-2 justify-center text-xs font-semibold uppercase tracking-wider",
                      })}
                    >
                      {t("nav.browsePets", "Browse Pets")}
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Global Modals from Navbar */}
      <PetMatchQuiz
        open={isQuizOpen}
        onOpenChange={setIsQuizOpen}
      />

      <SponsorshipModal
        open={isSponsorshipOpen}
        onOpenChange={setIsSponsorshipOpen}
      />
    </>
  );
}
