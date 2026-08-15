"use client";

import React, { useState } from "react";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Phone,
  MapPin,
  Home,
  User,
  Printer,
  Calendar,
  Send,
  Loader2,
} from "lucide-react";
import { scheduleApplicationInterview } from "@/actions/applications";

interface ApplicationDetailDialogProps {
  application: AdoptionApplicationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (
    id: string,
    status: ApplicationStatus,
    notes: string,
    notifyApplicant?: boolean
  ) => { success: boolean; error?: string } | void;
}

export function ApplicationDetailDialog({
  application,
  open,
  onOpenChange,
  onUpdateStatus,
}: ApplicationDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<"review" | "interview">("review");
  const [status, setStatus] = useState<ApplicationStatus>("SUBMITTED");
  const [notes, setNotes] = useState("");
  const [notifyApplicant, setNotifyApplicant] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Interview Scheduling State
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("14:00");
  const [meetingType, setMeetingType] = useState<"in_person" | "video_call">("in_person");
  const [location, setLocation] = useState(
    "Hope for Strays Shelter, No. 18 Jalan SS 2/72, Petaling Jaya"
  );
  const [interviewNotes, setInterviewNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey =
    application && open ? `${application.id}-${application.status}-${open}` : null;

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (application) {
      setStatus(application.status);
      setNotes(application.adminReviewNotes || "");
      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveTab("review");

      // Default next interview date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setInterviewDate(tomorrow.toISOString().split("T")[0]);
    }
  }

  if (!application) return null;

  const handleSave = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const result = onUpdateStatus(application.id, status, notes, notifyApplicant);
    if (result && !result.success) {
      setErrorMessage(result.error || "Failed to update status.");
      return;
    }
    setSuccessMessage("Application review saved successfully!");
    setTimeout(() => {
      onOpenChange(false);
    }, 600);
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!interviewDate || !interviewTime || !location.trim()) {
      setErrorMessage("Please complete all required date, time, and location fields.");
      return;
    }

    setScheduling(true);
    try {
      const res = await scheduleApplicationInterview({
        applicationId: application.id,
        interviewDate,
        interviewTime,
        meetingType,
        location,
        coordinatorNotes: interviewNotes,
        notifyApplicant,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to schedule interview.");
      } else {
        setSuccessMessage("Meet & Greet scheduled! Confirmation email dispatched.");
        setStatus("UNDER_REVIEW");
        onUpdateStatus(
          application.id,
          "UNDER_REVIEW",
          `[Meet & Greet Scheduled: ${interviewDate} at ${interviewTime}] ${interviewNotes}`,
          notifyApplicant
        );
        setTimeout(() => {
          onOpenChange(false);
        }, 800);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error scheduling interview");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-card border-border">
        <DialogHeader className="mb-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="font-heading text-2xl font-bold">
                Application for {application.petName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Submitted on {application.createdAt} by {application.applicantName} (Ref: {application.id})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center gap-2 rounded-md">
            <XCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-400 flex items-center gap-2 rounded-md">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* 1. Applicant Contact Info */}
          <div className="border border-border bg-background p-4 space-y-2.5 rounded-lg shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <User className="size-3.5" /> Applicant Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Name: </span>
                <span>{application.applicantName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="size-3 text-foreground" />
                <a href={`tel:${application.phone}`} className="text-foreground hover:underline font-mono">
                  {application.phone}
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="size-3 text-foreground" />
                <a href={`mailto:${application.email}`} className="text-foreground hover:underline">
                  {application.email}
                </a>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="size-3 text-foreground shrink-0 mt-0.5" />
                <span>{application.address}</span>
              </div>
            </div>
          </div>

          {/* 2. Living Situation & Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-border bg-background p-4 space-y-2 text-xs rounded-lg shadow-sm">
              <h3 className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Home className="size-3.5" /> Residence
              </h3>
              <p><strong className="text-foreground">Housing:</strong> {application.housingType.replace(/_/g, " ")}</p>
              <p><strong className="text-foreground">Fenced Gate/Yard:</strong> {application.hasFencedYard}</p>
            </div>

            <div className="border border-border bg-background p-4 space-y-2 text-xs rounded-lg shadow-sm">
              <h3 className="font-bold uppercase tracking-wider text-foreground">
                Pet Experience
              </h3>
              <p><strong className="text-foreground">Experience:</strong> {application.householdExperience}</p>
              <p><strong className="text-foreground">Current Pets:</strong> {application.currentPets}</p>
              {application.currentPetDetails && (
                <p className="text-muted-foreground italic">&ldquo;{application.currentPetDetails}&rdquo;</p>
              )}
            </div>
          </div>

          {/* Applicant Statement */}
          {application.applicantNotes && (
            <div className="bg-muted/30 border border-border p-4 text-xs space-y-1 rounded-lg">
              <span className="font-bold uppercase tracking-wider text-foreground">Applicant Statement:</span>
              <p className="text-muted-foreground leading-relaxed italic">
                &ldquo;{application.applicantNotes}&rdquo;
              </p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="border-b border-border flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("review")}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === "review"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Review & Decision
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("interview")}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "interview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="size-3.5" />
              Schedule Meet & Greet
            </button>
          </div>

          {/* Tab 1: Review & Decision */}
          {activeTab === "review" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="app-status" className="text-xs font-semibold">Change Application Status</Label>
                <select
                  id="app-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground font-semibold"
                >
                  <option value="SUBMITTED">Submitted (New Application)</option>
                  <option value="UNDER_REVIEW">Under Review (Checking References / Housing)</option>
                  <option value="APPROVED">Approved (Ready for Adoption - 100% Free)</option>
                  <option value="REJECTED">Rejected (Incompatible / Incomplete)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="app-notes" className="text-xs font-semibold">Coordinator Review Remarks</Label>
                <Textarea
                  id="app-notes"
                  rows={3}
                  placeholder="Log housing verification notes, applicant feedback, or remarks sent in the email update..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>

              {/* Email dispatch toggle */}
              <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border rounded-md text-xs">
                <input
                  id="notify-applicant"
                  type="checkbox"
                  checked={notifyApplicant}
                  onChange={(e) => setNotifyApplicant(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="notify-applicant" className="text-xs font-medium cursor-pointer">
                  Send automated status update email notification to <strong>{application.email}</strong>
                </Label>
              </div>

              <div className="border-t border-border pt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {status === "APPROVED" && <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />}
                  {status === "UNDER_REVIEW" && <Clock className="size-4 text-amber-600 dark:text-amber-400" />}
                  {status === "REJECTED" && <XCircle className="size-4 text-destructive" />}
                  <span>Status: <strong className="text-foreground">{status.replace("_", " ")}</strong></span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => window.print()}
                    className="text-xs gap-1.5"
                    title="Print field inspection dossier"
                  >
                    <Printer className="size-3.5" />
                    Print Dossier
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} className="text-xs font-semibold px-5">
                    Save Review
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Schedule Meet & Greet */}
          {activeTab === "interview" && (
            <form onSubmit={handleScheduleInterview} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="interview-date" className="text-xs font-semibold">Interaction Date *</Label>
                  <Input
                    id="interview-date"
                    type="date"
                    required
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interview-time" className="text-xs font-semibold">Interaction Time *</Label>
                  <Input
                    id="interview-time"
                    type="time"
                    required
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-type" className="text-xs font-semibold">Format</Label>
                  <select
                    id="meeting-type"
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as "in_person" | "video_call")}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs text-foreground font-semibold"
                  >
                    <option value="in_person">In-Person Shelter Visit</option>
                    <option value="video_call">Virtual Video Interview</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="interview-location" className="text-xs font-semibold">Location / Video Link *</Label>
                  <Input
                    id="interview-location"
                    required
                    placeholder="e.g. Shelter compound or Google Meet link"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="interview-notes" className="text-xs font-semibold">Coordinator Instructions for Adopter</Label>
                <Textarea
                  id="interview-notes"
                  rows={2}
                  placeholder="e.g. Please bring your existing dog for socialization or lease agreement..."
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border rounded-md text-xs">
                <input
                  id="notify-interview"
                  type="checkbox"
                  checked={notifyApplicant}
                  onChange={(e) => setNotifyApplicant(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="notify-interview" className="text-xs font-medium cursor-pointer">
                  Send Meet & Greet invitation email with date & time to <strong>{application.email}</strong>
                </Label>
              </div>

              <div className="border-t border-border pt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Will update application status to <strong>Under Review</strong>
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={scheduling}
                    size="sm"
                    className="text-xs font-semibold px-5 gap-1.5"
                  >
                    {scheduling ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        Send Invitation & Schedule
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
