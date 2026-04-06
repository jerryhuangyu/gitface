export const RESULT_SCHEMA_VERSION = "1.0.0";

export interface ResultEnvelopeMeta {
  schemaVersion: string;
  durationMs: number;
  traceId: string;
}

export interface ResultEnvelopeError {
  code: string;
  message: string;
}

export interface ResultEnvelope<TData> {
  status: "success" | "error";
  code: string;
  message: string;
  data: TData | null;
  errors: ResultEnvelopeError[];
  meta: ResultEnvelopeMeta;
}

interface ResultEnvelopeInput<TData> {
  status: "success" | "error";
  code: string;
  message: string;
  data: TData | null;
  errors: ResultEnvelopeError[];
  durationMs: number;
  traceId: string;
}

export function buildResultEnvelope<TData>(
  input: ResultEnvelopeInput<TData>,
): ResultEnvelope<TData> {
  return {
    status: input.status,
    code: input.code,
    message: input.message,
    data: input.data,
    errors: input.errors,
    meta: {
      schemaVersion: RESULT_SCHEMA_VERSION,
      durationMs: input.durationMs,
      traceId: input.traceId,
    },
  };
}
