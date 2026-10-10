/**
 * Clinical services and their colors. Class names are written out in full so
 * Tailwind can detect them; never build them with string interpolation.
 */
export const SERVICE_KEYS = ["ot", "speech", "sped", "aide", "none"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  ot: "Occupational Therapy",
  speech: "Speech Therapy",
  sped: "SPED Tutoring",
  aide: "OT Aide",
  none: "Uncategorized",
};

/** Compact labels for badges, legends and "OT with Dela Rosa". */
export const SERVICE_SHORT: Record<ServiceKey, string> = {
  ot: "OT",
  speech: "Speech",
  sped: "SPED",
  aide: "OT Aide",
  none: "Other",
};

/** Solid dot or bar, e.g. the service dot next to a session type. */
export const SERVICE_BG: Record<ServiceKey, string> = {
  ot: "bg-svc-ot",
  speech: "bg-svc-speech",
  sped: "bg-svc-sped",
  aide: "bg-svc-aide",
  none: "bg-svc-none",
};

/** Tinted background with readable text, e.g. patient avatars. */
export const SERVICE_SOFT: Record<ServiceKey, string> = {
  ot: "bg-svc-ot-soft text-svc-ot-strong",
  speech: "bg-svc-speech-soft text-svc-speech-strong",
  sped: "bg-svc-sped-soft text-svc-sped-strong",
  aide: "bg-svc-aide-soft text-svc-aide-strong",
  none: "bg-svc-none-soft text-svc-none-strong",
};

/** Calendar block: tint, colored left border and readable text. */
export const SERVICE_BLOCK: Record<ServiceKey, string> = {
  ot: "bg-svc-ot-soft border-l-svc-ot text-svc-ot-strong",
  speech: "bg-svc-speech-soft border-l-svc-speech text-svc-speech-strong",
  sped: "bg-svc-sped-soft border-l-svc-sped text-svc-sped-strong",
  aide: "bg-svc-aide-soft border-l-svc-aide text-svc-aide-strong",
  none: "bg-svc-none-soft border-l-svc-none text-svc-none-strong",
};
