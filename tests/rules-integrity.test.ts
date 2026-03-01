import { afterEach, describe, expect, test, vi } from "vitest";
import { ProfileService } from "../src/core/profile-service";
import {
	parseConcurrency,
	scanRuleIntegrity,
} from "../src/commands/rules/integrity";

describe("rules integrity scan", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("parses concurrency with default and validates positive integer", () => {
		expect(parseConcurrency(undefined)).toBe(8);
		expect(parseConcurrency("3")).toBe(3);
		expect(() => parseConcurrency("0")).toThrow(
			"Concurrency must be a positive integer.",
		);
		expect(() => parseConcurrency("abc")).toThrow(
			"Concurrency must be a positive integer.",
		);
	});

	test("deduplicates profile and directory checks during scan", async () => {
		const findProfile = vi
			.fn()
			.mockResolvedValueOnce({
				name: "team",
				gitName: "Team",
				email: "team@example.com",
				createdAt: "",
				updatedAt: "",
			})
			.mockResolvedValueOnce(null);
		vi.spyOn(ProfileService, "create").mockReturnValue({
			findProfile,
		} as unknown as ProfileService);

		const directoryExistsCheck = vi
			.fn()
			.mockImplementation(async (directory: string) => {
				return !directory.includes("missing");
			});

		const report = await scanRuleIntegrity(
			[
				{ directory: "/tmp/work/", profileName: "team" },
				{ directory: "/tmp/work/", profileName: "team" },
				{ directory: "/tmp/missing/", profileName: "ghost" },
			],
			{
				checkDirectory: true,
				concurrency: 4,
				directoryExistsCheck,
			},
		);

		expect(findProfile).toHaveBeenCalledTimes(2);
		expect(directoryExistsCheck).toHaveBeenCalledTimes(2);
		expect(report.records).toEqual([
			{
				directory: "/tmp/work/",
				profileName: "team",
				profileExists: true,
				directoryExists: true,
			},
			{
				directory: "/tmp/work/",
				profileName: "team",
				profileExists: true,
				directoryExists: true,
			},
			{
				directory: "/tmp/missing/",
				profileName: "ghost",
				profileExists: false,
				directoryExists: false,
			},
		]);
		expect(report.metrics).toMatchObject({
			concurrency: 3,
			scanned: 3,
			uniqueProfilesChecked: 2,
			uniqueDirectoriesChecked: 2,
		});
		expect(report.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
	});

	test("skips directory checks when directory scanning is disabled", async () => {
		const findProfile = vi.fn().mockResolvedValue(null);
		vi.spyOn(ProfileService, "create").mockReturnValue({
			findProfile,
		} as unknown as ProfileService);
		const directoryExistsCheck = vi.fn().mockResolvedValue(true);

		const report = await scanRuleIntegrity(
			[{ directory: "/tmp/unused/", profileName: "ghost" }],
			{
				checkDirectory: false,
				concurrency: 2,
				directoryExistsCheck,
			},
		);

		expect(directoryExistsCheck).not.toHaveBeenCalled();
		expect(report.records).toEqual([
			{
				directory: "/tmp/unused/",
				profileName: "ghost",
				profileExists: false,
				directoryExists: true,
			},
		]);
		expect(report.metrics).toMatchObject({
			concurrency: 1,
			scanned: 1,
			uniqueProfilesChecked: 1,
			uniqueDirectoriesChecked: 0,
		});
		expect(report.metrics.scanDurationMs).toBeGreaterThanOrEqual(0);
	});
});
