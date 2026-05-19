// Flat config for ESLint 9.x. WebExtensions globals + browser env.
// Намеренно мягкие правила: цель — поймать опечатки и явные баги, не переписать
// весь codebase. Style-issues идут через prettier.

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '*.zip',
      'tweai-mcp-server/**',
      'docs/**',
      '_locales/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // WebExtensions
        chrome: 'readonly',
        browser: 'readonly',
        // Browser
        window: 'readonly',
        document: 'readonly',
        navigation: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        history: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Boolean: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
        RegExp: 'readonly',
        Error: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        InputEvent: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        addEventListener: 'readonly',
        // own globals (shared between content scripts in same isolated world)
        TTASelectors: 'writable',
        TTALogger: 'writable',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-cond-assign': ['error', 'except-parens'],
      'no-control-regex': 'off',
      'no-useless-escape': 'warn',
    },
  },
  {
    // Build/tools — Node environment
    files: ['tools/**/*.mjs', '*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
      },
    },
  },
];
