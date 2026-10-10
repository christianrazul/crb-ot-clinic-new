import { describe, expect, it } from "vitest";

import { parseEnv } from "@/env.schema";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://crb:crb@localhost:5432/crb",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a valid environment", () => {
    expect(parseEnv(valid)).toEqual({ ...valid, NEXT_PUBLIC_DEV_ROLE_SWITCHER: false });
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
});
