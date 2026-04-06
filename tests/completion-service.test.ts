import { describe, expect, test } from "vitest";
import { CompletionService } from "../src/core/completion-service";
import type { ConfigScope, GitIdentity } from "../src/core/git-service";
import { type GitGateway, ProfileService } from "../src/core/profile-service";
import type { Profile } from "../src/domain/profile";
import { ProfileNotFoundError } from "../src/errors";
import type { ProfileConfigStore } from "../src/infra/profile-config-store";
import type { ProfileRecord, ProfileStore } from "../src/infra/profile-store";

class InMemoryProfileStore implements ProfileStore {
  private readonly store = new Map<string, ProfileRecord>();

  async listNames(): Promise<string[]> {
    return Array.from(this.store.keys()).sort((a, b) => a.localeCompare(b));
  }

  async list(): Promise<ProfileRecord[]> {
    return Array.from(this.store.values()).map((snapshot) => ({ ...snapshot }));
  }

  async load(name: string): Promise<ProfileRecord> {
    const snapshot = this.store.get(name);
    if (!snapshot) {
      throw new ProfileNotFoundError(name);
    }
    return { ...snapshot };
  }

  async save(profile: Profile): Promise<void> {
    this.store.set(profile.name, profile.snapshot());
  }

  async remove(name: string): Promise<void> {
    if (!this.store.delete(name)) {
      throw new ProfileNotFoundError(name);
    }
  }

  async exists(name: string): Promise<boolean> {
    return this.store.has(name);
  }
}

class FakeGitGateway implements GitGateway {
  constructor(private readonly identity: GitIdentity) {}

  async getCurrentIdentity(): Promise<GitIdentity> {
    return this.identity;
  }

  async getScopedIdentity(_scope: ConfigScope): Promise<GitIdentity> {
    return this.identity;
  }

  async applyIdentity(): Promise<void> {}
}

class NoopProfileConfigStore implements ProfileConfigStore {
  getProfileConfigPath(name: string): string {
    return `/tmp/gitface-test/identities/${name}.gitconfig`;
  }

  async save(_profile: Profile): Promise<void> {}

  async remove(_name: string): Promise<void> {}
}

function createCompletionService(): {
  completionService: CompletionService;
  profileService: ProfileService;
} {
  const profileService = new ProfileService(
    new InMemoryProfileStore(),
    new FakeGitGateway({ gitName: "", email: "" }),
    new NoopProfileConfigStore(),
  );

  return {
    completionService: new CompletionService(profileService),
    profileService,
  };
}

describe("CompletionService", () => {
  test("returns profile names filtered by case-insensitive prefix", async () => {
    const { completionService, profileService } = createCompletionService();
    await profileService.createProfile({
      name: "WorkAdmin",
      gitName: "Work Admin",
      email: "work@example.com",
    });
    await profileService.createProfile({
      name: "home",
      gitName: "Home User",
      email: "home@example.com",
    });

    const result = await completionService.resolve("profiles", {
      prefix: "wo",
    });

    expect(result).toEqual({
      topic: "profiles",
      prefix: "wo",
      limit: null,
      count: 1,
      names: ["WorkAdmin"],
    });
  });

  test("returns top-level commands filtered by prefix", async () => {
    const { completionService } = createCompletionService();

    const result = await completionService.resolve("commands", {
      prefix: "us",
    });

    expect(result).toEqual({
      topic: "commands",
      prefix: "us",
      limit: null,
      count: 1,
      names: ["use"],
    });
  });

  test("returns rules subcommands filtered by prefix", async () => {
    const { completionService } = createCompletionService();

    const result = await completionService.resolve("rules-commands", {
      prefix: "re",
    });

    expect(result).toEqual({
      topic: "rules-commands",
      prefix: "re",
      limit: null,
      count: 2,
      names: ["remove", "resolve"],
    });
  });

  test("applies a numeric limit to filtered candidates", async () => {
    const { completionService } = createCompletionService();

    const result = await completionService.resolve("commands", {
      limit: "2",
    });

    expect(result.names).toEqual(["clone", "completion"]);
    expect(result.count).toBe(2);
    expect(result.limit).toBe(2);
  });

  test("rejects non-positive limits", async () => {
    const { completionService } = createCompletionService();

    await expect(completionService.resolve("commands", { limit: "0" })).rejects.toThrow(
      "Limit must be a positive integer.",
    );
  });
});
