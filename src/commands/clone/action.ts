import { ProfileCloneService } from "@/core/profile-clone-service";
import { InvalidProfileError, ProfileAlreadyExistsError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import { createClonePresenter } from "./ui";

interface Options {
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

const action: (source: string, target: string, options: Options) => Promise<void> =
  withCommandHandling("command:clone", async (source: string, target: string, options: Options) => {
    const presenter = createClonePresenter(options.json === true ? "json" : "text");
    const service = ProfileCloneService.create();

    try {
      if (options.dryRun) {
        const preview = await service.previewClone(source, target, {
          force: options.force,
        });

        presenter.dryRun(
          preview.sourceName,
          preview.targetName,
          preview.profile,
          preview.overwrite,
        );
        return;
      }

      const result = await service.cloneProfile(source, target, {
        force: options.force,
      });

      presenter.success(result.sourceName, result.profile);
    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        const reason = await buildProfileNotFoundReason(source, `'${source}' does not exist.`);
        presenter.failure(source, target, reason);
        process.exitCode = 1;
        return;
      }

      if (error instanceof ProfileAlreadyExistsError) {
        const reason = error.message;
        presenter.failure(source, target, reason);
        process.exitCode = 1;
        return;
      }

      if (error instanceof InvalidProfileError) {
        const reason = error.message;
        presenter.failure(source, target, reason);
        process.exitCode = 1;
        return;
      }

      throw error;
    }
  });

export default action;
