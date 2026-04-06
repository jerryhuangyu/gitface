import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { type Profile, validateProfileName } from "@/domain/profile";
import { writeFileAtomic } from "@/infra/atomic-write";
import { logger } from "@/infra/logger";
import { osPaths } from "@/infra/os-path";

export interface ProfileConfigStore {
  getProfileConfigPath(name: string): string;
  save(profile: Profile): Promise<void>;
  remove(name: string): Promise<void>;
}

export class FileProfileConfigStore implements ProfileConfigStore {
  private readonly baseDir: string;
  private readonly identitiesDir: string;

  constructor(customDirectory?: string) {
    this.baseDir = customDirectory ?? resolveConfigDirectory();
    this.identitiesDir = path.join(this.baseDir, "identities");
  }

  getProfileConfigPath(name: string): string {
    validateProfileName(name);
    return path.join(this.identitiesDir, `${name}.gitconfig`);
  }

  async save(profile: Profile): Promise<void> {
    const filePath = this.getProfileConfigPath(profile.name);
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });

    let content = `[user]\n\tname = ${profile.gitName}\n\temail = ${profile.email}\n`;
    if (profile.signingKey) {
      content += `\tsigningkey = ${profile.signingKey}\n`;
    }

    await writeFileAtomic(filePath, content);
    logger.debug("profile-config-store:save", {
      name: profile.name,
      filePath,
    });
  }

  async remove(name: string): Promise<void> {
    const filePath = this.getProfileConfigPath(name);
    try {
      await unlink(filePath);
      logger.debug("profile-config-store:remove", {
        name,
        filePath,
      });
    } catch {
      logger.debug("profile-config-store:remove missing", {
        name,
        filePath,
      });
    }
  }
}

function resolveConfigDirectory(): string {
  const resolved = osPaths.config("gitface");
  if (resolved) {
    logger.debug("profile-config-store:config resolved", { path: resolved });
    return resolved;
  }

  const fallback = path.join(process.cwd(), "gitface");
  logger.critical(
    "Unable to resolve OS-specific config directory; falling back to workspace path:",
    fallback,
  );
  return fallback;
}
