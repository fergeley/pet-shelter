"use client";

import { useCallback, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import {
  inviteMember,
  resendInvitation,
  toggleMemberStatus,
  updateMemberRole,
} from "@/actions/members";
import type { MemberRecord } from "@/lib/memberStore";
import { USER_STATUSES, type CanonicalRole, type UserStatus } from "@/lib/security/permissions";

export type MemberStatusFilter = "all" | UserStatus;

export interface InviteDraft {
  name: string;
  email: string;
  role: CanonicalRole;
}

const EMPTY_INVITE: InviteDraft = { name: "", email: "", role: "STAFF" };

/**
 * View-state controller for the staff roster.
 *
 * The roster itself is NOT held here. Every member action calls
 * `revalidatePath("/admin/members")`, and Next re-renders the route server-side
 * and ships the new RSC payload in the same response, so the updated rows
 * arrive as a fresh `members` prop. Copying them into `useState` would break
 * that: client state is preserved across a server re-render, so the copy would
 * shadow the new data and force a second round-trip to fetch what the first
 * response already contained. This hook therefore owns only genuine view state
 * — filters, sorting, dialogs and in-flight markers.
 */
export function useMemberTableController(members: MemberRecord[], currentUserId: string) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(EMPTY_INVITE);

  const [roleEditTarget, setRoleEditTarget] = useState<MemberRecord | null>(null);
  const [pendingRole, setPendingRole] = useState<CanonicalRole>("STAFF");
  const [suspendTarget, setSuspendTarget] = useState<MemberRecord | null>(null);

  /** Id of the member currently mid-mutation, so only that row shows a spinner. */
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const filteredMembers = useMemo(() => {
    let base = members;

    if (statusFilter !== "all") {
      base = base.filter((member) => member.status === statusFilter);
    }

    const query = globalFilter.trim().toLowerCase();
    if (!query) return base;

    return base.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
    );
  }, [members, statusFilter, globalFilter]);

  const counts = useMemo(
    () => ({
      all: members.length,
      [USER_STATUSES.ACTIVE]: members.filter((m) => m.status === USER_STATUSES.ACTIVE).length,
      [USER_STATUSES.INVITED]: members.filter((m) => m.status === USER_STATUSES.INVITED).length,
      [USER_STATUSES.SUSPENDED]: members.filter((m) => m.status === USER_STATUSES.SUSPENDED)
        .length,
    }),
    [members]
  );

  /* ---------------------------------------------------------------------- */
  /*  Mutations                                                             */
  /* ---------------------------------------------------------------------- */

  const handleInviteSubmit = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await inviteMember(inviteDraft.email, inviteDraft.name, inviteDraft.role);

      if (!res.success) {
        setError(res.error || "Could not send the invitation.");
        return;
      }

      // A successful invite can still carry a warning when the email bounced.
      flashNotice(
        res.error
          ? res.error
          : `Invitation sent to ${inviteDraft.email}. It expires in 72 hours.`
      );
      setIsInviteOpen(false);
      setInviteDraft(EMPTY_INVITE);
    } finally {
      setIsSubmitting(false);
    }
  }, [inviteDraft, flashNotice]);

  const handleRoleSubmit = useCallback(async () => {
    if (!roleEditTarget) return;
    setError(null);
    setIsSubmitting(true);
    setBusyMemberId(roleEditTarget.id);
    try {
      const res = await updateMemberRole(roleEditTarget.id, pendingRole);
      if (!res.success) {
        setError(res.error || "Could not change this member's role.");
        return;
      }
      flashNotice(`${roleEditTarget.name} is now ${pendingRole.replace(/_/g, " ").toLowerCase()}.`);
      setRoleEditTarget(null);
    } finally {
      setIsSubmitting(false);
      setBusyMemberId(null);
    }
  }, [roleEditTarget, pendingRole, flashNotice]);

  const handleStatusChange = useCallback(
    async (member: MemberRecord, status: UserStatus) => {
      setError(null);
      setBusyMemberId(member.id);
      try {
        const res = await toggleMemberStatus(member.id, status);
        if (!res.success) {
          setError(res.error || "Could not update this member's status.");
          return;
        }
        flashNotice(
          status === USER_STATUSES.SUSPENDED
            ? `${member.name} has been suspended and signed out.`
            : `${member.name} has been reactivated.`
        );
        setSuspendTarget(null);
      } finally {
        setBusyMemberId(null);
      }
    },
    [flashNotice]
  );

  const handleResendInvite = useCallback(
    async (member: MemberRecord) => {
      setError(null);
      setBusyMemberId(member.id);
      try {
        const res = await resendInvitation(member.id);
        if (!res.success) {
          setError(res.error || "Could not resend the invitation.");
          return;
        }
        flashNotice(`A fresh invitation has been sent to ${member.email}.`);
      } finally {
        setBusyMemberId(null);
      }
    },
    [flashNotice]
  );

  const handleOpenRoleEdit = useCallback((member: MemberRecord) => {
    setRoleEditTarget(member);
    setPendingRole(member.role);
    setError(null);
  }, []);

  const handleOpenInvite = useCallback(() => {
    setInviteDraft(EMPTY_INVITE);
    setError(null);
    setIsInviteOpen(true);
  }, []);

  return {
    state: {
      members,
      filteredMembers,
      counts,
      currentUserId,
      globalFilter,
      statusFilter,
      sorting,
      isInviteOpen,
      inviteDraft,
      roleEditTarget,
      pendingRole,
      suspendTarget,
      busyMemberId,
      isSubmitting,
      error,
      notice,
    },
    handlers: {
      setGlobalFilter,
      setStatusFilter,
      setSorting,
      setIsInviteOpen,
      setInviteDraft,
      setRoleEditTarget,
      setPendingRole,
      setSuspendTarget,
      setError,
      handleOpenInvite,
      handleOpenRoleEdit,
      handleInviteSubmit,
      handleRoleSubmit,
      handleStatusChange,
      handleResendInvite,
    },
  };
}
