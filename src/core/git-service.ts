import { type GitConfigScope, type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";
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

  async getScopedIdentity(scope: ConfigScope): Promise<GitIdentity> {
    logger.debug("git-service:getScopedIdentity invoked", {
      baseDir: this.baseDir,
      scope,
    });
    try {
      const config = await this.getAllConfig(scope);
      const identity = {
        gitName: normalizeOptional(config["user.name"]),
        email: normalizeOptional(config["user.email"]),
        signingKey: normalizeOptional(config["user.signingkey"]),
      };
      logger.debug("git-service:getScopedIdentity resolved from list", {
        scope,
        identity,
      });
      return identity;
    } catch (error) {
      logger.warn("git-service:getScopedIdentity list fallback", {
        scope,
        error,
      });
    }

    const [gitName, email, signingKey] = await Promise.all([
      this.getConfig("user.name", scope),
      this.getConfig("user.email", scope),
      this.getConfig("user.signingkey", scope),
    ]);

    const identity = {
      gitName: normalizeOptional(gitName),
      email: normalizeOptional(email),
      signingKey: normalizeOptional(signingKey),
    };
    logger.debug("git-service:getScopedIdentity resolved from key lookups", {
      scope,
      identity,
    });
    return identity;
  }

  async applyIdentity(
    identity: RequiredPick<GitIdentity, "gitName" | "email"> & {
      signingKey?: string | null;
    },
    scope: ConfigScope = "local",
  ): Promise<void> {
    const gitScope = scope as GitConfigScope;
    const previousIdentity = await this.getScopedIdentity(scope);
    logger.info("git-service:applyIdentity", {
      scope,
      name: identity.gitName,
      email: identity.email,
      hasSigningKey: Boolean(identity.signingKey),
    });

    try {
      await this.git.addConfig("user.name", identity.gitName, false, gitScope);
      await this.git.addConfig("user.email", identity.email, false, gitScope);

      if (identity.signingKey) {
        await this.git.addConfig("user.signingkey", identity.signingKey, false, gitScope);
      } else {
        await this.unsetConfig("user.signingkey", scope);
      }
    } catch (applyError) {
      logger.error("git-service:applyIdentity failed; rolling back", {
        scope,
        error: applyError,
      });
      let rollbackError: unknown;
      try {
        await this.restoreIdentity(previousIdentity, scope);
      } catch (errorDuringRollback) {
        rollbackError = errorDuringRollback;
      }
      if (!rollbackError) {
        throw new Error(
          "Failed to apply identity changes. Git config was rolled back to previous state.",
          { cause: applyError },
        );
      }
      throw new Error(
        `Rollback after apply failure also failed. applyError=${formatUnknownError(applyError)} rollbackError=${formatUnknownError(rollbackError)}`,
      );
    }
  }

  async getConfig(key: string, scope: ConfigScope = "local"): Promise<string | null> {
    const args = ["config", ...scopeArgs(scope), "--get", key];
    try {
      const result = await this.git.raw(args);
      return result.trim() || null;
    } catch {
      return null;
    }
  }

  async getAllConfig(scope: ConfigScope = "local"): Promise<Record<string, string>> {
    const args = ["config", ...scopeArgs(scope), "--list"];
    const result = await this.git.raw(args);
    const config: Record<string, string> = {};
    for (const line of result.split("\n")) {
      const [key, ...value] = line.split("=");
      if (key && value) {
        config[key.trim()] = value.join("=").trim();
      }
    }
    return config;
  }

  async getConfigByRegexp(
    pattern: string,
    scope: ConfigScope = "local",
  ): Promise<Record<string, string>> {
    const args = ["config", ...scopeArgs(scope), "--get-regexp", pattern];
    try {
      const result = await this.git.raw(args);
      const config: Record<string, string> = {};
      for (const line of result.split("\n")) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }
        const firstWhitespaceIndex = trimmedLine.search(/\s/);
        if (firstWhitespaceIndex === -1) {
          continue;
        }
        const key = trimmedLine.slice(0, firstWhitespaceIndex).trim();
        const value = trimmedLine.slice(firstWhitespaceIndex).trim();
        if (key) {
          config[key] = value;
        }
      }
      return config;
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          hasExitCode(error, 1) ||
          message.includes("no such section or key") ||
          message.includes("not found")
        ) {
          return {};
        }
      }
      throw error;
    }
  }

  async addConfig(key: string, value: string, scope: ConfigScope = "local"): Promise<void> {
    const gitScope = scope as GitConfigScope;
    await this.git.addConfig(key, value, false, gitScope);
  }

  async removeConfig(key: string, scope: ConfigScope = "local"): Promise<void> {
    await this.unsetConfig(key, scope);
  }

  private async unsetConfig(key: string, scope: ConfigScope): Promise<void> {
    const args = ["config", ...scopeArgs(scope), "--unset-all", key];
    try {
      await this.git.raw(args);
      logger.debug("git-service:unsetConfig cleared key", { key, scope });
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("no such section or key") ||
          message.includes("not found") ||
          // exit code 5 means variable does not exist
          hasExitCode(error, 5)
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

  private async restoreIdentity(identity: GitIdentity, scope: ConfigScope): Promise<void> {
    const gitScope = scope as GitConfigScope;
    if (identity.gitName) {
      await this.git.addConfig("user.name", identity.gitName, false, gitScope);
    } else {
      await this.unsetConfig("user.name", scope);
    }
    if (identity.email) {
      await this.git.addConfig("user.email", identity.email, false, gitScope);
    } else {
      await this.unsetConfig("user.email", scope);
    }
    if (identity.signingKey) {
      await this.git.addConfig("user.signingkey", identity.signingKey, false, gitScope);
      return;
    }
    await this.unsetConfig("user.signingkey", scope);
  }
}

type RequiredPick<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

function normalize(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return value ?? undefined;
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  return value?.trim() ? value : undefined;
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

function hasExitCode(error: Error, expected: number): boolean {
  const maybeError = error as Error & { exitCode?: unknown };
  return typeof maybeError.exitCode === "number" && maybeError.exitCode === expected;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
