import { describe, expect, test, vi } from "vitest";
import type { ConfigScope, GitIdentity } from "../src/core/git-service";
import type { Profile } from "../src/domain/profile";
import { type GitGateway, ProfileService } from "../src/core/profile-service";
import { ProfileAlreadyExistsError, ProfileNotFoundError } from "../src/errors";
import type { ProfileConfigStore } from "../src/infra/profile-config-store";
import type { ProfileRecord, ProfileStore } from "../src/infra/profile-store";

class InMemoryProfileStore implements ProfileStore {
	private readonly store = new Map<string, ProfileRecord>();

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
	public readonly applied: Array<{
		identity: GitIdentity;
		scope: ConfigScope;
	}> = [];

	constructor(private identity: GitIdentity) {}

	async getCurrentIdentity(): Promise<GitIdentity> {
		return this.identity;
	}

	async applyIdentity(
		identity: { gitName: string; email: string; signingKey?: string | null },
		scope: ConfigScope,
	): Promise<void> {
		this.applied.push({
			identity: {
				gitName: identity.gitName,
				email: identity.email,
				signingKey: identity.signingKey ?? undefined,
			},
			scope,
		});
	}
}

class NoopProfileConfigStore implements ProfileConfigStore {
	getProfileConfigPath(name: string): string {
		return `/tmp/gitface-test/identities/${name}.gitconfig`;
	}

	async save(_profile: Profile): Promise<void> {}

	async remove(_name: string): Promise<void> {}
}

class RecordingProfileConfigStore extends NoopProfileConfigStore {
	public readonly saved: string[] = [];
	public readonly removed: string[] = [];

	override async save(profile: Profile): Promise<void> {
		this.saved.push(profile.name);
	}

	override async remove(name: string): Promise<void> {
		this.removed.push(name);
	}
}

function createService(
	overrides: {
		store?: ProfileStore;
		git?: GitGateway;
		configStore?: ProfileConfigStore;
	} = {},
): ProfileService {
	const store = overrides.store ?? new InMemoryProfileStore();
	const git = overrides.git ?? new FakeGitGateway({ gitName: "", email: "" });
	const configStore = overrides.configStore ?? new NoopProfileConfigStore();
	return new ProfileService(store, git, configStore);
}

describe("ProfileService", () => {
	test("creates a profile from the current Git identity", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane Doe",
			email: "jane@example.com",
		});
		const service = createService({ git });

		const profile = await service.createProfile({ name: "work" });

		expect(profile.name).toBe("work");
		expect(profile.gitName).toBe("Jane Doe");
		expect(profile.email).toBe("jane@example.com");

		const fetched = await service.getProfile("work");
		expect(fetched.gitName).toBe("Jane Doe");
	});

	test("prevents duplicate profile names unless forced", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane",
			email: "jane@example.com",
		});
		const service = createService({ git });

		await service.createProfile({ name: "work" });
		await expect(
			service.createProfile({ name: "work" }),
		).rejects.toBeInstanceOf(ProfileAlreadyExistsError);

		const profile = await service.createProfile({ name: "work", force: true });
		expect(profile.name).toBe("work");
	});

	test("applies a profile to the requested Git scope", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane",
			email: "jane@example.com",
		});
		const service = createService({ git });
		const applySpy = vi.spyOn(git, "applyIdentity");

		await service.createProfile({
			name: "work",
			gitName: "Jane",
			email: "jane@example.com",
			signingKey: "ABC123",
		});

		await service.applyProfile("work", "global");

		expect(applySpy).toHaveBeenCalledTimes(1);
		expect(applySpy.mock.calls[0]?.[1]).toBe("global");
	});

	test("clones a profile", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane",
			email: "jane@example.com",
		});
		const service = createService({ git });

		await service.createProfile({
			name: "source",
			gitName: "Source User",
			email: "source@example.com",
		});

		const cloned = await service.cloneProfile("source", "target");

		expect(cloned.name).toBe("target");
		expect(cloned.gitName).toBe("Source User");
		expect(cloned.email).toBe("source@example.com");

		const fetched = await service.getProfile("target");
		expect(fetched.gitName).toBe("Source User");
	});

	test("renames a profile", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane",
			email: "jane@example.com",
		});
		const service = createService({ git });

		await service.createProfile({
			name: "old",
			gitName: "Old User",
			email: "old@example.com",
		});

		const renamed = await service.renameProfile("old", "new");

		expect(renamed.name).toBe("new");
		expect(renamed.gitName).toBe("Old User");

		await expect(service.getProfile("old")).rejects.toBeInstanceOf(
			ProfileNotFoundError,
		);
		const fetched = await service.getProfile("new");
		expect(fetched.gitName).toBe("Old User");
	});

	test("syncs profile identity configs through config store", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane",
			email: "jane@example.com",
		});
		const configStore = new RecordingProfileConfigStore();
		const service = createService({ git, configStore });

		await service.createProfile({
			name: "source",
			gitName: "Source User",
			email: "source@example.com",
		});
		await service.updateProfile("source", { gitName: "Source Updated" });
		await service.cloneProfile("source", "copy");
		await service.renameProfile("copy", "copy-renamed");
		await service.deleteProfile("copy-renamed");

		expect(configStore.saved).toEqual([
			"source",
			"source",
			"copy",
			"copy-renamed",
		]);
		expect(configStore.removed).toEqual(["copy", "copy-renamed"]);
	});

	test("removeProfile returns deleted snapshot", async () => {
		const git = new FakeGitGateway({
			gitName: "Jane",
			email: "jane@example.com",
		});
		const service = createService({ git });

		await service.createProfile({
			name: "temp",
			gitName: "Temp User",
			email: "temp@example.com",
			signingKey: "TEMPKEY",
		});

		const removed = await service.removeProfile("temp");
		expect(removed.name).toBe("temp");
		expect(removed.gitName).toBe("Temp User");
		expect(removed.email).toBe("temp@example.com");
		expect(removed.signingKey).toBe("TEMPKEY");
		await expect(service.getProfile("temp")).rejects.toBeInstanceOf(
			ProfileNotFoundError,
		);
	});
});
