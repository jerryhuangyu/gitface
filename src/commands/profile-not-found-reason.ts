import { ProfileService } from "@/core/profile-service";
import { logger } from "@/infra/logger";

export async function buildProfileNotFoundReason(
  missingName: string,
  baseReason: string,
): Promise<string> {
  try {
    const service = ProfileService.create();
    const suggestions = await service.suggestProfileNames(missingName, 3);
    if (suggestions.length === 0) {
      return baseReason;
    }

    const serialized = suggestions.map((suggestion) => `'${suggestion}'`).join(", ");
    return `${baseReason} Did you mean ${serialized}?`;
  } catch (error) {
    logger.debug("profile-not-found-reason: failed to gather suggestions", {
      missingName,
      error,
    });
    return baseReason;
  }
}
