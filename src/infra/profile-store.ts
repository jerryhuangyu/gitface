import { constants as fsConstants } from "node:fs";
import {
	access,
	mkdir,
	readdir,
	readFile,
	unlink,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { Profile, ProfileInput, ProfileSnapshot } from "../core/profile";
import { InvalidProfileError, ProfileNotFoundError } from "../errors";

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
		return snapshots.filter(
			(snapshot): snapshot is ProfileRecord => snapshot !== null,
		);
	}

	async load(name: string): Promise<ProfileRecord> {
		await this.ready;
		const filePath = this.profilePath(name);
		try {
			const raw = await readFile(filePath, "utf8");
			return parseSnapshot(name, raw);
		} catch (error) {
			if (isNotFound(error)) {
				throw new ProfileNotFoundError(name);
			}
			throw error;
		}
	}

	async save(profile: Profile): Promise<void> {
		await this.ready;
		const filePath = this.profilePath(profile.name);
		const payload = JSON.stringify(profile.snapshot(), null, 2);
		await writeFile(filePath, `${payload}\n`, "utf8");
	}

	async remove(name: string): Promise<void> {
		await this.ready;
		const filePath = this.profilePath(name);
		try {
			await unlink(filePath);
		} catch (error) {
			if (isNotFound(error)) {
				throw new ProfileNotFoundError(name);
			}
			throw error;
		}
	}

	async exists(name: string): Promise<boolean> {
		await this.ready;
		const filePath = this.profilePath(name);
		try {
			await access(filePath, fsConstants.F_OK);
			return true;
		} catch (error) {
			if (isNotFound(error)) {
				return false;
			}
			throw error;
		}
	}

	private async ensureDirectories(): Promise<void> {
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
				return null;
			}
			throw error;
		}
	}
}

function resolveConfigDirectory(): string {
	const configRoot =
		process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config");
	return path.join(configRoot, "gitface");
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
