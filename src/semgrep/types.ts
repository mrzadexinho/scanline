export interface ScanConfig {
  target: string;
  rulesets?: string[];
  languages?: string[];
  usePro?: boolean;
  metricsOff?: boolean;
  outputDir?: string;
  include?: string[];
  exclude?: string[];
}

export interface ScanResult {
  success: boolean;
  findingsCount: number;
  sarifOutput?: string;
  jsonOutput?: string;
  errors: string[];
  command: string;
  duration: number;
}

export type Language =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'ruby'
  | 'java'
  | 'php'
  | 'c'
  | 'cpp'
  | 'rust'
  | 'kotlin'
  | 'swift'
  | 'csharp';

export interface LanguageDetection {
  language: Language;
  fileCount: number;
  extensions: string[];
}

export const LANGUAGE_EXTENSIONS: Record<Language, string[]> = {
  python: ['.py'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  go: ['.go'],
  ruby: ['.rb'],
  java: ['.java'],
  php: ['.php'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hh'],
  rust: ['.rs'],
  kotlin: ['.kt', '.kts'],
  swift: ['.swift'],
  csharp: ['.cs'],
};

export const DEFAULT_RULESETS: Record<string, string[]> = {
  baseline: ['p/security-audit', 'p/secrets'],
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

export type Framework =
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'react'
  | 'nextjs'
  | 'angular'
  | 'express'
  | 'spring'
  | 'rails'
  | 'laravel'
  | 'symfony';

export interface FrameworkDetection {
  framework: Framework;
  confidence: number;
  detectedBy: string;
}

export const FRAMEWORK_RULESETS: Record<Framework, string> = {
  django: 'p/django',
  flask: 'p/flask',
  fastapi: 'p/fastapi',
  react: 'p/react',
  nextjs: 'p/nextjs',
  angular: 'p/angular',
  express: 'p/express',
  spring: 'p/spring',
  rails: 'p/rails',
  laravel: 'p/laravel',
  symfony: 'p/symfony',
};
