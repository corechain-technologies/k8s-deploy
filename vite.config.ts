import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        clearMocks: true,
        dir: "src",
        typecheck: {
            ignoreSourceErrors: false,
            checker: "tsc",
            tsconfig: "./tsconfig.json",
            include: ["**/*.ts"],
        },
    },
});
