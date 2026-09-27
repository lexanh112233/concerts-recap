import {defineConfig} from "vitest/config";

export default defineConfig({
    // để `@/lib/...` trong test trỏ đúng như trong code (paths ở tsconfig.json); Vite hỗ trợ sẵn nên không cần plugin
    resolve: {tsconfigPaths: true},
    test: {
        environment: "node",
        include: ["src/**/*.test.{ts,tsx}"],
        globalSetup: ["./vitest.global-setup.ts"],
        // mỗi test bắt đầu với mock và biến môi trường (vi.stubEnv) sạch
        restoreMocks: true,
        unstubEnvs: true,
    },
});
