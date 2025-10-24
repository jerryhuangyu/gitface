import {
	type GitConfigScope,
	type SimpleGit,
	type SimpleGitOptions,
	simpleGit,
} from "simple-git";

export type ConfigScope = "local" | "global" | "system";

export interface GitIdentity {
	gitName?: string;
	email?: string;
	signingKey?: string;
}

export class GitService {
	private readonly git: SimpleGit;

	constructor(options: Partial<SimpleGitOptions> = {}) {
		this.git = simpleGit({
			baseDir: process.cwd(),
			binary: "git",
			maxConcurrentProcesses: 6,
			trimmed: true,
			...options,
		});
	}

	async getCurrentIdentity(): Promise<GitIdentity> {
		const config = await this.git.listConfig();
		return {
			gitName: normalize(config.all["user.name"]),
			email: normalize(config.all["user.email"]),
			signingKey: normalize(config.all["user.signingkey"]),
		};
	}

	async applyIdentity(
		identity: RequiredPick<GitIdentity, "gitName" | "email"> & {
			signingKey?: string | null;
		},
		scope: ConfigScope = "local",
	): Promise<void> {
		const gitScope = scope as GitConfigScope;

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
		} catch (error) {
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				if (
					message.includes("no such section or key") ||
					message.includes("not found")
				) {
					return;
				}
			}
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
