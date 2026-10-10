import { describe, expect, it } from "vitest";

import { parseEnv } from "@/env.schema";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://crb:crb@localhost:5432/crb",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a valid environment", () => {
    expect(parseEnv(valid)).toEqual(valid);
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
