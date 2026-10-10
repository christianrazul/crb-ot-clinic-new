import type { ServiceKey } from "@/lib/services";

export type PatientFixture = {
  id: string;
  name: string;
  service: Exclude<ServiceKey, "aide" | "none">;
  guardian: string;
  active: boolean;
};

/** The sixteen patients from the mockup. Full fixtures arrive in Milestone 2. */
export const PATIENTS: PatientFixture[] = [
  { id: "pat_01", name: "Liam Santos", service: "ot", guardian: "Carla Santos", active: true },
  { id: "pat_02", name: "Amara Cruz", service: "speech", guardian: "Miguel Cruz", active: true },
  { id: "pat_03", name: "Enzo Dela Peña", service: "ot", guardian: "Rosa Dela Peña", active: true },
  { id: "pat_04", name: "Sofia Reyes", service: "sped", guardian: "Grace Reyes", active: true },
  { id: "pat_05", name: "Althea Mendoza", service: "ot", guardian: "Paolo Mendoza", active: true },
  { id: "pat_06", name: "Gab Torres", service: "ot", guardian: "Len Torres", active: true },
  { id: "pat_07", name: "Nina Pascual", service: "speech", guardian: "Joy Pascual", active: true },
  { id: "pat_08", name: "Bea Aquino", service: "speech", guardian: "Mia Aquino", active: true },
  { id: "pat_09", name: "Caleb Uy", service: "ot", guardian: "Rich Uy", active: true },
  { id: "pat_10", name: "Diego Ramos", service: "sped", guardian: "Ana Ramos", active: true },
  { id: "pat_11", name: "Elle Bautista", service: "ot", guardian: "Kim Bautista", active: true },
  { id: "pat_12", name: "Franco Lee", service: "ot", guardian: "Sam Lee", active: true },
  { id: "pat_13", name: "Hana Sy", service: "speech", guardian: "Grace Sy", active: true },
  { id: "pat_14", name: "Iggy Navarro", service: "ot", guardian: "Paz Navarro", active: true },
  { id: "pat_15", name: "Jaz Ocampo", service: "sped", guardian: "Leo Ocampo", active: true },
  { id: "pat_16", name: "Kian Velasco", service: "ot", guardian: "Ivy Velasco", active: true },
];
