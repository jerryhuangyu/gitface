import fs from "node:fs/promises";
import { ProfileService } from "@/core/profile-service";
import type { FolderRule } from "@/core/rule-service";
import { InvalidProfileError } from "@/errors";

export interface RuleIntegrityRecord {
	directory: string;
	profileName: string;
	profileExists: boolean;
	directoryExists: boolean;
}

interface ScanRuleIntegrityOptions {
	checkDirectory: boolean;
	concurrency: number;
	profileExistsCheck?: (
		service: ProfileService,
		profileName: string,
	) => Promise<boolean>;
	directoryExistsCheck?: (directory: string) => Promise<boolean>;
}

const DEFAULT_CONCURRENCY = 8;

export const parseConcurrency = (value: string | undefined): number => {
	if (value === undefined) {
		return DEFAULT_CONCURRENCY;
	}

	const normalized = value.trim();
	if (!/^\d+$/.test(normalized)) {
		throw new Error("Concurrency must be a positive integer.");
	}

	const parsed = Number.parseInt(normalized, 10);
	if (parsed < 1) {
		throw new Error("Concurrency must be a positive integer.");
	}

	return parsed;
};

async function checkProfileExists(
	service: ProfileService,
	profileName: string,
): Promise<boolean> {
	try {
		return (await service.findProfile(profileName)) !== null;
	} catch (error) {
		if (error instanceof InvalidProfileError) {
			return false;
		}
		throw error;
	}
}

async function checkDirectoryExists(directory: string): Promise<boolean> {
	try {
		const stats = await fs.stat(directory);
		return stats.isDirectory();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

async function mapWithConcurrency<T, U>(
	items: T[],
	concurrency: number,
	mapper: (item: T) => Promise<U>,
): Promise<U[]> {
	const workerCount = Math.min(Math.max(concurrency, 1), items.length || 1);
	const results = new Array<U>(items.length);
	let currentIndex = 0;

	const workers = Array.from({ length: workerCount }, async () => {
		while (true) {
			const index = currentIndex;
			currentIndex += 1;
			if (index >= items.length) {
				return;
			}
			results[index] = await mapper(items[index] as T);
		}
	});

	await Promise.all(workers);
	return results;
}

export async function scanRuleIntegrity(
	rules: FolderRule[],
	options: ScanRuleIntegrityOptions,
): Promise<RuleIntegrityRecord[]> {
	const profileService = ProfileService.create();
	const profileExistsCache = new Map<string, Promise<boolean>>();
	const directoryExistsCache = new Map<string, Promise<boolean>>();
	const profileExistsCheck = options.profileExistsCheck ?? checkProfileExists;
	const directoryExistsCheck =
		options.directoryExistsCheck ?? checkDirectoryExists;

	return mapWithConcurrency(rules, options.concurrency, async (rule) => {
		let profileExistsPromise = profileExistsCache.get(rule.profileName);
		if (!profileExistsPromise) {
			profileExistsPromise = profileExistsCheck(
				profileService,
				rule.profileName,
			);
			profileExistsCache.set(rule.profileName, profileExistsPromise);
		}
		const profileExists = await profileExistsPromise;

		if (!options.checkDirectory) {
			return {
				directory: rule.directory,
				profileName: rule.profileName,
				profileExists,
				directoryExists: true,
			};
		}

		let directoryExistsPromise = directoryExistsCache.get(rule.directory);
		if (!directoryExistsPromise) {
			directoryExistsPromise = directoryExistsCheck(rule.directory);
			directoryExistsCache.set(rule.directory, directoryExistsPromise);
		}
		const directoryExists = await directoryExistsPromise;

		return {
			directory: rule.directory,
			profileName: rule.profileName,
			profileExists,
			directoryExists,
		};
	});
}
