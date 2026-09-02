"use client";

import React from "react";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CANONICAL_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type CanonicalRole,
} from "@/lib/security/permissions";
import { inviteMemberSchema } from "@/lib/validations/member";
import type { InviteDraft } from "@/hooks/useMemberTableController";

export function InviteMemberDialog({
  open,
  draft,
  isSubmitting,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean;
  draft: InviteDraft;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (draft: InviteDraft) => void;
  onSubmit: () => void;
}) {
  // Runs the exact schema the action validates with, rather than a second
  // hand-written rule that could drift from it. The server remains the
  // authority; this only decides whether the button is enabled.
  const isValid = inviteMemberSchema.safeParse(draft).success;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Invite a Staff Member
          </DialogTitle>
          <DialogDescription>
            They receive an email with a single-use link, valid for 72 hours, to set
            their own password. The account stays inactive until they use it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name" className="text-xs font-bold uppercase tracking-wider">
              Full Name
            </Label>
            <Input
              id="invite-name"
              required
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="Nurul Aina binti Hassan"
              className="text-sm py-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-bold uppercase tracking-wider">
              Email Address
            </Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={draft.email}
              onChange={(e) => onChange({ ...draft, email: e.target.value })}
              placeholder="nurul@hopeforstrays.org"
              className="text-sm py-2 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-xs font-bold uppercase tracking-wider">
              Access Level
            </Label>
            <select
              id="invite-role"
              value={draft.role}
              onChange={(e) => onChange({ ...draft, role: e.target.value as CanonicalRole })}
              className="w-full h-9 border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CANONICAL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ROLE_DESCRIPTIONS[draft.role]}
            </p>
          </div>

          {draft.role === "SUPER_ADMIN" && (
            <div className="border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Super Admins can manage every record and every other staff account,
              including yours. Grant this only when it is genuinely required.
            </div>
          )}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!isValid || isSubmitting} className="gap-1.5">
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Mail className="size-3.5" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
