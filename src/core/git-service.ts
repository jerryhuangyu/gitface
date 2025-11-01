import {
	type GitConfigScope,
	type SimpleGit,
	type SimpleGitOptions,
	simpleGit,
} from "simple-git";
import { logger } from "@/infra/logger";

export type ConfigScope = "local" | "global" | "system";

export interface GitIdentity {
	gitName?: string;
	email?: string;
	signingKey?: string;
}

export class GitService {
	private readonly git: SimpleGit;
	private readonly baseDir: string;

	constructor(options: Partial<SimpleGitOptions> = {}) {
		const { baseDir, ...restOptions } = options;
		this.baseDir = baseDir ?? process.cwd();
		this.git = simpleGit({
			baseDir: this.baseDir,
			binary: "git",
			maxConcurrentProcesses: 6,
			trimmed: true,
			...restOptions,
		});
	}

	async getCurrentIdentity(): Promise<GitIdentity> {
		logger.debug("git-service:getCurrentIdentity invoked", {
			baseDir: this.baseDir,
		});
		const config = await this.git.listConfig();
		const identity = {
			gitName: normalize(config.all["user.name"]),
			email: normalize(config.all["user.email"]),
			signingKey: normalize(config.all["user.signingkey"]),
		};
		logger.debug("git-service:getCurrentIdentity resolved", identity);
		return identity;
	}

	async applyIdentity(
		identity: RequiredPick<GitIdentity, "gitName" | "email"> & {
			signingKey?: string | null;
		},
		scope: ConfigScope = "local",
	): Promise<void> {
		const gitScope = scope as GitConfigScope;
		logger.info("git-service:applyIdentity", {
			scope,
			name: identity.gitName,
			email: identity.email,
			hasSigningKey: Boolean(identity.signingKey),
		});

		await this.git.addConfig("user.name", identity.gitName, false, gitScope);
		await this.git.addConfig("user.email", identity.email, false, gitScope);

		if (identity.signingKey) {
			await this.git.addConfig(
				"user.signingkey",
				identity.signingKey,
				false,
				gitScope,
			);
		} else {
			await this.unsetConfig("user.signingkey", scope);
		}
	}

	private async unsetConfig(key: string, scope: ConfigScope): Promise<void> {
		const args = ["config", ...scopeArgs(scope), "--unset", key];
		try {
			await this.git.raw(args);
			logger.debug("git-service:unsetConfig cleared key", { key, scope });
		} catch (error) {
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				if (
					message.includes("no such section or key") ||
					message.includes("not found")
				) {
					logger.debug("git-service:unsetConfig key already absent", {
						key,
						scope,
					});
					return;
				}
			}
			logger.error("git-service:unsetConfig unexpected error", {
				key,
				scope,
				error,
			});
			throw error;
		}
	}
}

type RequiredPick<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

function normalize(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[value.length - 1];
	}
	return value ?? undefined;
}

function scopeArgs(scope: ConfigScope): string[] {
	switch (scope) {
		case "global":
			return ["--global"];
		case "system":
			return ["--system"];
		default:
			return [];
	}
}
