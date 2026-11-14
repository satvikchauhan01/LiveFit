const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    // The server has its own tooling (see server/package.json).
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'server/*'],
  },
]);
