export type StaffFixture = {
  id: string;
  /** Full name with credentials, e.g. "Jolyn Dela Rosa, OTRP". */
  displayName: string;
  /** Compact label used in tables, e.g. "J. Dela Rosa, OTRP". */
  shortName: string;
  /** Surname shown on schedule columns, e.g. "Dela Rosa". */
  surname: string;
  rateClassId: string;
  userId: string | null;
  active: boolean;
  /** This month's load, shown in settings. */
  monthSessions: number;
  monthPatients: number;
  utilizationPct: number | null;
};

export const STAFF: StaffFixture[] = [
  {
    id: "stf_delarosa",
    displayName: "Jolyn Dela Rosa, OTRP",
    shortName: "J. Dela Rosa, OTRP",
    surname: "Dela Rosa",
    rateClassId: "rc_ot",
    userId: "usr_ther_delarosa",
    active: true,
    monthSessions: 112,
    monthPatients: 14,
    utilizationPct: 88,
  },
  {
    id: "stf_tan",
    displayName: "Marco Tan, OTRP",
    shortName: "M. Tan, OTRP",
    surname: "Tan",
    rateClassId: "rc_ot",
    userId: null,
    active: true,
    monthSessions: 98,
    monthPatients: 12,
    utilizationPct: 79,
  },
  {
    id: "stf_ramos",
    displayName: "Kevin Ramos",
    shortName: "K. Ramos, OT Aide",
    surname: "Ramos",
    rateClassId: "rc_ot_aide",
    userId: null,
    active: true,
    monthSessions: 64,
    monthPatients: 9,
    utilizationPct: 64,
  },
  {
    id: "stf_lim",
    displayName: "Jasmine Lim, SLP",
    shortName: "J. Lim, SLP",
    surname: "Lim",
    rateClassId: "rc_speech",
    userId: null,
    active: true,
    monthSessions: 86,
    monthPatients: 11,
    utilizationPct: 82,
  },
  {
    id: "stf_garcia",
    displayName: "Anna Garcia",
    shortName: "A. Garcia, SPED",
    surname: "Garcia",
    rateClassId: "rc_sped",
    userId: null,
    active: true,
    monthSessions: 52,
    monthPatients: 7,
    utilizationPct: 58,
  },
];

/** The demo therapist account (Jolyn Dela Rosa). */
export const DEMO_THERAPIST_STAFF_ID = "stf_delarosa";
