import { randomUUID } from "node:crypto";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
  writeListProfilesEnvelopeError,
  writeListProfilesEnvelopeSuccess,
  writeListProfilesJsonLegacy,
} from "./output";

interface ListOptions {
  json?: boolean;
  jsonEnvelope?: boolean;
  query?: string;
  limit?: string;
  sort?: string;
}

type SortMode = "updated" | "name";
type OutputMode = "text" | "json" | "json-envelope";

interface ParsedOptionValue<T> {
  ok: true;
  value: T;
}

interface ParsedOptionError {
  ok: false;
  code: string;
  message: string;
}

type ParsedOptionResult<T> = ParsedOptionValue<T> | ParsedOptionError;

const printPlainProfiles = <
  T extends {
    name: string;
    gitName: string | null;
    email: string | null;
    signingKey?: string | null;
    updatedAt: string;
  },
>(
  profiles: T[],
  query: string | undefined,
): void => {
  if (profiles.length === 0) {
    if (query?.trim()) {
      console.log(`No profiles matched query "${query.trim()}".`);
      return;
    }
    console.log("No saved profiles yet. Use 'gitface new <name>' to create one.");
    return;
  }

  console.log("Saved Profiles:");
  for (const profile of profiles) {
    console.log(
      `- ${profile.name}: ${profile.gitName ?? "<unset>"} <${profile.email ?? "<unset>"}> signingKey=${profile.signingKey ?? "<none>"} updatedAt=${profile.updatedAt}`,
    );
  }
};

const parseSortMode = (value: string | undefined): ParsedOptionResult<SortMode> => {
  if (value === undefined) {
    return { ok: true, value: "updated" };
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "updated" || normalized === "name") {
    return { ok: true, value: normalized };
  }

  return {
    ok: false,
    code: "LIST_SORT_INVALID",
    message: "Sort mode must be one of: updated, name.",
  };
};

const parseLimit = (value: string | undefined): ParsedOptionResult<number | undefined> => {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return {
      ok: false,
      code: "LIST_LIMIT_INVALID",
      message: "Limit must be a positive integer.",
    };
  }

  const limit = Number.parseInt(normalized, 10);
  if (limit < 1) {
    return {
      ok: false,
      code: "LIST_LIMIT_INVALID",
      message: "Limit must be a positive integer.",
    };
  }

  return { ok: true, value: limit };
};

const resolveOutputMode = (options: ListOptions): OutputMode => {
  if (options.jsonEnvelope === true) {
    return "json-envelope";
  }
  if (options.json === true) {
    return "json";
  }
  return "text";
};

const action: (options: ListOptions) => Promise<void> = withCommandHandling(
  "command:list",
  async (options) => {
    const startedAtMs = Date.now();
    const traceId = randomUUID();
    const outputMode = resolveOutputMode(options);
    const service = ProfileService.create();
    const sortMode = parseSortMode(options.sort);
    if (!sortMode.ok) {
      if (outputMode === "json-envelope") {
        writeListProfilesEnvelopeError(
          sortMode.code,
          sortMode.message,
          Date.now() - startedAtMs,
          traceId,
        );
        process.exitCode = 1;
        return;
      }
      throw new Error(sortMode.message);
    }

    const limit = parseLimit(options.limit);
    if (!limit.ok) {
      if (outputMode === "json-envelope") {
        writeListProfilesEnvelopeError(
          limit.code,
          limit.message,
          Date.now() - startedAtMs,
          traceId,
        );
        process.exitCode = 1;
        return;
      }
      throw new Error(limit.message);
    }

    const profiles = await service.listProfilesByQuery({
      query: options.query,
      sort: sortMode.value,
      limit: limit.value,
    });
    const snapshots = profiles.map((profile) => {
      const snapshot = profile.snapshot();
      return {
        ...snapshot,
        signingKey: snapshot.signingKey ?? null,
      };
    });

    if (outputMode === "json-envelope") {
      writeListProfilesEnvelopeSuccess(
        {
          profiles: snapshots,
          query: options.query?.trim() ? options.query.trim() : null,
          sort: sortMode.value,
          limit: limit.value ?? null,
          count: snapshots.length,
        },
        Date.now() - startedAtMs,
        traceId,
      );
      return;
    }

    if (outputMode === "json") {
      writeListProfilesJsonLegacy(snapshots);
      return;
    }

    if (!process.stdout.isTTY) {
      printPlainProfiles(snapshots, options.query);
      return;
    }

    const [{ render }, { default: ProfilesList }] = await Promise.all([
      import("ink"),
      import("./ui"),
    ]);
    const instance = render(<ProfilesList profiles={profiles} />);
    await instance.waitUntilExit();
  },
);

export default action;
