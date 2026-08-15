"use client";

import React, { useState, useEffect } from "react";
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
  Printer 
} from "lucide-react";

interface ApplicationDetailDialogProps {
  application: AdoptionApplicationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (id: string, status: ApplicationStatus, notes: string) => void;
}

export function ApplicationDetailDialog({
  application,
  open,
  onOpenChange,
  onUpdateStatus,
}: ApplicationDetailDialogProps) {
  const [status, setStatus] = useState<ApplicationStatus>("SUBMITTED");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (application) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(application.status);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(application.adminReviewNotes || "");
    }
  }, [application, open]);

  if (!application) return null;

  const handleSave = () => {
    onUpdateStatus(application.id, status, notes);
    onOpenChange(false);
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
                Submitted on {application.createdAt} by {application.applicantName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          
          {/* 1. Applicant Contact Info */}
          <div className="border border-border bg-background p-4 space-y-2.5">
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
            <div className="border border-border bg-background p-4 space-y-2 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Home className="size-3.5" /> Residence
              </h3>
              <p><strong className="text-foreground">Housing:</strong> {application.housingType.replace("_", " ")}</p>
              <p><strong className="text-foreground">Fenced Gate/Yard:</strong> {application.hasFencedYard}</p>
            </div>

            <div className="border border-border bg-background p-4 space-y-2 text-xs">
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

          {/* Applicant Notes */}
          {application.applicantNotes && (
            <div className="bg-muted/30 border border-border p-4 text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-foreground">Applicant Statement:</span>
              <p className="text-muted-foreground leading-relaxed italic">
                &ldquo;{application.applicantNotes}&rdquo;
              </p>
            </div>
          )}

          {/* 3. Review & Status Update */}
          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Coordinator Review & Decision
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="app-status" className="text-xs font-semibold">Change Application Status</Label>
              <select
                id="app-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="w-full bg-background border border-input px-3 py-2 text-sm text-foreground font-semibold"
              >
                <option value="SUBMITTED">Submitted (New Application)</option>
                <option value="UNDER_REVIEW">Under Review (Checking References / Housing)</option>
                <option value="APPROVED">Approved (Ready for Meet & Adoption)</option>
                <option value="REJECTED">Rejected (Incompatible / Incomplete)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-notes" className="text-xs font-semibold">Internal Coordinator Review Notes</Label>
              <Textarea
                id="app-notes"
                rows={3}
                placeholder="Log phone interview notes, housing check details, or reason for decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {status === "APPROVED" && <CheckCircle2 className="size-4 text-emerald-800 dark:text-emerald-400" />}
              {status === "UNDER_REVIEW" && <Clock className="size-4 text-amber-800 dark:text-amber-400" />}
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
      </DialogContent>
    </Dialog>
  );
}
