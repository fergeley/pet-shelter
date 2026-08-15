"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { lookupApplicationStatusAction } from "@/actions/applications";
import { PublicApplicationTrackingDTO } from "@/lib/validations/applicationTracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Heart,
  Phone,
  MessageCircle,
  AlertCircle,
  Loader2,
  FileCheck2,
  ChevronRight,
  ShieldCheck,
  Building,
} from "lucide-react";

function ApplicationTrackerContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || "";
  const initialEmail = searchParams.get("email") || "";

  const [referenceId, setReferenceId] = useState(initialRef);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicApplicationTrackingDTO | null>(null);

  const handleLookup = useCallback(async (lookupRef: string, lookupEmail: string) => {
    if (!lookupRef.trim() || !lookupEmail.trim()) {
      setError("Please enter both your Application Reference ID and Email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await lookupApplicationStatusAction({
        referenceId: lookupRef.trim(),
        email: lookupEmail.trim(),
      });

      if (!res.success || !res.data) {
        setError(res.error || "No matching application found. Please verify your details.");
        setResult(null);
      } else {
        setResult(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to query application status.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (initialRef && initialEmail) {
      lookupApplicationStatusAction({
        referenceId: initialRef.trim(),
        email: initialEmail.trim(),
      })
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.data) {
            setResult(res.data);
          } else {
            setError(res.error || "No matching application found.");
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err instanceof Error ? err.message : "Failed to query application status.");
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialRef, initialEmail]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(referenceId, email);
  };

  // Determine active step index (0 to 3)
  const getStepIndex = (status: string, hasInterview?: boolean) => {
    if (status === "APPROVED") return 3;
    if (hasInterview) return 2;
    if (status === "UNDER_REVIEW") return 1;
    return 0;
  };

  const currentStep = result
    ? getStepIndex(result.status, Boolean(result.interviewDetails))
    : 0;

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="size-3.5" /> Adopter Self-Service Portal
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Track Adoption Application
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Check the live review status, scheduled meet-and-greet sessions, and finalization instructions for your shelter adoption inquiry.
          </p>
        </div>

        {/* Lookup Card */}
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="referenceId" className="text-xs font-semibold">
                  Application Reference ID *
                </Label>
                <Input
                  id="referenceId"
                  placeholder="e.g. app-1723738192000"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="font-mono text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Applicant Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-semibold uppercase tracking-wider text-xs py-2.5 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Querying Records...
                </>
              ) : (
                <>
                  <Search className="size-4" /> Check Application Status
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2.5 animate-in">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Result & Progress Stepper */}
        {result && (
          <div className="space-y-6 animate-in">
            
            {/* Target Rescue Summary Card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {result.petImage ? (
                <div className="relative size-20 sm:size-24 rounded-lg overflow-hidden shrink-0 border border-border">
                  <Image
                    src={result.petImage}
                    alt={result.petName}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="size-20 sm:size-24 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Heart className="size-8 text-muted-foreground" />
                </div>
              )}

              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-xl font-bold text-foreground">
                    {result.petName}
                  </h2>
                  {result.petBreed && (
                    <span className="text-xs text-muted-foreground font-medium">
                      &bull; {result.petBreed}
                    </span>
                  )}
                  <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    100% Free Adoption
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Applicant: <strong>{result.applicantName}</strong> &bull; Reference:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">
                    {result.id}
                  </code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Submitted on: <strong>{result.createdAt}</strong> &bull; Last Updated:{" "}
                  <strong>{result.updatedAt}</strong>
                </p>
              </div>

              {result.petId && (
                <Link
                  href={`/pets/${result.petId}`}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  View Profile <ChevronRight className="size-3.5" />
                </Link>
              )}
            </div>

            {/* Stepper Timeline (if not rejected) */}
            {result.status !== "REJECTED" ? (
              <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-2">
                  Adoption Review Timeline
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                  
                  {/* Step 1 */}
                  <div
                    className={`p-4 rounded-lg border text-center space-y-1.5 transition-colors ${
                      currentStep >= 0
                        ? "bg-primary/5 border-primary/40 text-primary"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className="size-5 mx-auto text-primary" />
                    <p className="text-xs font-bold uppercase">1. Received</p>
                    <p className="text-[11px] text-muted-foreground">In Queue</p>
                  </div>

                  {/* Step 2 */}
                  <div
                    className={`p-4 rounded-lg border text-center space-y-1.5 transition-colors ${
                      currentStep >= 1
                        ? "bg-primary/5 border-primary/40 text-primary"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    <Clock
                      className={`size-5 mx-auto ${
                        currentStep >= 1 ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-xs font-bold uppercase">2. Review</p>
                    <p className="text-[11px] text-muted-foreground">Coordinator Screen</p>
                  </div>

                  {/* Step 3 */}
                  <div
                    className={`p-4 rounded-lg border text-center space-y-1.5 transition-colors ${
                      currentStep >= 2
                        ? "bg-primary/5 border-primary/40 text-primary"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    <Calendar
                      className={`size-5 mx-auto ${
                        currentStep >= 2 ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-xs font-bold uppercase">3. Meet & Greet</p>
                    <p className="text-[11px] text-muted-foreground">Interaction</p>
                  </div>

                  {/* Step 4 */}
                  <div
                    className={`p-4 rounded-lg border text-center space-y-1.5 transition-colors ${
                      currentStep >= 3
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    <Heart
                      className={`size-5 mx-auto ${
                        currentStep >= 3 ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-xs font-bold uppercase">4. Approved</p>
                    <p className="text-[11px] text-muted-foreground">Homebound</p>
                  </div>
                </div>

                {/* Scheduled Interview Card */}
                {result.interviewDetails && (
                  <div className="p-5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-200 space-y-3 animate-in">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-sky-600 dark:text-sky-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Scheduled Meet & Greet Appointment
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Date & Time:</span>
                        <p className="font-semibold">
                          📅 {result.interviewDetails.interviewDate} at {result.interviewDetails.interviewTime}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Format:</span>
                        <p className="font-semibold">
                          📍 {result.interviewDetails.meetingType === "video_call" ? "Virtual Video Call" : "In-Person Shelter Visit"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Location / Link:</span>
                        <p className="font-semibold">{result.interviewDetails.location}</p>
                      </div>
                    </div>

                    {result.interviewDetails.coordinatorNotes && (
                      <div className="bg-background/80 p-3 rounded text-xs border border-sky-200 dark:border-sky-800">
                        <strong>Coordinator Note:</strong> {result.interviewDetails.coordinatorNotes}
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap gap-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          result.interviewDetails.location
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 bg-sky-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-sky-700 transition"
                      >
                        <MapPin className="size-3.5" /> View Location on Google Maps
                      </a>
                    </div>
                  </div>
                )}

                {/* Approved State Celebration Card */}
                {result.status === "APPROVED" && (
                  <div className="p-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 space-y-3 animate-in">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <FileCheck2 className="size-5" />
                      <h4 className="text-sm font-bold">
                        🎉 Congratulations! Your Adoption is Approved!
                      </h4>
                    </div>
                    <p className="text-xs leading-relaxed">
                      Our adoption coordinator has officially approved your application for <strong>{result.petName}</strong>. 
                      You are welcome to come to the shelter to complete the 100% Free Adoption formalities and collect {result.petName}&apos;s medical passport.
                    </p>
                    <div className="text-xs space-y-1 bg-background/80 p-3 rounded border border-emerald-200 dark:border-emerald-800">
                      <strong>Checklist for Adoption Day:</strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                        <li>Original IC or Passport for adoption charter signing.</li>
                        <li>Pet carrier (for cats) or secure collar/leash (for dogs).</li>
                        <li>Complete free vaccination & microchip registration transfer.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Under Review Guidance Card */}
                {result.status === "UNDER_REVIEW" && !result.interviewDetails && (
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                    <p className="font-semibold">⏳ Review Currently in Progress</p>
                    <p className="text-muted-foreground leading-relaxed">
                      Our team is reviewing your household profile. We will reach out via WhatsApp or email to confirm a Meet & Greet time slot.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Rejected State Closure Card */
              <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="size-5 text-amber-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Application Status: Closed
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Thank you for your interest in adopting {result.petName}. After evaluating all submissions and the specific temperament requirements of this rescue, we were unable to proceed with this match.
                </p>
                <div className="pt-2">
                  <Link
                    href="/pets"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 transition"
                  >
                    <Heart className="size-3.5" /> View Other Available Rescues
                  </Link>
                </div>
              </div>
            )}

            {/* Direct Support & Shelter Contact Card */}
            <div className="bg-muted/40 border border-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-foreground flex items-center gap-1.5">
                  <Building className="size-3.5 text-primary" /> Hope for Strays Sanctuary & Helpline
                </h4>
                <p className="text-muted-foreground">
                  No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor &bull; Hours: Tue – Sun 10am – 5pm
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <a
                  href="https://wa.me/60123456789"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp Coordinator
                </a>
                <a
                  href="tel:0378765432"
                  className="inline-flex items-center gap-1.5 border border-border bg-card text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-accent transition"
                >
                  <Phone className="size-3.5" /> 03-7876 5432
                </a>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function TrackApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <ApplicationTrackerContent />
    </Suspense>
  );
}
