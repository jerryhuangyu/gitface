import type { Profile, ProfileSnapshot } from "@/domain/profile";

export interface ProfileExportPayload {
  count: number;
  profiles: ProfileSnapshot[];
}

export function buildProfileExportPayload(profiles: Profile[]): ProfileExportPayload {
  const snapshots = profiles.map((profile) => profile.snapshot());
  return {
    count: snapshots.length,
    profiles: snapshots,
  };
}

export function serializeProfileExportPayload(payload: ProfileExportPayload): string {
  return JSON.stringify(payload.profiles, null, 2);
}
