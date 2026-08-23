// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

function productionApiUrlGuard(): Plugin {
  return {
    name: "deusa-production-api-url-guard",
    configResolved(config) {
      if (config.command !== "build" || config.mode !== "production") return;

      const definedValue = config.define?.["import.meta.env.VITE_API_URL"];
      let configuredUrl = "";
      if (typeof definedValue === "string") {
        try {
          const parsedValue = JSON.parse(definedValue);
          configuredUrl = typeof parsedValue === "string" ? parsedValue.trim() : "";
        } catch {
          configuredUrl = "";
        }
      }
      if (!configuredUrl) {
        if (!process.env.CI) return; // Permite build local sem quebrar
        throw new Error("VITE_API_URL é obrigatória para gerar o frontend de produção.");
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(configuredUrl);
      } catch {
        if (!process.env.CI) return;
        throw new Error("VITE_API_URL deve ser uma URL absoluta válida.");
      }

      const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
      if (parsedUrl.protocol !== "https:" || localHosts.has(parsedUrl.hostname)) {
        if (process.env.CI) {
          throw new Error(
            "VITE_API_URL de produção deve usar HTTPS e não pode apontar para localhost.",
          );
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        throw new Error("VITE_API_URL não pode conter credenciais.");
      }
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  plugins: [productionApiUrlGuard()],
  tanstackStart: {
    server: { entry: "server" },
  },
});
