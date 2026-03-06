import { LANGUAGE_EXTENSIONS, FRAMEWORK_RULESETS, type Language, type LanguageDetection, type Framework, type FrameworkDetection } from './types.js';

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

interface FileReader {
  (path: string): string | null;
}

export function detectFrameworks(filePaths: string[], readFile?: FileReader): FrameworkDetection[] {
  const detections: FrameworkDetection[] = [];
  const fileSet = new Set(filePaths.map(f => f.toLowerCase()));
  const fileNames = new Set(filePaths.map(f => {
    const parts = f.split('/');
    return parts[parts.length - 1].toLowerCase();
  }));

  // Python frameworks
  if (fileNames.has('settings.py') || fileNames.has('urls.py') || fileNames.has('wsgi.py')) {
    detections.push({ framework: 'django', confidence: 90, detectedBy: 'settings.py/urls.py/wsgi.py' });
  }

  // Check requirements.txt / pyproject.toml for Python frameworks
  const pythonDeps = readPythonDeps(filePaths, readFile);
  if (pythonDeps.some(d => d.startsWith('django'))) {
    detections.push({ framework: 'django', confidence: 95, detectedBy: 'django in dependencies' });
  }
  if (pythonDeps.some(d => d.startsWith('flask'))) {
    detections.push({ framework: 'flask', confidence: 95, detectedBy: 'flask in dependencies' });
  }
  if (pythonDeps.some(d => d.startsWith('fastapi'))) {
    detections.push({ framework: 'fastapi', confidence: 95, detectedBy: 'fastapi in dependencies' });
  }

  // JavaScript/TypeScript frameworks — check package.json
  const jsDeps = readPackageJsonDeps(filePaths, readFile);
  if (jsDeps.includes('react') || jsDeps.includes('react-dom')) {
    detections.push({ framework: 'react', confidence: 95, detectedBy: 'react in package.json' });
  }
  if (jsDeps.includes('next')) {
    detections.push({ framework: 'nextjs', confidence: 95, detectedBy: 'next in package.json' });
  }
  if (jsDeps.includes('@angular/core')) {
    detections.push({ framework: 'angular', confidence: 95, detectedBy: '@angular/core in package.json' });
  }
  if (jsDeps.includes('express')) {
    detections.push({ framework: 'express', confidence: 95, detectedBy: 'express in package.json' });
  }

  // Next.js by config file
  if (fileNames.has('next.config.js') || fileNames.has('next.config.mjs') || fileNames.has('next.config.ts')) {
    detections.push({ framework: 'nextjs', confidence: 90, detectedBy: 'next.config file' });
  }

  // Angular by config file
  if (fileNames.has('angular.json')) {
    detections.push({ framework: 'angular', confidence: 90, detectedBy: 'angular.json' });
  }

  // Java/Kotlin frameworks
  if (fileSet.has('pom.xml') || [...fileSet].some(f => f.includes('pom.xml'))) {
    const pomContent = readFileFromPaths(filePaths, 'pom.xml', readFile);
    if (pomContent && pomContent.includes('spring')) {
      detections.push({ framework: 'spring', confidence: 90, detectedBy: 'spring in pom.xml' });
    }
  }

  // Ruby frameworks
  if (fileNames.has('gemfile')) {
    const gemContent = readFileFromPaths(filePaths, 'Gemfile', readFile);
    if (gemContent && gemContent.includes('rails')) {
      detections.push({ framework: 'rails', confidence: 95, detectedBy: 'rails in Gemfile' });
    }
  }
  if (fileNames.has('config.ru') || [...fileSet].some(f => f.includes('config/routes.rb'))) {
    detections.push({ framework: 'rails', confidence: 85, detectedBy: 'config.ru/routes.rb' });
  }

  // PHP frameworks
  if (fileNames.has('composer.json')) {
    const composerContent = readFileFromPaths(filePaths, 'composer.json', readFile);
    if (composerContent) {
      if (composerContent.includes('laravel')) {
        detections.push({ framework: 'laravel', confidence: 95, detectedBy: 'laravel in composer.json' });
      }
      if (composerContent.includes('symfony')) {
        detections.push({ framework: 'symfony', confidence: 95, detectedBy: 'symfony in composer.json' });
      }
    }
  }
  if (fileNames.has('artisan')) {
    detections.push({ framework: 'laravel', confidence: 90, detectedBy: 'artisan file' });
  }

  // Deduplicate — keep highest confidence per framework
  return deduplicateDetections(detections);
}

function deduplicateDetections(detections: FrameworkDetection[]): FrameworkDetection[] {
  const best = new Map<Framework, FrameworkDetection>();
  for (const d of detections) {
    const existing = best.get(d.framework);
    if (!existing || d.confidence > existing.confidence) {
      best.set(d.framework, d);
    }
  }
  return [...best.values()];
}

function readPythonDeps(filePaths: string[], readFile?: FileReader): string[] {
  if (!readFile) return [];

  const reqFile = filePaths.find(f => f.endsWith('requirements.txt'));
  if (reqFile) {
    const content = readFile(reqFile);
    if (content) return content.toLowerCase().split('\n');
  }

  const pyprojectFile = filePaths.find(f => f.endsWith('pyproject.toml'));
  if (pyprojectFile) {
    const content = readFile(pyprojectFile);
    if (content) return content.toLowerCase().split('\n');
  }

  return [];
}

function readPackageJsonDeps(filePaths: string[], readFile?: FileReader): string[] {
  if (!readFile) return [];

  const pkgFile = filePaths.find(f => f.endsWith('package.json') && !f.includes('node_modules'));
  if (!pkgFile) return [];

  const content = readFile(pkgFile);
  if (!content) return [];

  try {
    const pkg = JSON.parse(content);
    return [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
  } catch {
    return [];
  }
}

function readFileFromPaths(filePaths: string[], fileName: string, readFile?: FileReader): string | null {
  if (!readFile) return null;

  const target = filePaths.find(f => f.endsWith(fileName) || f.toLowerCase().endsWith(fileName.toLowerCase()));
  if (!target) return null;

  return readFile(target);
}

export function selectRulesetsWithFrameworks(
  languages: Language[],
  frameworks: FrameworkDetection[],
  customRulesets?: string[]
): string[] {
  if (customRulesets && customRulesets.length > 0) {
    return customRulesets;
  }

  const rulesets = new Set<string>();

  // Baseline
  rulesets.add('p/security-audit');
  rulesets.add('p/secrets');

  // Language rulesets
  for (const lang of languages) {
    for (const rs of getDefaultRulesets(lang)) {
      rulesets.add(rs);
    }
  }

  // Framework rulesets
  for (const fw of frameworks) {
    const rs = FRAMEWORK_RULESETS[fw.framework];
    if (rs) rulesets.add(rs);
  }

  return [...rulesets];
}
