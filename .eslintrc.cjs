module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react-hooks'],
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  rules: {
    'no-unused-vars': 'off', // Base ESLint does not count JSX component references as variable use.
  },
};
