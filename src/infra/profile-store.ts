import { constants as fsConstants } from "node:fs";
import {
	access,
	mkdir,
	readdir,
	readFile,
	unlink,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { Profile, ProfileInput, ProfileSnapshot } from "@/core/profile";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { logger } from "@/infra/logger";
import { osPaths } from "@/infra/os-path";

const PROFILE_FILE_EXTENSION = ".json";

export interface ProfileRecord extends ProfileSnapshot {}

export interface ProfileStore {
	list(): Promise<ProfileRecord[]>;
	load(name: string): Promise<ProfileRecord>;
	save(profile: Profile): Promise<void>;
	remove(name: string): Promise<void>;
	exists(name: string): Promise<boolean>;
}

export class FileProfileStore implements ProfileStore {
	private readonly baseDir: string;
	private readonly profilesDir: string;
	private readonly ready: Promise<void>;

	constructor(customDirectory?: string) {
		this.baseDir = customDirectory ?? resolveConfigDirectory();
		this.profilesDir = path.join(this.baseDir, "profiles");
		this.ready = this.ensureDirectories();
	}

	async list(): Promise<ProfileRecord[]> {
		await this.ready;
		logger.debug("profile-store:list entries", { baseDir: this.profilesDir });
		const entries = await readdir(this.profilesDir, { withFileTypes: true });
		const names = entries
			.filter(
				(entry) =>
					entry.isFile() && entry.name.endsWith(PROFILE_FILE_EXTENSION),
			)
			.map((entry) => entry.name.slice(0, -PROFILE_FILE_EXTENSION.length));

		const snapshots = await Promise.all(
			names.map((name) => this.safeLoad(name)),
		);
		const records = snapshots.filter(
			(snapshot): snapshot is ProfileRecord => snapshot !== null,
		);
		logger.debug("profile-store:list result", {
			total: entries.length,
			valid: records.length,
		});
		return records;
	}

	async load(name: string): Promise<ProfileRecord> {
		await this.ready;
		logger.debug("profile-store:load invoked", { name });
		const filePath = this.profilePath(name);
		try {
			const raw = await readFile(filePath, "utf8");
			const snapshot = parseSnapshot(name, raw);
			logger.debug("profile-store:load success", { name });
			return snapshot;
		} catch (error) {
			if (isNotFound(error)) {
				logger.warn("profile-store:load missing profile", { name, filePath });
				throw new ProfileNotFoundError(name);
			}
			logger.error("profile-store:load unexpected error", { name, error });
			throw error;
		}
	}

	async save(profile: Profile): Promise<void> {
		await this.ready;
		const filePath = this.profilePath(profile.name);
		const payload = JSON.stringify(profile.snapshot(), null, 2);
		logger.info("profile-store:save profile", {
			name: profile.name,
			filePath,
		});
		await writeFile(filePath, `${payload}\n`, "utf8");
	}

	async remove(name: string): Promise<void> {
		await this.ready;
		const filePath = this.profilePath(name);
		try {
			await unlink(filePath);
			logger.info("profile-store:remove profile", { name, filePath });
		} catch (error) {
			if (isNotFound(error)) {
				logger.warn("profile-store:remove profile missing", { name, filePath });
				throw new ProfileNotFoundError(name);
			}
			logger.error("profile-store:remove unexpected error", { name, error });
			throw error;
		}
	}

	async exists(name: string): Promise<boolean> {
		await this.ready;
		const filePath = this.profilePath(name);
		try {
			await access(filePath, fsConstants.F_OK);
			logger.info("profile-store:exists profile present", { name });
			return true;
		} catch (error) {
			if (isNotFound(error)) {
				logger.debug("profile-store:exists profile missing", { name });
				return false;
			}
			logger.error("profile-store:exists unexpected error", { name, error });
			throw error;
		}
	}

	private async ensureDirectories(): Promise<void> {
		logger.debug("profile-store:ensureDirectories", {
			baseDir: this.baseDir,
			profilesDir: this.profilesDir,
		});
		await mkdir(this.baseDir, { recursive: true });
		await mkdir(this.profilesDir, { recursive: true });
	}

	private profilePath(name: string): string {
		return path.join(this.profilesDir, `${name}${PROFILE_FILE_EXTENSION}`);
	}

	private async safeLoad(name: string): Promise<ProfileRecord | null> {
		try {
			return await this.load(name);
		} catch (error) {
			if (error instanceof InvalidProfileError) {
				logger.warn("profile-store:safeLoad skipped invalid profile", {
					name,
				});
				return null;
			}
			throw error;
		}
	}
}

function resolveConfigDirectory(): string {
	const resolved = osPaths.config("gitface");
	if (resolved) {
		logger.debug("profile-store:config resolved", { path: resolved });
		return resolved;
	}

	const fallback = path.join(process.cwd(), "gitface");
	logger.critical(
		"Unable to resolve OS-specific config directory; falling back to workspace path:",
		fallback,
	);
	return fallback;
}

function parseSnapshot(name: string, raw: string): ProfileSnapshot {
	const data = JSON.parse(raw) as Partial<ProfileSnapshot & ProfileInput>;

	return {
		name: data.name ?? name,
		gitName: data.gitName ?? "",
		email: data.email ?? "",
		signingKey: data.signingKey ?? null,
		createdAt: data.createdAt ?? new Date().toISOString(),
		updatedAt: data.updatedAt ?? new Date().toISOString(),
	};
}

function isNotFound(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ENOENT"
	);
}
