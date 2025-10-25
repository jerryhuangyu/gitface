import {
	type ConfigScope,
	type GitIdentity,
	GitService,
} from "@/core/git-service";
import { Profile, type ProfileInput, type ProfileUpdate } from "@/core/profile";
import {
	InvalidProfileError,
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "@/errors/index";
import { FileProfileStore, type ProfileStore } from "@/infra/profile-store";

export interface CreateProfileOptions {
	name: string;
	gitName?: string;
	email?: string;
	signingKey?: string | null;
	force?: boolean;
}

export interface UpdateProfileOptions extends ProfileUpdate {}

export interface GitGateway {
	getCurrentIdentity(): Promise<GitIdentity>;
	applyIdentity(
		identity: { gitName: string; email: string; signingKey?: string | null },
		scope: ConfigScope,
	): Promise<void>;
}

export class ProfileService {
	constructor(
		private readonly store: ProfileStore,
		private readonly gitGateway: GitGateway,
	) {}

	static create(): ProfileService {
		return new ProfileService(new FileProfileStore(), new GitService());
	}

	async listProfiles(): Promise<Profile[]> {
		const snapshots = await this.store.list();
		return snapshots
			.map((snapshot) => Profile.fromSnapshot(snapshot))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getProfile(name: string): Promise<Profile> {
		if (!(await this.store.exists(name))) {
			throw new ProfileNotFoundError(name);
		}
		const snapshot = await this.store.load(name);
		return Profile.fromSnapshot(snapshot);
	}

	async createProfile(options: CreateProfileOptions): Promise<Profile> {
		const force = options.force ?? false;
		if (!force && (await this.store.exists(options.name))) {
			throw new ProfileAlreadyExistsError(options.name);
		}

		const profileInput = await this.buildProfileInput(options);
		const profile = Profile.create(profileInput);
		await this.store.save(profile);
		return profile;
	}

	async updateProfile(
		name: string,
		update: UpdateProfileOptions,
	): Promise<Profile> {
		const profile = await this.getProfile(name);
		profile.update(update);
		await this.store.save(profile);
		return profile;
	}

	async deleteProfile(name: string): Promise<void> {
		if (!(await this.store.exists(name))) {
			throw new ProfileNotFoundError(name);
		}
		await this.store.remove(name);
	}

	async useProfile(
		name: string,
		scope: ConfigScope = "local",
	): Promise<Profile> {
		const profile = await this.getProfile(name);
		await this.gitGateway.applyIdentity(
			{
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? undefined,
			},
			scope,
		);
		return profile;
	}

	async getCurrentIdentity(): Promise<GitIdentity> {
		return this.gitGateway.getCurrentIdentity();
	}

	private async buildProfileInput(
		options: CreateProfileOptions,
	): Promise<ProfileInput> {
		const fallback = await this.gitGateway.getCurrentIdentity();
		const gitName = options.gitName ?? fallback.gitName;
		const email = options.email ?? fallback.email;
		const signingKey = options.signingKey ?? fallback.signingKey ?? null;

		if (!gitName || !gitName.trim()) {
			throw new InvalidProfileError(
				"Git user.name is required. Provide --git-name or configure Git before creating a profile.",
			);
		}

		if (!email || !email.trim()) {
			throw new InvalidProfileError(
				"Git user.email is required. Provide --email or configure Git before creating a profile.",
			);
		}

		return {
			name: options.name,
			gitName,
			email,
			signingKey,
		};
	}
}
