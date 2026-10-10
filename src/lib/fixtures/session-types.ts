import type { ServiceKey } from "@/lib/services";

export type SessionTypeFixture = {
  id: string;
  name: string;
  service: Exclude<ServiceKey, "aide"> | null;
  rateCentavos: number;
  /** Rate classes that may run this session. Null means anyone. */
  allowedRateClassIds: string[] | null;
  active: boolean;
};

export const SESSION_TYPES: SessionTypeFixture[] = [
  {
    id: "st_ot",
    name: "OT session",
    service: "ot",
    rateCentavos: 70_000,
    allowedRateClassIds: ["rc_ot", "rc_ot_aide"],
    active: true,
  },
  {
    id: "st_ot_eval",
    name: "OT evaluation",
    service: "ot",
    rateCentavos: 150_000,
    allowedRateClassIds: ["rc_ot"],
    active: true,
  },
  {
    id: "st_speech",
    name: "ST session",
    service: "speech",
    rateCentavos: 100_000,
    allowedRateClassIds: ["rc_speech"],
    active: true,
  },
  {
    id: "st_sped",
    name: "SPED Tutoring",
    service: "sped",
    rateCentavos: 50_000,
    allowedRateClassIds: ["rc_sped"],
    active: true,
  },
  {
    id: "st_makeup",
    name: "Make up session",
    service: null,
    rateCentavos: 70_000,
    allowedRateClassIds: null,
    active: true,
  },
];
