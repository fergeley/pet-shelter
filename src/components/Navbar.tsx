"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PawPrint, Heart, Menu, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
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

  const navLinks = [
    { href: "/pets", label: "Adoptable Pets" },
    { href: "/bulletins", label: "Updates & News" },
    { href: "/#how-it-works", label: "Adoption Process" },
    { href: "/#mission", label: "About Us" },
    { href: "/#support", label: "Foster & Donate" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-6 sm:px-8 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 focus-visible:ring-2">
          <div className="flex size-9 items-center justify-center bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
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
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main Navigation">
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
        <div className="hidden items-center gap-3.5 lg:flex">
          <ThemeToggle />

          <a
            href="tel:+60378765432"
            className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline focus-visible:ring-2"
          >
            <Phone className="size-3.5 text-foreground/80" />
            03-7876 5432
          </a>

          <Link
            href="/pets"
            className={buttonVariants({
              size: "sm",
              className: "text-xs font-semibold uppercase tracking-wider gap-1.5 focus-visible:ring-2",
            })}
          >
            <Heart className="size-3.5 fill-current" />
            Adopt
          </Link>
        </div>

        {/* Mobile Menu */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Link
            href="/pets"
            className={buttonVariants({
              variant: "outline",
              size: "xs",
              className: "text-xs font-medium",
            })}
          >
            Adopt
          </Link>
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
                  <PawPrint className="size-5 text-foreground" />
                  <SheetTitle className="font-heading text-base font-bold">Hope for Strays</SheetTitle>
                </div>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-6 py-4">
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
  );
}
