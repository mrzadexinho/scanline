import { LANGUAGE_EXTENSIONS, type Language, type LanguageDetection } from './types.js';

export function detectLanguagesFromFiles(filePaths: string[]): LanguageDetection[] {
  const counts = new Map<Language, { count: number; extensions: Set<string> }>();

  for (const filePath of filePaths) {
    const ext = getExtension(filePath);
    if (!ext) continue;

    for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
      if (extensions.includes(ext)) {
        const entry = counts.get(lang as Language) ?? { count: 0, extensions: new Set() };
        entry.count++;
        entry.extensions.add(ext);
        counts.set(lang as Language, entry);
      }
    }
  }

  const detections: LanguageDetection[] = [];
  for (const [language, { count, extensions }] of counts) {
    detections.push({
      language,
      fileCount: count,
      extensions: [...extensions],
    });
  }

  return detections.sort((a, b) => b.fileCount - a.fileCount);
}

function getExtension(filePath: string): string | null {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return null;
  return filePath.slice(lastDot).toLowerCase();
}

export function selectRulesets(languages: Language[], customRulesets?: string[]): string[] {
  if (customRulesets && customRulesets.length > 0) {
    return customRulesets;
  }

  const rulesets = new Set<string>();

  // Always include baseline
  rulesets.add('p/security-audit');
  rulesets.add('p/secrets');

  for (const lang of languages) {
    const langRulesets = LANGUAGE_EXTENSIONS[lang]
      ? getDefaultRulesets(lang)
      : [];
    for (const rs of langRulesets) {
      rulesets.add(rs);
    }
  }

  return [...rulesets];
}

function getDefaultRulesets(lang: Language): string[] {
  const map: Record<string, string[]> = {
    python: ['p/python'],
    javascript: ['p/javascript', 'p/nodejs'],
    typescript: ['p/typescript'],
    go: ['p/golang'],
    ruby: ['p/ruby'],
    java: ['p/java'],
    php: ['p/php'],
    c: ['p/c'],
    cpp: ['p/c'],
    rust: ['p/rust'],
    kotlin: ['p/kotlin'],
    swift: ['p/swift'],
    csharp: ['p/csharp'],
  };
  return map[lang] ?? [];
}
