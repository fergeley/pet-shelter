"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Heart, Menu, Sparkles, HeartHandshake } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PetMatchQuiz } from "@/components/PetMatchQuiz";
import { SponsorshipModal } from "@/components/SponsorshipModal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);

  const navLinks = [
    { href: "/pets", label: "Adoptable Pets" },
    { href: "/bulletins", label: "Updates & News" },
    { href: "/#how-it-works", label: "Adoption Process" },
    { href: "/#mission", label: "About Us" },
    { href: "/#support", label: "Foster & Donate" },
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
                Petaling Jaya, Selangor
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
              className="text-xs font-semibold gap-1.5 h-8 px-2.5 border-primary/30 bg-primary/5 hover:bg-primary/10"
            >
              <Sparkles className="size-3.5 text-primary" />
              Find Match
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSponsorshipOpen(true)}
              className="text-xs font-semibold gap-1.5 h-8 px-2.5"
            >
              <HeartHandshake className="size-3.5" />
              Sponsor
            </Button>

            <ThemeToggle />

            <Link
              href="/pets"
              className={buttonVariants({
                size: "sm",
                className: "text-xs font-semibold uppercase tracking-wider gap-1.5 h-8 px-3.5 focus-visible:ring-2",
              })}
            >
              <Heart className="size-3.5 fill-current" />
              Adopt
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQuizOpen(true)}
              className="h-8 px-2 text-xs font-bold gap-1"
            >
              <Sparkles className="size-3" />
              Quiz
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMobileOpen(false);
                      setIsQuizOpen(true);
                    }}
                    className="w-full justify-center text-xs font-bold gap-1.5 border-primary/40 bg-primary/5"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    Take Match Quiz
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMobileOpen(false);
                      setIsSponsorshipOpen(true);
                    }}
                    className="w-full justify-center text-xs font-bold gap-1.5"
                  >
                    <HeartHandshake className="size-3.5" />
                    Sponsor Rescue Care
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
                    <p className="font-medium text-foreground">Phone: 03-7876 5432</p>
                    <p>Tue–Sun: 10:00 AM – 5:00 PM</p>
                    <p>Petaling Jaya, Selangor</p>
                    <Link
                      href="/pets"
                      onClick={() => setIsMobileOpen(false)}
                      className={buttonVariants({
                        className: "w-full mt-2 justify-center text-xs font-semibold uppercase tracking-wider",
                      })}
                    >
                      Browse Pets
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
