export const MAX_MODEL_CHARS = 8_000;
export const DEFAULT_SEARCH_LIMIT = 50;

export const truncateForModel = (content: string): string => {
  if (content.length <= MAX_MODEL_CHARS) {
    return content;
  }

  const omitted = content.length - MAX_MODEL_CHARS;
  return `${content.slice(0, MAX_MODEL_CHARS)}\n\n[truncated ${omitted} characters]`;
};
