import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import type { Profile } from "@/domain/profile";

export interface RenamePreview {
	profile: Profile;
	overwrite: boolean;
	rulesToUpdate: number;
}

export interface RenameResult {
	profile: Profile;
	rulesUpdated: number;
}

export class ProfileRenameService {
	constructor(
		private readonly profileService: ProfileService,
		private readonly ruleService: RuleService,
	) {}

	static create(): ProfileRenameService {
		return new ProfileRenameService(
			ProfileService.create(),
			RuleService.create(),
		);
	}

	async previewRename(
		oldName: string,
		newName: string,
	): Promise<RenamePreview> {
		const profile = await this.profileService.getProfile(oldName);
		const targetProfile = await this.profileService.findProfile(newName);
		const rulesToUpdate = await this.countRulesUsingProfile(oldName);
		return {
			profile,
			overwrite: targetProfile !== null,
			rulesToUpdate,
		};
	}

	async renameProfile(
		oldName: string,
		newName: string,
		force: boolean,
	): Promise<RenameResult> {
		const profile = await this.profileService.renameProfile(
			oldName,
			newName,
			force,
		);
		const rulesUpdated = await this.migrateRulesToRenamedProfile(
			oldName,
			newName,
		);
		return {
			profile,
			rulesUpdated,
		};
	}

	private async countRulesUsingProfile(profileName: string): Promise<number> {
		try {
			const rules = await this.ruleService.listRules();
			return rules.filter((rule) => rule.profileName === profileName).length;
		} catch (error) {
			if (isMissingGlobalConfigError(error)) {
				return 0;
			}
			throw error;
		}
	}

	private async migrateRulesToRenamedProfile(
		oldName: string,
		newName: string,
	): Promise<number> {
		try {
			const rules = await this.ruleService.listRules();
			const impactedRules = rules.filter(
				(rule) => rule.profileName === oldName,
			);
			for (const rule of impactedRules) {
				await this.ruleService.addRule(rule.directory, newName);
			}
			return impactedRules.length;
		} catch (error) {
			if (isMissingGlobalConfigError(error)) {
				return 0;
			}
			throw error;
		}
	}
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};
