import * as z from "zod";
import { CANONICAL_ROLES, USER_STATUSES } from "@/lib/security/permissions";

/**
 * Roles are validated against the canonical five only. The deprecated aliases
 * (ADMIN / COORDINATOR / VOLUNTEER) remain readable but must never be
 * assignable through the admin UI, or the migration would never finish.
 */
export const canonicalRoleSchema = z.enum(CANONICAL_ROLES);

export const userStatusSchema = z.enum(
  Object.values(USER_STATUSES) as [string, ...string[]]
);

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email address is required")
    .email("Enter a valid email address"),
  name: z.string().trim().min(2, "Enter the member's full name"),
  role: canonicalRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  userId: z.string().trim().min(1, "A member must be selected"),
  newRole: canonicalRoleSchema,
});

export const toggleMemberStatusSchema = z.object({
  userId: z.string().trim().min(1, "A member must be selected"),
  // INVITED is not settable by hand: it is a consequence of inviteMember().
  status: z.enum([USER_STATUSES.ACTIVE, USER_STATUSES.SUSPENDED]),
});

export const acceptInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    token: z.string().trim().min(1, "This invitation link is incomplete"),
    password: z.string().min(8, "Password must be at least 8 characters in length"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.input<typeof updateMemberRoleSchema>;
export type ToggleMemberStatusInput = z.input<typeof toggleMemberStatusSchema>;
export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
