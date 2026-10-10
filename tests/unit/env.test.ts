import { describe, expect, it } from "vitest";

import { parseEnv } from "@/env.schema";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://crb:crb@localhost:5432/crb",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("accepts a valid environment", () => {
    expect(parseEnv(valid)).toMatchObject({ ...valid, NEXT_PUBLIC_DEV_ROLE_SWITCHER: false });
  });

  it("turns the role switcher flag into a boolean", () => {
    expect(
      parseEnv({ ...valid, NEXT_PUBLIC_DEV_ROLE_SWITCHER: "true" }).NEXT_PUBLIC_DEV_ROLE_SWITCHER,
    ).toBe(true);
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_DEV_ROLE_SWITCHER: "yes" })).toThrow();
  });

  it("defaults NODE_ENV to development", () => {
    expect(parseEnv({ ...valid, NODE_ENV: undefined }).NODE_ENV).toBe("development");
  });

  it("fails fast and names every missing variable", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*NEXT_PUBLIC_APP_URL/);
  });

  it("rejects non-postgres database URLs", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://localhost/crb" })).toThrow(
      /DATABASE_URL: must be a postgres/,
    );
  });

  it("refuses the role switcher and missing SMTP in production", () => {
    const production = { ...valid, NODE_ENV: "production", SMTP_URL: "smtps://u:p@mail.test:465" };
    expect(parseEnv(production).NODE_ENV).toBe("production");
    expect(() => parseEnv({ ...production, NEXT_PUBLIC_DEV_ROLE_SWITCHER: "true" })).toThrow(
      /must be false in production/,
    );
    expect(() => parseEnv({ ...production, SMTP_URL: undefined })).toThrow(
      /SMTP_URL: is required in production/,
    );
  });

  it("leaves production-only rules to the running server, not the build", () => {
    const building = {
      ...valid,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      NEXT_PUBLIC_DEV_ROLE_SWITCHER: "true",
    };
    expect(parseEnv(building).NODE_ENV).toBe("production");
  });

  it("requires a long enough auth secret", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
