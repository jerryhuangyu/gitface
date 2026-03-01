import type { Profile } from "@/domain/profile";
import { ProfileNotFoundError } from "@/errors";
import { ProfileService } from "./profile-service";

export type RemoveProfileResultType = "removed" | "dry-run" | "skipped";

export interface RemoveProfileResult {
	result: RemoveProfileResultType;
	name: string;
	force: boolean;
	profile: Profile | null;
	reason: string | null;
}

export interface RemoveProfileOptions {
	dryRun?: boolean;
	force?: boolean;
}

export class ProfileRemoveService {
	constructor(private readonly profileService: ProfileService) {}

	static create(): ProfileRemoveService {
		return new ProfileRemoveService(ProfileService.create());
	}

	async executeRemove(
		name: string,
		options: RemoveProfileOptions = {},
	): Promise<RemoveProfileResult> {
		const dryRun = options.dryRun ?? false;
		const force = options.force ?? false;

		if (dryRun) {
			const profile = await this.profileService.getProfile(name);
			return {
				result: "dry-run",
				name: profile.name,
				force,
				profile,
				reason: null,
			};
		}

		try {
			const profile = await this.profileService.removeProfile(name);
			return {
				result: "removed",
				name: profile.name,
				force,
				profile,
				reason: null,
			};
		} catch (error) {
			if (force && error instanceof ProfileNotFoundError) {
				return {
					result: "skipped",
					name,
					force: true,
					profile: null,
					reason: "Profile not found.",
				};
			}
			throw error;
		}
	}
}
