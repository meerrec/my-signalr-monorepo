import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const appSourceRoot = fileURLToPath(new URL('./apps/web/src', import.meta.url));
const configFilePath = fileURLToPath(import.meta.url);

/**
 * Resolver interface v2 consumed by `eslint-module-utils` (the resolver engine used by
 * `eslint-plugin-boundaries`). It is exported from this config file on purpose: v7 removed
 * the `boundaries/alias` setting, and the repo does not ship `eslint-import-resolver-typescript`.
 * Returning `{ found: false }` for every non-`@/` source lets the built-in `node` resolver
 * handle relative imports and workspace packages.
 */
export const interfaceVersion = 2;

function resolveFilePath(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.json`,
    `${base}.css`,
  ];

  for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
    candidates.push(path.join(base, `index${extension}`));
  }

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Candidate does not exist; keep looking.
    }
  }

  return null;
}

/**
 * Workspace package names are resolved to their real source paths. Without this, pnpm's
 * `node_modules` symlinks would make `@chat/*` look external and boundaries policies for
 * `packages/*` would never be evaluated.
 */
function readWorkspacePackages() {
  const packages = new Map();
  const packagesDir = path.join(repoRoot, 'packages');

  let entries;
  try {
    entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return packages;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(packagesDir, entry.name);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
      if (typeof manifest.name !== 'string') {
        continue;
      }

      const rootExport = manifest.exports?.['.'];
      const entryPoint =
        (typeof rootExport === 'string' ? rootExport : rootExport?.import ?? rootExport?.types) ??
        manifest.main ??
        'src/index.ts';
      packages.set(manifest.name, {
        dir: packageDir,
        entry: path.resolve(packageDir, entryPoint),
      });
    } catch {
      // A package without a readable manifest is ignored by the resolver.
    }
  }

  return packages;
}

const workspacePackages = readWorkspacePackages();

export function resolve(source) {
  if (source.startsWith('@/')) {
    const resolved = resolveFilePath(path.resolve(appSourceRoot, source.slice(2)));
    return resolved ? { found: true, path: resolved } : { found: false };
  }

  for (const [packageName, packageInfo] of workspacePackages) {
    if (source === packageName) {
      return { found: true, path: packageInfo.entry };
    }
    if (source.startsWith(`${packageName}/`)) {
      const resolved = resolveFilePath(
        path.join(packageInfo.dir, source.slice(packageName.length + 1)),
      );
      return resolved ? { found: true, path: resolved } : { found: false };
    }
  }

  return { found: false };
}

const importResolver = {
  [configFilePath]: {},
  node: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'],
  },
};

/**
 * FSD element = slice folder. `partialMatch: false` makes patterns relative to the repo root,
 * so `entities/message` and `entities/room` are different elements, while all files inside one
 * slice share the same element path.
 */
const elementDescriptors = [
  { type: 'app', pattern: 'apps/web/src/app', partialMatch: false },
  { type: 'pages', pattern: 'apps/web/src/pages/*', capture: ['slice'], partialMatch: false },
  { type: 'widgets', pattern: 'apps/web/src/widgets/*', capture: ['slice'], partialMatch: false },
  { type: 'features', pattern: 'apps/web/src/features/*', capture: ['slice'], partialMatch: false },
  { type: 'entities', pattern: 'apps/web/src/entities/*', capture: ['slice'], partialMatch: false },
  { type: 'shared', pattern: 'apps/web/src/shared/*', capture: ['segment'], partialMatch: false },
  { type: 'package', pattern: 'packages/*', capture: ['package'], partialMatch: false },
  // `mode: 'full'` is the only v7 way to classify individual root files. Deprecation
  // warnings for `mode` are silenced below; other root files stay unknown (and are ignored).
  { type: 'root', pattern: ['*.ts', '*.js', 'scripts/*'], mode: 'full' },
];

const allow = (type) => ({ to: { element: { type } } });
const sameSlice = (type) => ({
  to: { element: { type, captured: { slice: '${from.slice}' } } },
});

const policies = [
  {
    from: { element: { type: 'app' } },
    allow: [
      allow('app'),
      allow('pages'),
      allow('widgets'),
      allow('features'),
      allow('entities'),
      allow('shared'),
      allow('package'),
    ],
  },
  {
    from: { element: { type: 'pages' } },
    allow: [
      sameSlice('pages'),
      allow('widgets'),
      allow('features'),
      allow('entities'),
      allow('shared'),
      allow('package'),
    ],
  },
  {
    from: { element: { type: 'widgets' } },
    allow: [
      sameSlice('widgets'),
      allow('features'),
      allow('entities'),
      allow('shared'),
      allow('package'),
    ],
  },
  {
    from: { element: { type: 'features' } },
    allow: [sameSlice('features'), allow('entities'), allow('shared'), allow('package')],
  },
  {
    from: { element: { type: 'entities' } },
    allow: [sameSlice('entities'), allow('shared'), allow('package')],
  },
  {
    from: { element: { type: 'shared' } },
    allow: [allow('shared'), allow('package')],
  },
  {
    from: { element: { type: 'package' } },
    allow: [allow('package')],
  },
  {
    from: { element: { type: 'root' } },
    allow: [allow('root'), allow('shared'), allow('package')],
  },
];

const boundariesRules = {
  'boundaries/dependencies': [
    'error',
    {
      default: 'disallow',
      policies,
      // Include imports between segments of one slice, so the same-slice allow rule is
      // what makes `ui -> model` inside `entities/message` legal.
      checkInternals: true,
      // Package specifiers (`@chat/*`, `react`, ...) are external and are not architected here.
      checkAllOrigins: false,
      checkUnknownLocals: false,
    },
  ],
  // Unknown targets must not fail the build (aliases are resolved by the custom resolver,
  // but files outside all descriptors may still be imported).
  'boundaries/no-unknown': 'off',
  'boundaries/no-unknown-dependencies': 'off',
  'boundaries/no-unknown-files': 'off',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'packages/signalr-client/src/generated/**',
      '.cache/**',
      'reports/**',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Existing test doubles use `_request` to document intentionally unused transport args.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // `scripts/generate-contracts.ts` wraps and rethrows errors without `cause`; that file is
    // owned by @signalr-integrator and is not part of the FSD boundaries task.
    files: ['scripts/**/*.{ts,js}'],
    rules: { 'preserve-caught-error': 'off' },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': repoRoot,
      'boundaries/elements': elementDescriptors,
      'boundaries/legacy-templates': true,
      'boundaries/legacy-warnings': false,
      'import/resolver': importResolver,
    },
    rules: boundariesRules,
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    plugins: { boundaries },
    rules: {
      'boundaries/dependencies': 'off',
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-dependencies': 'off',
      'boundaries/no-unknown-files': 'off',
    },
  },
);
