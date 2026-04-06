import { describe, expect, test } from "vitest";
import {
  buildProfileExportPayload,
  serializeProfileExportPayload,
} from "../src/core/profile-export-service";
import { Profile } from "../src/domain/profile";

describe("profile-export-service", () => {
  test("builds payload from profile snapshots", () => {
    const profiles = [
      Profile.create({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      }),
      Profile.create({
        name: "personal",
        gitName: "Personal User",
        email: "me@example.com",
        signingKey: "ABC",
      }),
    ];

    const payload = buildProfileExportPayload(profiles);

    expect(payload.count).toBe(2);
    expect(payload.profiles.map((profile) => profile.name).sort()).toEqual(["personal", "work"]);
  });

  test("serializes payload as pretty profile array json", () => {
    const payload = {
      count: 1,
      profiles: [
        {
          name: "work",
          gitName: "Work User",
          email: "work@example.com",
          signingKey: null,
          createdAt: "2026-03-02T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
        },
      ],
    };

    const output = serializeProfileExportPayload(payload);
    const parsed = JSON.parse(output) as Array<{ name: string }>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("work");
    expect(output).toContain("\n");
  });
});
