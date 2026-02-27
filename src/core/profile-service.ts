import {
	type ConfigScope,
	type GitIdentity,
	GitService,
} from "@/core/git-service";
import { Profile, type ProfileInput, type ProfileUpdate } from "@/domain/profile";
import {
	InvalidProfileError,
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "@/errors/index";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/infra/logger";
import { osPaths } from "@/infra/os-path";
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

	getProfileConfigPath(name: string): string {
		const configDir =
			osPaths.config("gitface") || path.join(process.cwd(), "gitface");
		return path.join(configDir, "identities", `${name}.gitconfig`);
	}

	private async ensureProfileConfig(profile: Profile): Promise<void> {
		const filePath = this.getProfileConfigPath(profile.name);
		const dir = path.dirname(filePath);
		await mkdir(dir, { recursive: true });

		let content = `[user]\n\tname = ${profile.gitName}\n\temail = ${profile.email}\n`;
		if (profile.signingKey) {
			content += `\tsigningkey = ${profile.signingKey}\n`;
		}

		await writeFile(filePath, content, "utf8");
		logger.debug("profile-service:ensureProfileConfig saved", {
			name: profile.name,
			filePath,
		});
	}

	private async removeProfileConfig(name: string): Promise<void> {
		const filePath = this.getProfileConfigPath(name);
		try {
			await unlink(filePath);
			logger.debug("profile-service:removeProfileConfig removed", {
				name,
				filePath,
			});
		} catch (error) {
			logger.debug("profile-service:removeProfileConfig config missing", {
				name,
				filePath,
			});
		}
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
		await this.ensureProfileConfig(profile);
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
		await this.ensureProfileConfig(profile);
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
		await this.removeProfileConfig(name);
		logger.info("profile-service:deleteProfile removed", { name });
	}

	async cloneProfile(
		sourceName: string,
		targetName: string,
		force = false,
	): Promise<Profile> {
		logger.info("profile-service:cloneProfile invoked", {
			sourceName,
			targetName,
			force,
		});

		const sourceProfile = await this.getProfile(sourceName);

		if (!force && (await this.store.exists(targetName))) {
			throw new ProfileAlreadyExistsError(targetName);
		}

		const newProfile = Profile.create({
			name: targetName,
			gitName: sourceProfile.gitName,
			email: sourceProfile.email,
			signingKey: sourceProfile.signingKey,
		});

		await this.store.save(newProfile);
		await this.ensureProfileConfig(newProfile);
		logger.info("profile-service:cloneProfile saved", {
			name: newProfile.name,
		});
		return newProfile;
	}

	async renameProfile(
		oldName: string,
		newName: string,
		force = false,
	): Promise<Profile> {
		logger.info("profile-service:renameProfile invoked", {
			oldName,
			newName,
			force,
		});

		const profile = await this.getProfile(oldName);

		if (!force && (await this.store.exists(newName))) {
			throw new ProfileAlreadyExistsError(newName);
		}

		const newProfile = Profile.create({
			name: newName,
			gitName: profile.gitName,
			email: profile.email,
			signingKey: profile.signingKey,
		});

		await this.store.save(newProfile);
		await this.ensureProfileConfig(newProfile);
		await this.store.remove(oldName);
		await this.removeProfileConfig(oldName);

		logger.info("profile-service:renameProfile completed", {
			oldName,
			newName,
		});
		return newProfile;
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
