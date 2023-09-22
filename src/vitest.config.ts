import { defineConfig } from "vitest/config";
// import
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        environmentOptions: {
        },
        coverage: {
            reportsDirectory: './tests/coverage'
        }
    },
})