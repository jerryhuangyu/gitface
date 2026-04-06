import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { executeProfileImport, parseImportCandidate } from "../src/core/profile-import-service";
import { ProfileService } from "../src/core/profile-service";
import { safeRemove } from "./helpers/e2e";

describe("profile-import-service", () => {
  test("rejects wrapped profile state payload", () => {
    expect(() =>
      parseImportCandidate({
        state: {
          name: "work",
        },
      }),
    ).toThrow("Invalid format: expected plain profile snapshots without 'state' wrapper.");
  });

  test("aborts atomic import when any entry fails precheck", async () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gitface-core-"));
    const configDir = path.join(tmpRoot, "config");

    try {
      process.env.XDG_CONFIG_HOME = configDir;
      const service = ProfileService.create();
      await service.createProfile({
        name: "work",
        gitName: "Work User",
        email: "work@example.com",
      });

      const result = await executeProfileImport(
        [
          {
            name: "work",
            gitName: "Changed User",
            email: "changed@example.com",
          },
          {
            name: "personal",
            gitName: "Personal User",
            email: "me@example.com",
          },
        ],
        service,
        { atomic: true },
      );

      expect(result.atomicAborted).toBe(true);
      expect(result.summary.imported).toBe(0);
      expect(result.summary.failed).toBe(2);
      expect(result.summary.results).toEqual([
        {
          name: "work",
          status: "failed",
          message: "Profile 'work' already exists.",
        },
        {
          name: "personal",
          status: "failed",
          message: "Skipped due to --atomic precheck failure.",
        },
      ]);

      const profiles = await service.listProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.name).toBe("work");
    } finally {
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg;
      }
      await safeRemove(tmpRoot);
    }
  });
});
