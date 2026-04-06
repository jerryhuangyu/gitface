import type { Profile } from "@/domain/profile";
import { ProfileAlreadyExistsError } from "@/errors";
import { ProfileService } from "./profile-service";

export interface ClonePreview {
  sourceName: string;
  targetName: string;
  overwrite: boolean;
  profile: Profile;
}

export interface CloneResult {
  sourceName: string;
  targetName: string;
  profile: Profile;
}

export interface CloneProfileOptions {
  force?: boolean;
}

/** Provides clone preview and clone execution operations for profiles. */
export class ProfileCloneService {
  constructor(private readonly profileService: ProfileService) {}

  static create(): ProfileCloneService {
    return new ProfileCloneService(ProfileService.create());
  }

  /** Returns the preview data for cloning one profile into another name. */
  async previewClone(
    sourceName: string,
    targetName: string,
    options: CloneProfileOptions = {},
  ): Promise<ClonePreview> {
    const force = options.force ?? false;
    const profile = await this.profileService.getProfile(sourceName);
    const overwrite = (await this.profileService.findProfile(targetName)) !== null;

    if (!force && overwrite) {
      throw new ProfileAlreadyExistsError(targetName);
    }

    return {
      sourceName,
      targetName,
      overwrite,
      profile,
    };
  }

  /** Clones a profile and returns the resulting clone data. */
  async cloneProfile(
    sourceName: string,
    targetName: string,
    options: CloneProfileOptions = {},
  ): Promise<CloneResult> {
    const profile = await this.profileService.cloneProfile(
      sourceName,
      targetName,
      options.force ?? false,
    );

    return {
      sourceName,
      targetName,
      profile,
    };
  }
}
