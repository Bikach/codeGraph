import type { ResolvedFile, SupportedLanguage } from '../../types.js';

/**
 * Detect the primary language of the files.
 */
export function detectPrimaryLanguage(files: ResolvedFile[]): SupportedLanguage {
  const languageCounts = new Map<SupportedLanguage, number>();

  for (const file of files) {
    const count = languageCounts.get(file.language) || 0;
    languageCounts.set(file.language, count + 1);
  }

  let maxCount = 0;
  let primaryLanguage: SupportedLanguage = 'kotlin';

  for (const [language, count] of languageCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryLanguage = language;
    }
  }

  return primaryLanguage;
}
