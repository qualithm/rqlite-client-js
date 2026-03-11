import { defineConfig } from "eslint/config"

import baseConfig from "./eslint.base.config"

export default defineConfig([{ ignores: ["dist", "docs", "coverage"] }, ...baseConfig])
