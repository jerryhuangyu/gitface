import type { CompletionResult } from "@/core/completion-service";
import { buildResultEnvelope, type ResultEnvelope } from "@/core/result-envelope";

type CompletionOutputMode = "text" | "json" | "json-envelope";

interface CompletionPresenterMeta {
  startedAtMs: number;
  traceId: string;
  delimiter?: string;
}

interface CompletionPresenter {
  success(payload: CompletionResult): void;
  error(code: string, message: string): void;
}

export function createCompletionPresenter(
  outputMode: CompletionOutputMode,
  meta: CompletionPresenterMeta,
): CompletionPresenter {
  if (outputMode === "json-envelope") {
    return {
      success(payload: CompletionResult): void {
        writeCompletionProfilesEnvelopeSuccess(
          payload,
          Date.now() - meta.startedAtMs,
          meta.traceId,
        );
      },
      error(code: string, message: string): void {
        writeCompletionProfilesEnvelopeError(
          code,
          message,
          Date.now() - meta.startedAtMs,
          meta.traceId,
        );
      },
    };
  }

  if (outputMode === "json") {
    return {
      success(payload: CompletionResult): void {
        writeCompletionProfilesJson(payload);
      },
      error(_code: string, _message: string): void {},
    };
  }

  return {
    success(payload: CompletionResult): void {
      writeCompletionProfilesText(payload.names, meta.delimiter);
    },
    error(_code: string, _message: string): void {},
  };
}

function writeCompletionProfilesJson(payload: CompletionResult): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function writeCompletionProfilesEnvelopeSuccess(
  data: CompletionResult,
  durationMs: number,
  traceId: string,
): void {
  writeEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "COMPLETION_CANDIDATES_OK",
      message: "Completion candidates resolved.",
      data,
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

function writeCompletionProfilesEnvelopeError(
  errorCode: string,
  message: string,
  durationMs: number,
  traceId: string,
): void {
  writeEnvelope(
    buildResultEnvelope({
      status: "error",
      code: errorCode,
      message,
      data: null,
      errors: [{ code: errorCode, message }],
      durationMs,
      traceId,
    }),
  );
}

function writeCompletionProfilesText(names: string[], delimiter = "\n"): void {
  if (names.length === 0) {
    return;
  }

  const payload = names.join(delimiter);
  const needsTrailingNewline = !payload.endsWith("\n");

  process.stdout.write(payload);
  if (needsTrailingNewline) {
    process.stdout.write("\n");
  }
}

function writeEnvelope(envelope: ResultEnvelope<CompletionResult | null>): void {
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
}
