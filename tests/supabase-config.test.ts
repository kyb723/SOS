import { describe, it, expect } from "vitest";
import {
  publicSupabaseConfig,
  sharedWorkspaceEnabled,
} from "../src/lib/supabase/config";
describe("public Supabase configuration", () => {
  it("accepts a publishable key over HTTPS", () =>
    expect(
      publicSupabaseConfig("https://test.supabase.co", "sb_publishable_test")
        .url,
    ).toBe("https://test.supabase.co"));
  it("rejects missing settings and privileged keys", () => {
    expect(() => publicSupabaseConfig(undefined, undefined)).toThrow(
      /required/,
    );
    expect(() =>
      publicSupabaseConfig("https://test.supabase.co", "sb_secret_example"),
    ).toThrow(/never/);
    const jwt =
      "header." + btoa(JSON.stringify({ role: "service_role" })) + ".signature";
    expect(() => publicSupabaseConfig("https://test.supabase.co", jwt)).toThrow(
      /never/,
    );
  });
  it("allows local Supabase and rejects unencrypted remote URLs", () => {
    expect(
      publicSupabaseConfig("http://127.0.0.1:54321", "public-test").url,
    ).toContain("54321");
    expect(() =>
      publicSupabaseConfig("http://test.supabase.co", "public-test"),
    ).toThrow(/HTTPS/);
  });
});

describe("shared workspace activation", () => {
  it("requires explicit activation after database setup", () => {
    for (const value of [undefined, "false", "TRUE", "1", ""])
      expect(sharedWorkspaceEnabled(value)).toBe(false);
    expect(sharedWorkspaceEnabled("true")).toBe(true);
  });
});
