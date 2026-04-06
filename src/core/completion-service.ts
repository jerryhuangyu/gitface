import { ProfileService } from "@/core/profile-service";

export type CompletionTopic = "profiles" | "commands" | "rules-commands";

export interface ResolveCompletionsOptions {
  prefix?: string;
  limit?: string;
}

export interface CompletionResult {
  topic: CompletionTopic;
  prefix: string | null;
  limit: number | null;
  count: number;
  names: string[];
}

const TOP_LEVEL_COMMANDS = [
  "clone",
  "completion",
  "current",
  "doctor",
  "edit",
  "export",
  "import",
  "list",
  "ls",
  "new",
  "remove",
  "rename",
  "rm",
  "mv",
  "rules",
  "use",
] as const;

const RULES_COMMANDS = [
  "add",
  "apply",
  "doctor",
  "list",
  "ls",
  "prune",
  "remove",
  "rm",
  "resolve",
] as const;

/** Provides completion candidates for commands, subcommands, and profiles. */
export class CompletionService {
  constructor(private readonly profileService: ProfileService) {}

  static create(): CompletionService {
    return new CompletionService(ProfileService.create());
  }

  async resolve(
    topic: CompletionTopic,
    options: ResolveCompletionsOptions = {},
  ): Promise<CompletionResult> {
    const limit = parseLimit(options.limit);
    const names = await this.loadCandidates(topic);
    const filteredNames = filterByPrefix(names, options.prefix).slice(0, limit);

    return {
      topic,
      prefix: options.prefix ?? null,
      limit: limit ?? null,
      count: filteredNames.length,
      names: filteredNames,
    };
  }

  private async loadCandidates(topic: CompletionTopic): Promise<string[]> {
    switch (topic) {
      case "profiles":
        return await this.profileService.listProfileNames();
      case "commands":
        return [...TOP_LEVEL_COMMANDS];
      case "rules-commands":
        return [...RULES_COMMANDS];
    }
  }
}

function filterByPrefix(names: string[], prefix: string | undefined): string[] {
  if (prefix === undefined) {
    return names;
  }

  const normalizedPrefix = prefix.toLowerCase();
  return names.filter((name) => name.toLowerCase().startsWith(normalizedPrefix));
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Limit must be a positive integer.");
  }

  const limit = Number.parseInt(normalized, 10);
  if (limit < 1) {
    throw new Error("Limit must be a positive integer.");
  }

  return limit;
}
