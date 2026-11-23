import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.js', '*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/check-param-names': 'off',
        },
    },
    {
        ignores: [
            'build/**/*',
            'admin/**/*',
            'test/**/*',
            'tmp/**/*',
            '**/*.mjs',
            // the web components are a Vite project of their own, linted with `npm run lint:wc`
            'src-webcomponents/**/*',
        ],
    },
];
