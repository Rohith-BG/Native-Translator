export const chunkText = (
  text: string,
  maxChars: number,
  overlap = 120,
): string[] => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed.length === 0 ? [] : [trimmed];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + maxChars, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end >= trimmed.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
};
