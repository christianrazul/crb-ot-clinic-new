import { fromManilaLocal } from "@/lib/dates";

/**
 * The mockup is frozen at Saturday, August 22, 2026, 10:20 AM in Manila.
 * Fixtures and screens use this instead of the real clock until the database
 * lands, so the demo always looks the same.
 */
export const DEMO_TODAY = "2026-08-22";
export const DEMO_NOW = fromManilaLocal(DEMO_TODAY, "10:20");

/** Monday of the demo week. */
export const DEMO_WEEK_MONDAY = "2026-08-17";
