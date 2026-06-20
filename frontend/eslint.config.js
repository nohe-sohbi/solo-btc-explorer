import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.worker,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            // Pre-existing intentional empty dep arrays (initial load, etc.) make
            // exhaustive-deps a warning rather than a hard failure.
            'react-hooks/exhaustive-deps': 'warn',
            // Underscore-prefixed args/vars are deliberately unused (e.g. test it.each names).
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        // Test files also run helpers under Node and use Vitest globals via imports.
        files: ['src/**/*.{test,spec}.{js,jsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
