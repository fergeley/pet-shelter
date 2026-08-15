"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PawPrint, Lock, ArrowLeft, AlertCircle, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("admin@hopeforstrays.org");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    await new Promise((r) => setTimeout(r, 400));
    const success = login(email, password);

    if (success) {
      router.push("/admin/pets");
    } else {
      setError("Invalid staff email or password. Use demo credentials shown below.");
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setEmail("admin@hopeforstrays.org");
    setPassword("admin123");
    const success = login("admin@hopeforstrays.org", "admin123");
    if (success) {
      router.push("/admin/pets");
    }
  };

  return (
    <div className="min-h-screen bg-card flex flex-col justify-center py-12 px-6 sm:px-8 lg:px-10">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6 focus-visible:ring-2"
        >
          <ArrowLeft className="size-4" />
          Back to Public Shelter Site
        </Link>

        {/* Logo & Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground leading-tight">
              Hope for Strays
            </h1>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Staff & Coordinator Admin Portal
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border border-border bg-background p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Sign In to Management Portal
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Manage adoptable animals, review adoption applications, and update shelter announcements.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider">Staff Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hopeforstrays.org"
                className="text-sm py-2.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-sm py-2.5 font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-xs font-semibold uppercase tracking-wider py-2.5 mt-2 focus-visible:ring-2"
            >
              <Lock className="size-3.5 mr-1.5" />
              {isSubmitting ? "Authenticating..." : "Sign In to Admin Portal"}
            </Button>
          </form>

          {/* Demo Access Card */}
          <div className="border-t border-border pt-4 bg-muted/30 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="size-4 text-emerald-800 dark:text-emerald-400" />
              <span>Quick Demo Staff Access</span>
            </div>
            <p className="text-muted-foreground">
              Email: <code className="bg-background px-1.5 py-0.5 border border-border font-mono text-foreground">admin@hopeforstrays.org</code><br />
              Password: <code className="bg-background px-1.5 py-0.5 border border-border font-mono text-foreground">admin123</code> (or PIN <code className="bg-background px-1.5 py-0.5 border border-border font-mono text-foreground">1234</code>)
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleQuickDemoLogin}
              className="w-full text-xs font-semibold mt-1"
            >
              1-Click Demo Staff Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
