/**
 * Splits text into chunks respecting paragraph and sentence boundaries.
 * Keeps chunks within maxChars to fit the model's context window.
 */
export const chunkText = (
  text: string,
  maxChars = 900,
  overlap = 0,
): string[] => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed.length === 0 ? [] : [trimmed];
  }

  // Split by paragraphs first
  const paragraphs = trimmed.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;

    if (p.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      // Split long paragraph into sentences
      const sentences = p.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [p];
      let sentenceChunk = '';

      for (const sent of sentences) {
        const s = sent.trim();
        if (!s) continue;

        if (s.length > maxChars) {
          if (sentenceChunk) {
            chunks.push(sentenceChunk);
            sentenceChunk = '';
          }
          // Break very long sentence by words
          const words = s.split(/\s+/);
          let wordChunk = '';
          for (const w of words) {
            if ((wordChunk + ' ' + w).trim().length > maxChars) {
              if (wordChunk) chunks.push(wordChunk.trim());
              wordChunk = w;
            } else {
              wordChunk = wordChunk ? `${wordChunk} ${w}` : w;
            }
          }
          if (wordChunk) chunks.push(wordChunk.trim());
        } else if ((sentenceChunk + ' ' + s).trim().length > maxChars) {
          if (sentenceChunk) chunks.push(sentenceChunk.trim());
          sentenceChunk = s;
        } else {
          sentenceChunk = sentenceChunk ? `${sentenceChunk} ${s}` : s;
        }
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk.trim());
      }
    } else if ((currentChunk + '\n\n' + p).trim().length > maxChars) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = p;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${p}` : p;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
};

