import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const raw = vi.fn();
  const listConfig = vi.fn();
  const addConfig = vi.fn();
  const simpleGit = vi.fn(() => ({
    raw,
    listConfig,
    addConfig,
  }));
  return { raw, listConfig, addConfig, simpleGit };
});

vi.mock("simple-git", () => ({
  simpleGit: mocks.simpleGit,
}));

import { GitService } from "../src/core/git-service";

describe("GitService.getScopedIdentity", () => {
  beforeEach(() => {
    mocks.raw.mockReset();
    mocks.listConfig.mockReset();
    mocks.addConfig.mockReset();
    mocks.simpleGit.mockClear();
  });

  test("uses a single scoped --list read when available", async () => {
    mocks.raw.mockResolvedValueOnce(
      "user.name=Alice\nuser.email=alice@example.com\nuser.signingkey=ABC123\n",
    );

    const service = new GitService();
    const identity = await service.getScopedIdentity("global");

    expect(identity).toEqual({
      gitName: "Alice",
      email: "alice@example.com",
      signingKey: "ABC123",
    });
    expect(mocks.raw).toHaveBeenCalledTimes(1);
    expect(mocks.raw).toHaveBeenCalledWith(["config", "--global", "--list"]);
  });

  test("falls back to per-key lookups if scoped --list fails", async () => {
    mocks.raw
      .mockRejectedValueOnce(new Error("list failed"))
      .mockResolvedValueOnce("Alice")
      .mockResolvedValueOnce("alice@example.com")
      .mockResolvedValueOnce("ABC123");

    const service = new GitService();
    const identity = await service.getScopedIdentity("global");

    expect(identity).toEqual({
      gitName: "Alice",
      email: "alice@example.com",
      signingKey: "ABC123",
    });
    expect(mocks.raw).toHaveBeenCalledTimes(4);
    expect(mocks.raw.mock.calls).toEqual([
      [["config", "--global", "--list"]],
      [["config", "--global", "--get", "user.name"]],
      [["config", "--global", "--get", "user.email"]],
      [["config", "--global", "--get", "user.signingkey"]],
    ]);
  });
});

describe("GitService.getConfigByRegexp", () => {
  beforeEach(() => {
    mocks.raw.mockReset();
    mocks.listConfig.mockReset();
    mocks.addConfig.mockReset();
    mocks.simpleGit.mockClear();
  });

  test("parses regexp config output and preserves spaces in value", async () => {
    mocks.raw.mockResolvedValueOnce(
      "includeif.gitdir:/work/.path /Users/test/.config/gitface/identities/work.gitconfig\n",
    );

    const service = new GitService();
    const result = await service.getConfigByRegexp("^includeif\\.gitdir:.*\\.path$", "global");

    expect(result).toEqual({
      "includeif.gitdir:/work/.path": "/Users/test/.config/gitface/identities/work.gitconfig",
    });
    expect(mocks.raw).toHaveBeenCalledWith([
      "config",
      "--global",
      "--get-regexp",
      "^includeif\\.gitdir:.*\\.path$",
    ]);
  });

  test("returns empty object when regexp match is missing", async () => {
    const noMatch = new Error("no match");
    (noMatch as Error & { exitCode?: number }).exitCode = 1;
    mocks.raw.mockRejectedValueOnce(noMatch);

    const service = new GitService();
    const result = await service.getConfigByRegexp("^includeif\\.gitdir:.*\\.path$", "global");

    expect(result).toEqual({});
  });
});

describe("GitService.applyIdentity", () => {
  beforeEach(() => {
    mocks.raw.mockReset();
    mocks.listConfig.mockReset();
    mocks.addConfig.mockReset();
    mocks.simpleGit.mockClear();
  });

  test("applies name/email/signing key when signing key is provided", async () => {
    mocks.raw.mockResolvedValueOnce(
      "user.name=Old Name\nuser.email=old@example.com\nuser.signingkey=OLDKEY\n",
    );
    mocks.addConfig.mockResolvedValue(undefined);

    const service = new GitService();
    await service.applyIdentity(
      {
        gitName: "New Name",
        email: "new@example.com",
        signingKey: "NEWKEY",
      },
      "global",
    );

    expect(mocks.raw).toHaveBeenCalledTimes(1);
    expect(mocks.raw).toHaveBeenCalledWith(["config", "--global", "--list"]);
    expect(mocks.addConfig.mock.calls).toEqual([
      ["user.name", "New Name", false, "global"],
      ["user.email", "new@example.com", false, "global"],
      ["user.signingkey", "NEWKEY", false, "global"],
    ]);
  });

  test("unsets signing key when target identity has no signing key", async () => {
    mocks.raw
      .mockResolvedValueOnce(
        "user.name=Old Name\nuser.email=old@example.com\nuser.signingkey=OLDKEY\n",
      )
      .mockResolvedValueOnce("");
    mocks.addConfig.mockResolvedValue(undefined);

    const service = new GitService();
    await service.applyIdentity(
      {
        gitName: "New Name",
        email: "new@example.com",
        signingKey: undefined,
      },
      "global",
    );

    expect(mocks.addConfig.mock.calls).toEqual([
      ["user.name", "New Name", false, "global"],
      ["user.email", "new@example.com", false, "global"],
    ]);
    expect(mocks.raw.mock.calls).toEqual([
      [["config", "--global", "--list"]],
      [["config", "--global", "--unset-all", "user.signingkey"]],
    ]);
  });

  test("rolls back to previous scoped identity when apply fails", async () => {
    mocks.raw
      .mockResolvedValueOnce(
        "user.name=Old Name\nuser.email=old@example.com\nuser.signingkey=OLDKEY\n",
      )
      .mockResolvedValueOnce("");
    mocks.addConfig
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("write user.email failed"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const service = new GitService();
    await expect(
      service.applyIdentity(
        {
          gitName: "New Name",
          email: "new@example.com",
          signingKey: undefined,
        },
        "global",
      ),
    ).rejects.toThrow(
      "Failed to apply identity changes. Git config was rolled back to previous state.",
    );

    expect(mocks.addConfig.mock.calls).toEqual([
      ["user.name", "New Name", false, "global"],
      ["user.email", "new@example.com", false, "global"],
      ["user.name", "Old Name", false, "global"],
      ["user.email", "old@example.com", false, "global"],
      ["user.signingkey", "OLDKEY", false, "global"],
    ]);
    expect(mocks.raw.mock.calls).toEqual([[["config", "--global", "--list"]]]);
  });

  test("reports both apply and rollback errors when rollback also fails", async () => {
    mocks.raw.mockResolvedValueOnce("user.name=Old Name\nuser.email=old@example.com\n");
    mocks.addConfig
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("write user.email failed"))
      .mockRejectedValueOnce(new Error("rollback user.name failed"));

    const service = new GitService();
    await expect(
      service.applyIdentity(
        {
          gitName: "New Name",
          email: "new@example.com",
          signingKey: undefined,
        },
        "global",
      ),
    ).rejects.toThrow("Rollback after apply failure also failed");
  });
});
