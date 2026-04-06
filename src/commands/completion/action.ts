import { randomUUID } from "node:crypto";
import process from "node:process";
import { CompletionService, type CompletionTopic } from "@/core/completion-service";
import { withCommandHandling } from "../command-runner";
import { createCompletionPresenter } from "./output";

interface CompletionOptions {
  prefix?: string;
  delimiter?: string;
  limit?: string;
  json?: boolean;
  jsonEnvelope?: boolean;
}

type CompletionOutputMode = "text" | "json" | "json-envelope";

const SUPPORTED_TOPICS: CompletionTopic[] = ["profiles", "commands", "rules-commands"];

const action: (topic: CompletionTopic, options: CompletionOptions) => Promise<void> =
  withCommandHandling("command:completion", async (topic, options) => {
    const startedAtMs = Date.now();
    const traceId = randomUUID();
    const outputMode: CompletionOutputMode =
      options.jsonEnvelope === true ? "json-envelope" : options.json === true ? "json" : "text";
    const presenter = createCompletionPresenter(outputMode, {
      startedAtMs,
      traceId,
      delimiter: options.delimiter,
    });
    const normalizedTopic = topic.toLowerCase() as CompletionTopic;
    if (!SUPPORTED_TOPICS.includes(normalizedTopic)) {
      presenter.error(
        "COMPLETION_TOPIC_UNSUPPORTED",
        "Completion topic must be: profiles, commands, rules-commands.",
      );
      process.exitCode = 1;
      return;
    }

    try {
      const service = CompletionService.create();
      const payload = await service.resolve(normalizedTopic, {
        prefix: options.prefix,
        limit: options.limit,
      });
      presenter.success(payload);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      presenter.error("COMPLETION_LIMIT_INVALID", error.message);
      process.exitCode = 1;
      if (outputMode === "text" || outputMode === "json") {
        return;
      }
      return;
    }
  });

export default action;
