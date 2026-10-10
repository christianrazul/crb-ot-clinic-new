export type BranchFixture = {
  id: string;
  code: string;
  name: string;
  location: string;
  isMain: boolean;
};

export const BRANCHES: BranchFixture[] = [
  { id: "br_bangkal", code: "B1", name: "CRB Bangkal", location: "Davao City", isMain: true },
  { id: "br_panabo", code: "B2", name: "CRB Panabo", location: "Panabo City", isMain: false },
];

/** "Bangkal" from "CRB Bangkal", for compact labels like "Bangkal branch". */
export function branchShortName(branch: BranchFixture): string {
  return branch.name.replace(/^CRB\s+/, "");
}

/** "Davao City, main branch" or "Panabo City". */
export function branchSubtitle(branch: BranchFixture): string {
  return branch.isMain ? `${branch.location}, main branch` : branch.location;
}
