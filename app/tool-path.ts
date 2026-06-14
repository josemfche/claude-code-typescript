import path from "node:path";

export const resolveToolPath = (target: string): string =>
  path.isAbsolute(target) ? path.normalize(target) : path.resolve(process.cwd(), target);
