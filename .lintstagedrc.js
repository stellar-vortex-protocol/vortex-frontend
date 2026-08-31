module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix'],
  '*.{ts,tsx}': () => 'tsc --noEmit',
  '*': ['editorconfig-checker'],
};
