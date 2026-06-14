import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const SKIP_DIRS = new Set(["node_modules", ".git", ".codecrafters"]);

const isDirectory = async (target: string): Promise<boolean> => {
  const info = await stat(target);
  return info.isDirectory();
};

const shouldSkipDir = (name: string): boolean => SKIP_DIRS.has(name);

export const collectFiles = async (root: string): Promise<string[]> => {
  const files: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
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

  if (await isDirectory(root)) {
    await walk(root);
  } else {
    files.push(root);
  }

  return files;
};
