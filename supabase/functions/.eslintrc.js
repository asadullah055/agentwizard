module.exports = {
  env: {
    browser: false,
    es2021: true
  },
  globals: {
    Deno: "readonly"
  },
  rules: {
    "no-undef": "off",
    "@typescript-eslint/no-explicit-any": "off"
  }
}; 