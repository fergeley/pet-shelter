import { Suspense } from "react";
import type { Metadata } from "next";
import { NotificationPreferencesClient } from "./NotificationPreferencesClient";

export const metadata: Metadata = {
  title: "Email Preferences | Hope for Strays",
  description: "Manage which emails you receive from Hope for Strays Animal Shelter.",
  // A page addressed by a personal token must never be indexed.
  robots: { index: false, follow: false },
};

export default function NotificationPreferencesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Your email preferences
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Hope for Strays Animal Shelter, Petaling Jaya.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="py-12 text-sm text-muted-foreground">Loading your preferences…</div>
        }
      >
        <NotificationPreferencesClient />
      </Suspense>
    </main>
  );
}
