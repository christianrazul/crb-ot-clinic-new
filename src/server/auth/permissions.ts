import type { Role } from "@/lib/roles";

import type { Actor } from "./actor";

/**
 * Every permission in one place. Services call `can` or `assertCan` before
 * reading or writing anything; the UI hiding a button is never the check.
 */
export type Action =
  | "dashboard:read"
  | "schedule:read"
  | "appointment:book"
  | "appointment:status"
  | "patient:read"
  | "patient:write"
  | "patient:create"
  | "patient:edit"
  | "patient:export"
  | "patient:anonymize"
  | "note:read"
  | "note:write"
  | "billing:read"
  | "payment:collect"
  | "credit:read"
  | "credit:top-up"
  | "billing:correct"
  | "payroll:read"
  | "expense:manage"
  | "settings:manage"
  | "user:manage"
  | "audit:read";

const GRANTS: Record<Action, Role[]> = {
  "dashboard:read": ["superadmin"],
  "schedule:read": ["superadmin", "secretary", "therapist"],
  "appointment:book": ["superadmin", "secretary"],
  "appointment:status": ["superadmin", "secretary"],
  "patient:read": ["superadmin", "secretary", "therapist"],
  /** Set patients inactive, remove them, book them, record their money. */
  "patient:write": ["superadmin", "secretary"],
  /** Therapists add patients too; theirs are assigned to them. */
  "patient:create": ["superadmin", "secretary", "therapist"],
  /** Edit a patient's details; therapists only their own patients. */
  "patient:edit": ["superadmin", "secretary", "therapist"],
  "patient:export": ["superadmin"],
  "patient:anonymize": ["superadmin"],
  "note:read": ["superadmin", "secretary", "therapist"],
  "note:write": ["therapist"],
  "billing:read": ["superadmin", "secretary"],
  "payment:collect": ["superadmin", "secretary"],
  "credit:read": ["superadmin", "secretary"],
  "credit:top-up": ["superadmin", "secretary"],
  /** Void or correct a payment or credit entry; always with a reason, always audited. */
  "billing:correct": ["superadmin", "secretary"],
  "payroll:read": ["superadmin"],
  "expense:manage": ["superadmin"],
  "settings:manage": ["superadmin"],
  "user:manage": ["superadmin"],
  "audit:read": ["superadmin"],
};

/** Actions a therapist may only take on their own patients and sessions. */
const OWN_ONLY_FOR_THERAPISTS = new Set<Action>([
  "schedule:read",
  "patient:read",
  "note:read",
  "note:write",
  "patient:edit",
]);

export type Resource = {
  /** The branch the record belongs to. The actor must be a member. */
  branchId?: string;
  /**
   * Whether the record is the therapist's own: their patient (primary or
   * backup) or their appointment. Services look this up in the database.
   */
  ownedByActor?: boolean;
};

export function can(actor: Actor, action: Action, resource: Resource = {}): boolean {
  if (!GRANTS[action].includes(actor.role)) return false;
  if (resource.branchId !== undefined && !actor.branchIds.includes(resource.branchId)) return false;
  if (
    actor.role === "therapist" &&
    OWN_ONLY_FOR_THERAPISTS.has(action) &&
    resource.ownedByActor === false
  ) {
    return false;
  }
  return true;
}

/** Thrown when a check fails. Actions turn it into a friendly message, never a stack trace. */
export class ForbiddenError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(actor: Actor, action: Action, resource: Resource = {}): void {
  if (!can(actor, action, resource)) throw new ForbiddenError();
}

/** Screens each role may open (mirrors the navigation; used by requireScreen). */
export const ROLE_TITLES: Record<Role, string> = {
  superadmin: "Clinic owner",
  secretary: "Front desk",
  therapist: "Therapist",
};
