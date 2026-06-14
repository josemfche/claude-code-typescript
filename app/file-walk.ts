import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", ".codecrafters"]);

export type CollectFilesResult = {
  readonly files: readonly string[];
  readonly rootIsFile: boolean;
};

export const collectFilesWithMeta = async (
  root: string,
): Promise<CollectFilesResult> => {
  const files: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }

        await walk(path.join(directory, entry.name));
        continue;
      }

      if (entry.isFile()) {
        files.push(path.join(directory, entry.name));
      }
    }
  };

  if ((await stat(root)).isDirectory()) {
    await walk(root);
    return { files, rootIsFile: false };
  }

  return { files: [root], rootIsFile: true };
};

export const collectFiles = async (root: string): Promise<readonly string[]> =>
  (await collectFilesWithMeta(root)).files;
