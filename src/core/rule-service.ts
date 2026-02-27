import { GitService } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { type FolderRule, Rule } from "@/domain/rule";
import { logger } from "@/infra/logger";

export type { FolderRule };

export class RuleService {
	constructor(
		private readonly profileService: ProfileService,
		private readonly gitService: GitService,
	) {}

	static create(): RuleService {
		return new RuleService(ProfileService.create(), new GitService());
	}

	async listRules(): Promise<FolderRule[]> {
		logger.debug("rule-service:listRules invoked");
		const allConfig = await this.gitService.getAllConfig("global");
		const rules: FolderRule[] = [];

		for (const [key, value] of Object.entries(allConfig)) {
			const rule = Rule.parse(key, value);
			if (rule) {
				rules.push(rule);
			}
		}

		return rules;
	}

	async addRule(directory: string, profileName: string): Promise<void> {
		const rule = Rule.create(directory, profileName);

		logger.info("rule-service:addRule invoked", {
			directory: rule.directory,
			profileName: rule.profileName,
		});

		const profile = await this.profileService.getProfile(profileName);
		const configPath = this.profileService.getProfileConfigPath(profile.name);

		// Remove existing rule for this directory if any, to avoid duplicates
		await this.gitService.removeConfig(rule.configKey, "global");
		await this.gitService.addConfig(rule.configKey, configPath, "global");

		logger.info("rule-service:addRule added", {
			directory: rule.directory,
			profileName: rule.profileName,
		});
	}

	async removeRule(directory: string): Promise<void> {
		// Create a dummy rule just to get the config key from directory
		const rule = Rule.create(directory, "dummy");

		logger.info("rule-service:removeRule invoked", {
			directory: rule.directory,
		});

		await this.gitService.removeConfig(rule.configKey, "global");

		logger.info("rule-service:removeRule removed", {
			directory: rule.directory,
		});
	}
}
