import type { ServiceKey } from "@/lib/services";

export type RateClassFixture = {
  id: string;
  name: string;
  /** Short label used in badges, e.g. "OT Aide". */
  shortName: string;
  service: Exclude<ServiceKey, "none">;
  /** The share of each session's fee the therapist earns. */
  therapistSharePct: number;
};

export const RATE_CLASSES: RateClassFixture[] = [
  {
    id: "rc_ot",
    name: "Occupational Therapist",
    shortName: "OT",
    service: "ot",
    therapistSharePct: 70,
  },
  {
    id: "rc_ot_aide",
    name: "Occupational Therapist Aide",
    shortName: "OT Aide",
    service: "aide",
    therapistSharePct: 50,
  },
  {
    id: "rc_speech",
    name: "Speech Therapist",
    shortName: "Speech",
    service: "speech",
    therapistSharePct: 80,
  },
  {
    id: "rc_sped",
    name: "SPED Tutor",
    shortName: "SPED",
    service: "sped",
    therapistSharePct: 80,
  },
];
