"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/adminAuth";
import { 
  PawPrint, 
  Dog, 
  FileText, 
  Settings, 
  LogOut, 
  ExternalLink, 
  Bell,
  ShieldCheck,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAdminAuth();

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push("/admin/login");
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-card flex flex-col items-center justify-center p-8 space-y-3">
        <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground animate-pulse">
          <PawPrint className="size-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verifying Staff Session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navLinks = [
    { href: "/admin/pets", label: "Pet Management (CRUD)", icon: Dog },
    { href: "/admin/applications", label: "Adoption Applications", icon: FileText },
    { href: "/admin/faqs", label: "FAQ Knowledge Base", icon: HelpCircle },
    { href: "/admin/audit", label: "Audit & Security Logs", icon: ShieldCheck },
    { href: "/admin/settings", label: "Shelter Settings", icon: Settings },
    { href: "/bulletins", label: "Community Bulletins", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-card flex flex-col">
      {/* Top Admin Header */}
      <header className="border-b border-border bg-background px-6 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center bg-primary text-primary-foreground">
            <PawPrint className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-bold tracking-tight text-foreground">
                Hope for Strays
              </span>
              <span className="bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/80 border border-border">
                Staff Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Petaling Jaya Sanctuary • Logged in as <strong className="text-foreground">{user?.name}</strong>
            </p>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 bg-background"
          >
            <ExternalLink className="size-3.5" />
            Live Public Site
          </Link>

          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              logout();
              router.push("/admin/login");
            }}
            className="text-xs gap-1 font-semibold text-destructive hover:text-destructive"
          >
            <LogOut className="size-3" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-border bg-muted/30 px-6 sm:px-8">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Admin Tabs">
          {navLinks.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href || (tab.href === "/admin/pets" && pathname === "/admin");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Admin Content Container */}
      <main className="flex-1 w-full p-6 sm:p-8 lg:p-10">
        {children}
      </main>
    </div>
  );
}
