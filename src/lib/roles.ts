export const ROLES = ["superadmin", "secretary", "therapist"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Clinic owner",
  secretary: "Front desk",
  therapist: "Therapist",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
