import { describe, it, expect } from 'vitest';
import { detectFrameworks, selectRulesetsWithFrameworks } from '../../src/semgrep/detector.js';

describe('detectFrameworks', () => {
  it('should detect Django by settings.py', () => {
    const files = ['myapp/settings.py', 'myapp/urls.py', 'manage.py'];
    const result = detectFrameworks(files);
    expect(result.some(d => d.framework === 'django')).toBe(true);
  });

  it('should detect React from package.json', () => {
    const files = ['package.json', 'src/App.tsx'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'package.json') {
        return JSON.stringify({ dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } });
      }
      return null;
    });
    expect(result.some(d => d.framework === 'react')).toBe(true);
  });

  it('should detect Next.js from config file', () => {
    const files = ['next.config.js', 'pages/index.tsx'];
    const result = detectFrameworks(files);
    expect(result.some(d => d.framework === 'nextjs')).toBe(true);
  });

  it('should detect Express from package.json', () => {
    const files = ['package.json', 'src/server.ts'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'package.json') {
        return JSON.stringify({ dependencies: { express: '^4.18.0' } });
      }
      return null;
    });
    expect(result.some(d => d.framework === 'express')).toBe(true);
  });

  it('should detect Angular from angular.json', () => {
    const files = ['angular.json', 'src/app/app.component.ts'];
    const result = detectFrameworks(files);
    expect(result.some(d => d.framework === 'angular')).toBe(true);
  });

  it('should detect Flask from requirements.txt', () => {
    const files = ['requirements.txt', 'app.py'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'requirements.txt') return 'flask==2.3.0\nrequests==2.31.0';
      return null;
    });
    expect(result.some(d => d.framework === 'flask')).toBe(true);
  });

  it('should detect FastAPI from requirements.txt', () => {
    const files = ['requirements.txt', 'main.py'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'requirements.txt') return 'fastapi==0.100.0\nuvicorn==0.23.0';
      return null;
    });
    expect(result.some(d => d.framework === 'fastapi')).toBe(true);
  });

  it('should detect Rails from Gemfile', () => {
    const files = ['Gemfile', 'config/routes.rb', 'app/models/user.rb'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'Gemfile') return "source 'https://rubygems.org'\ngem 'rails', '~> 7.0'";
      return null;
    });
    expect(result.some(d => d.framework === 'rails')).toBe(true);
  });

  it('should detect Laravel from composer.json', () => {
    const files = ['composer.json', 'artisan', 'app/Http/Controllers/Controller.php'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'composer.json') return JSON.stringify({ require: { 'laravel/framework': '^10.0' } });
      return null;
    });
    expect(result.some(d => d.framework === 'laravel')).toBe(true);
  });

  it('should detect Laravel by artisan file', () => {
    const files = ['artisan', 'app/Http/routes.php'];
    const result = detectFrameworks(files);
    expect(result.some(d => d.framework === 'laravel')).toBe(true);
  });

  it('should detect multiple frameworks', () => {
    const files = ['package.json', 'next.config.js', 'src/pages/index.tsx'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'package.json') {
        return JSON.stringify({ dependencies: { react: '^18.0', next: '^14.0', express: '^4.18' } });
      }
      return null;
    });
    const frameworks = result.map(d => d.framework);
    expect(frameworks).toContain('react');
    expect(frameworks).toContain('nextjs');
    expect(frameworks).toContain('express');
  });

  it('should deduplicate detections keeping highest confidence', () => {
    const files = ['next.config.js', 'package.json'];
    const result = detectFrameworks(files, (path) => {
      if (path === 'package.json') return JSON.stringify({ dependencies: { next: '^14.0' } });
      return null;
    });
    const nextDetections = result.filter(d => d.framework === 'nextjs');
    expect(nextDetections).toHaveLength(1);
    expect(nextDetections[0].confidence).toBe(95); // package.json wins over config file
  });

  it('should return empty for no frameworks', () => {
    const files = ['src/main.c', 'src/utils.h', 'Makefile'];
    const result = detectFrameworks(files);
    expect(result).toHaveLength(0);
  });

  it('should work without fileReader (path-only detection)', () => {
    const files = ['angular.json', 'next.config.mjs', 'artisan'];
    const result = detectFrameworks(files);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe('selectRulesetsWithFrameworks', () => {
  it('should include framework rulesets', () => {
    const rulesets = selectRulesetsWithFrameworks(
      ['python'],
      [{ framework: 'django', confidence: 95, detectedBy: 'test' }]
    );
    expect(rulesets).toContain('p/python');
    expect(rulesets).toContain('p/django');
    expect(rulesets).toContain('p/security-audit');
  });

  it('should include multiple framework rulesets', () => {
    const rulesets = selectRulesetsWithFrameworks(
      ['javascript', 'typescript'],
      [
        { framework: 'react', confidence: 95, detectedBy: 'test' },
        { framework: 'express', confidence: 95, detectedBy: 'test' },
      ]
    );
    expect(rulesets).toContain('p/react');
    expect(rulesets).toContain('p/express');
    expect(rulesets).toContain('p/javascript');
  });

  it('should use custom rulesets when provided', () => {
    const rulesets = selectRulesetsWithFrameworks(
      ['python'],
      [{ framework: 'django', confidence: 95, detectedBy: 'test' }],
      ['p/custom']
    );
    expect(rulesets).toEqual(['p/custom']);
  });
});
