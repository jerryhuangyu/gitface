import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

interface AtomicWriteDeps {
  writeFile: typeof writeFile;
  rename: typeof rename;
  unlink: typeof unlink;
}

const defaultDeps: AtomicWriteDeps = {
  writeFile,
  rename,
  unlink,
};

export async function writeFileAtomic(
  filePath: string,
  content: string,
  deps: AtomicWriteDeps = defaultDeps,
): Promise<void> {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

  await deps.writeFile(tempPath, content, "utf8");

  try {
    await deps.rename(tempPath, filePath);
  } catch (error) {
    await deps.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}
