import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/.netlify/**", "**/coverage/**", "docs/reference/**", "miniprogram/lib/**", "miniprogram/config/**", "miniprogram/assets/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error"
    },
  },
  {
    // 微信小程序页面/组件/脚本运行在 wx 全局下的 CommonJS 环境。
    files: ["miniprogram/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        wx: "readonly",
        Page: "readonly",
        Component: "readonly",
        App: "readonly",
        getApp: "readonly",
        getCurrentPages: "readonly",
        require: "readonly",
        module: "writable",
        exports: "writable"
      }
    },
    rules: {
      // 小程序源码是 wx 的 CommonJS，require 是约定写法，不应报“应为 import”。
      "@typescript-eslint/no-require-imports": "off",
      // 业务脚本的 catch 分支多仅用于兜底，未使用 error 变量属正常。
      "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },
  {
    // 仓库构建/工具脚本运行在 Node 环境，需要 Node 全局（console 等）。
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
);

