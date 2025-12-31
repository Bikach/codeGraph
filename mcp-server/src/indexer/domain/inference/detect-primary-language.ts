import type { ResolvedFile, SupportedLanguage } from '../../types.js';

/**
 * Detect the primary language of the files.
 *
 * Returns the language with the most files.
 * Throws an error if no files are provided (cannot detect language from empty input).
 */
export function detectPrimaryLanguage(files: ResolvedFile[]): SupportedLanguage {
  if (files.length === 0) {
    throw new Error('Cannot detect primary language: no files provided');
  }

  const languageCounts = new Map<SupportedLanguage, number>();

  for (const file of files) {
    const count = languageCounts.get(file.language) || 0;
    languageCounts.set(file.language, count + 1);
  }

  let maxCount = 0;
  let primaryLanguage: SupportedLanguage = files[0]!.language;

  for (const [language, count] of languageCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryLanguage = language;
    }
  }

  return primaryLanguage;
}
