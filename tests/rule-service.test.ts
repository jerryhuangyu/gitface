import { describe, expect, test, vi } from "vitest";
import { RuleService, ruleDirectoryMatchesTarget } from "../src/core/rule-service";

describe("ruleDirectoryMatchesTarget", () => {
  test("matches ignoring case on macOS", () => {
    expect(
      ruleDirectoryMatchesTarget("/Users/Jerry/Work/", "/users/jerry/work/repo/", "darwin"),
    ).toBe(true);
  });

  test("matches ignoring case on Windows", () => {
    expect(
      ruleDirectoryMatchesTarget(
        "C:\\Users\\Jerry\\Work\\",
        "c:\\users\\jerry\\work\\repo\\",
        "win32",
      ),
    ).toBe(true);
  });

  test("keeps case-sensitive behavior on Linux", () => {
    expect(ruleDirectoryMatchesTarget("/home/jerry/Work/", "/home/jerry/work/repo/", "linux")).toBe(
      false,
    );
  });

  test("still requires prefix match after normalization", () => {
    expect(ruleDirectoryMatchesTarget("/Users/Jerry/Work/", "/Users/Jerry/Other/", "darwin")).toBe(
      false,
    );
  });

  test("resolveRuleForDirectory keeps longest-prefix priority", async () => {
    const service = new RuleService({} as never, {} as never);
    vi.spyOn(service, "listRules").mockResolvedValue([
      { directory: "/Users/jerry/", profileName: "root" },
      { directory: "/Users/jerry/work/", profileName: "work" },
    ]);

    const matched = await service.resolveRuleForDirectory("/users/Jerry/work/repo", "darwin");
    expect(matched).toEqual({
      directory: "/Users/jerry/work/",
      profileName: "work",
    });
  });
});
