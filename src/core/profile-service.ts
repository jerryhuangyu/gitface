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
import { logger } from "@/infra/logger";
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
		logger.debug("profile-service:listProfiles invoked");
		const snapshots = await this.store.list();
		const profiles = snapshots
			.map((snapshot) => Profile.fromSnapshot(snapshot))
			.sort((a, b) => a.name.localeCompare(b.name));
		logger.debug("profile-service:listProfiles completed", {
			count: profiles.length,
		});
		return profiles;
	}

	async findProfile(name: string): Promise<Profile | null> {
		logger.debug("profile-service:findProfile invoked", { name });
		if (!(await this.store.exists(name))) {
			logger.debug("profile-service:findProfile missing profile", { name });
			return null;
		}
		const snapshot = await this.store.load(name);
		const profile = Profile.fromSnapshot(snapshot);
		logger.debug("profile-service:findProfile resolved profile", { name });
		return profile;
	}

	async getProfile(name: string): Promise<Profile> {
		logger.debug("profile-service:getProfile invoked", { name });
		if (!(await this.store.exists(name))) {
			logger.warn("profile-service:getProfile profile not found", { name });
			throw new ProfileNotFoundError(name);
		}
		const snapshot = await this.store.load(name);
		const profile = Profile.fromSnapshot(snapshot);
		logger.debug("profile-service:getProfile resolved", { name });
		return profile;
	}

	async createProfile(options: CreateProfileOptions): Promise<Profile> {
		const force = options.force ?? false;
		logger.info("profile-service:createProfile invoked", {
			name: options.name,
			force,
		});

		if (!force && (await this.store.exists(options.name))) {
			logger.warn("profile-service:createProfile profile exists", {
				name: options.name,
			});
			throw new ProfileAlreadyExistsError(options.name);
		}

		const profileInput = await this.buildProfileInput(options);
		const profile = Profile.create(profileInput);
		await this.store.save(profile);
		logger.info("profile-service:createProfile saved", {
			name: profile.name,
		});
		return profile;
	}

	async updateProfile(
		name: string,
		update: UpdateProfileOptions,
	): Promise<Profile> {
		logger.info("profile-service:updateProfile invoked", {
			name,
			fields: Object.keys(update).filter(
				(key) => (update as Record<string, unknown>)[key] !== undefined,
			),
		});
		const profile = await this.getProfile(name);
		profile.update(update);
		await this.store.save(profile);
		logger.info("profile-service:updateProfile saved", { name: profile.name });
		return profile;
	}

	async deleteProfile(name: string): Promise<void> {
		logger.info("profile-service:deleteProfile invoked", { name });
		if (!(await this.store.exists(name))) {
			logger.warn("profile-service:deleteProfile profile not found", { name });
			throw new ProfileNotFoundError(name);
		}
		await this.store.remove(name);
		logger.info("profile-service:deleteProfile removed", { name });
	}

	async applyProfile(
		name: string,
		scope: ConfigScope = "local",
	): Promise<Profile> {
		logger.info("profile-service:applyProfile invoked", { name, scope });
		const profile = await this.getProfile(name);
		await this.gitGateway.applyIdentity(
			{
				gitName: profile.gitName,
				email: profile.email,
				signingKey: profile.signingKey ?? undefined,
			},
			scope,
		);
		logger.info("profile-service:applyProfile applied", { name, scope });
		return profile;
	}

	async getCurrentIdentity(): Promise<GitIdentity> {
		logger.debug("profile-service:getCurrentIdentity invoked");
		const identity = await this.gitGateway.getCurrentIdentity();
		logger.debug("profile-service:getCurrentIdentity resolved", identity);
		return identity;
	}

	private async buildProfileInput(
		options: CreateProfileOptions,
	): Promise<ProfileInput> {
		logger.debug("profile-service:buildProfileInput invoked", {
			name: options.name,
		});
		const fallback = await this.gitGateway.getCurrentIdentity();
		const gitName = options.gitName ?? fallback.gitName;
		const email = options.email ?? fallback.email;
		const signingKey = options.signingKey ?? fallback.signingKey ?? null;

		if (
			options.gitName === undefined ||
			options.email === undefined ||
			options.signingKey === undefined
		) {
			logger.debug(
				"profile-service:buildProfileInput using fallback identity",
				{
					hasGitNameFallback: options.gitName === undefined,
					hasEmailFallback: options.email === undefined,
					hasSigningKeyFallback: options.signingKey === undefined,
				},
			);
		}

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
