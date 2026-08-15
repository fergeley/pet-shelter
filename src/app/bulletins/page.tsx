import { Metadata } from "next";
import { BulletinFeed } from "@/components/BulletinFeed";

export const metadata: Metadata = {
  title: "Bulletins & Updates | Hope for Strays (Petaling Jaya)",
  description: "Stay updated on shelter clinics, urgent foster needs, volunteer events, and rescue stories from Hope for Strays in Petaling Jaya, Selangor.",
};

export default function BulletinsPage() {
  return (
    <div className="min-h-screen bg-card py-12 sm:py-16">
      <div className="w-full px-6 sm:px-8 lg:px-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Shelter Updates & Bulletins
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
            Community spay/neuter clinic schedules, urgent foster requests, and video updates from our rescue sanctuary in Petaling Jaya.
          </p>
        </div>

        {/* Full Feed with Admin Controls */}
        <BulletinFeed targetPage="all" title="All Community Notices" />
      </div>
    </div>
  );
}
