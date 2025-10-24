import { describe, expect, test, vi } from "vitest";
import type { ConfigScope, GitIdentity } from "../src/core/git-service.js";
import type { Profile } from "../src/core/profile.js";
import {
	type GitGateway,
	ProfileService,
} from "../src/core/profile-service.js";
import {
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "../src/errors/index.js";
import type {
	ProfileRecord,
	ProfileStore,
} from "../src/infrastructure/profile-store.js";

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

function createService(
	overrides: { store?: ProfileStore; git?: GitGateway } = {},
): ProfileService {
	const store = overrides.store ?? new InMemoryProfileStore();
	const git = overrides.git ?? new FakeGitGateway({ gitName: "", email: "" });
	return new ProfileService(store, git);
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

		await service.useProfile("work", "global");

		expect(applySpy).toHaveBeenCalledTimes(1);
		expect(applySpy.mock.calls[0]?.[1]).toBe("global");
	});
});
