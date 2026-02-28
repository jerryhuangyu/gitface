import { describe, expect, test } from "vitest";
import { suggestProfileNames } from "../src/core/profile-name-suggestions";

describe("suggestProfileNames", () => {
	test("prioritizes prefix and typo-near names", () => {
		const suggestions = suggestProfileNames(
			"wrok",
			["work", "workspace", "personal", "rock", "wk"],
			3,
		);

		expect(suggestions).toEqual(["work", "rock", "wk"]);
	});

	test("handles case-insensitive lookup and limit", () => {
		const suggestions = suggestProfileNames(
			"WORK",
			["work", "work-admin", "team-work", "personal"],
			2,
		);

		expect(suggestions).toEqual(["work", "work-admin"]);
	});

	test("returns empty output for empty query or empty candidates", () => {
		expect(suggestProfileNames("", ["work"])).toEqual([]);
		expect(suggestProfileNames("work", [])).toEqual([]);
		expect(suggestProfileNames("work", ["work"], 0)).toEqual([]);
	});
});
