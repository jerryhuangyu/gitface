import type { ListProfilesSortMode } from "@/core/profile-service";
import { buildResultEnvelope, type ResultEnvelope } from "@/core/result-envelope";

interface ListProfileSnapshot {
  name: string;
  gitName: string | null;
  email: string | null;
  signingKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListProfilesEnvelopeData {
  profiles: ListProfileSnapshot[];
  query: string | null;
  sort: ListProfilesSortMode;
  limit: number | null;
  count: number;
}

export function writeListProfilesJsonLegacy(profiles: ListProfileSnapshot[]): void {
  console.log(JSON.stringify(profiles, null, 2));
}

export function writeListProfilesEnvelopeSuccess(
  data: ListProfilesEnvelopeData,
  durationMs: number,
  traceId: string,
): void {
  writeListEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "LIST_PROFILES_OK",
      message: "Profiles listed successfully.",
      data,
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function writeListProfilesEnvelopeError(
  errorCode: string,
  message: string,
  durationMs: number,
  traceId: string,
): void {
  writeListEnvelope(
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

function writeListEnvelope(envelope: ResultEnvelope<ListProfilesEnvelopeData | null>): void {
  console.log(JSON.stringify(envelope));
}

export type { ListProfileSnapshot };
