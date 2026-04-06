import { describe, expect, test } from "vitest";
import type { ConfigScope, GitIdentity } from "../src/core/git-service";
import { ProfileCloneService } from "../src/core/profile-clone-service";
import { type GitGateway, ProfileService } from "../src/core/profile-service";
import type { Profile } from "../src/domain/profile";
import { ProfileAlreadyExistsError, ProfileNotFoundError } from "../src/errors";
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

function createCloneService(): {
  cloneService: ProfileCloneService;
  profileService: ProfileService;
} {
  const profileService = new ProfileService(
    new InMemoryProfileStore(),
    new FakeGitGateway({ gitName: "", email: "" }),
    new NoopProfileConfigStore(),
  );

  return {
    cloneService: new ProfileCloneService(profileService),
    profileService,
  };
}

describe("ProfileCloneService", () => {
  test("previews clone data without writing the target profile", async () => {
    const { cloneService, profileService } = createCloneService();
    await profileService.createProfile({
      name: "source",
      gitName: "Source User",
      email: "source@example.com",
      signingKey: "SRC",
    });

    const preview = await cloneService.previewClone("source", "target");

    expect(preview).toMatchObject({
      sourceName: "source",
      targetName: "target",
      overwrite: false,
    });
    expect(preview.profile.name).toBe("source");
    expect(preview.profile.gitName).toBe("Source User");
    await expect(profileService.getProfile("target")).rejects.toBeInstanceOf(ProfileNotFoundError);
  });

  test("reports overwrite in preview when force is enabled", async () => {
    const { cloneService, profileService } = createCloneService();
    await profileService.createProfile({
      name: "source",
      gitName: "Source User",
      email: "source@example.com",
    });
    await profileService.createProfile({
      name: "target",
      gitName: "Target User",
      email: "target@example.com",
    });

    const preview = await cloneService.previewClone("source", "target", {
      force: true,
    });

    expect(preview.overwrite).toBe(true);
    const target = await profileService.getProfile("target");
    expect(target.gitName).toBe("Target User");
  });

  test("rejects preview when target exists without force", async () => {
    const { cloneService, profileService } = createCloneService();
    await profileService.createProfile({
      name: "source",
      gitName: "Source User",
      email: "source@example.com",
    });
    await profileService.createProfile({
      name: "target",
      gitName: "Target User",
      email: "target@example.com",
    });

    await expect(cloneService.previewClone("source", "target")).rejects.toBeInstanceOf(
      ProfileAlreadyExistsError,
    );
  });

  test("clones a profile through the application service", async () => {
    const { cloneService, profileService } = createCloneService();
    await profileService.createProfile({
      name: "source",
      gitName: "Source User",
      email: "source@example.com",
      signingKey: "SRC",
    });

    const result = await cloneService.cloneProfile("source", "target");

    expect(result.sourceName).toBe("source");
    expect(result.targetName).toBe("target");
    expect(result.profile.name).toBe("target");
    expect(result.profile.gitName).toBe("Source User");

    const cloned = await profileService.getProfile("target");
    expect(cloned.email).toBe("source@example.com");
    expect(cloned.signingKey).toBe("SRC");
  });
});
