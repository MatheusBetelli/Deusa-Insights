import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

function productionApiUrlGuard(configuredUrl: string): Plugin {
  return {
    name: "deusa-production-api-url-guard",
    configResolved(config) {
      if (config.command !== "build" || config.mode !== "production") return;
      if (!configuredUrl) {
        if (!process.env.CI) return;
        throw new Error("VITE_API_URL e obrigatoria para gerar o frontend de producao.");
      }

      // No Cloud Run, /api e encaminhado pelo servidor SSR ao backend. Isso mantem
      // o cookie HttpOnly first-party sem expor o backend diretamente ao navegador.
      if (configuredUrl === "/api") return;

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(configuredUrl);
      } catch {
        if (!process.env.CI) return;
        throw new Error("VITE_API_URL deve ser uma URL absoluta valida.");
      }

      const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
      if (parsedUrl.protocol !== "https:" || localHosts.has(parsedUrl.hostname)) {
        if (process.env.CI) {
          throw new Error(
            "VITE_API_URL de producao deve usar HTTPS e nao pode apontar para localhost.",
          );
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        throw new Error("VITE_API_URL nao pode conter credenciais.");
      }
    },
  };
}

/**
 * Splits heavy vendor libraries into separate, long-term-cacheable chunks.
 * Reduces initial bundle size and improves Lighthouse performance scores.
 */
function manualChunks(id: string): string | undefined {
  // Leaflet and markercluster are only loaded on the map page – keep together.
  if (id.includes("leaflet")) return "vendor-map";
  // Recharts is only loaded on the dashboard page.
  if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-")) {
    return "vendor-charts";
  }
  // Radix primitives are shared across many components; cache separately.
  if (id.includes("@radix-ui")) return "vendor-radix";
  // TanStack ecosystem (router, query, start) – stable across deploys.
  if (id.includes("@tanstack")) return "vendor-tanstack";
  // Lucide icon tree-shakes well but is still sizable in aggregate.
  if (id.includes("lucide-react")) return "vendor-icons";
  return undefined;
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const apiUrl = (process.env.VITE_API_URL ?? fileEnv.VITE_API_URL ?? "").trim();
  const deployTarget = (process.env.DEPLOY_TARGET ?? "cloudflare").trim().toLowerCase();

  if (deployTarget !== "cloudflare" && deployTarget !== "node") {
    throw new Error("DEPLOY_TARGET deve ser cloudflare ou node.");
  }

  const startPlugin = tanstackStart({
    server: { entry: "server" },
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**"],
        specifiers: ["server-only"],
      },
    },
  });

  const sharedPlugins = [tsConfigPaths({ projects: ["./tsconfig.json"] }), startPlugin];

  const rollupOptions = {
    output: {
      manualChunks,
    },
  };

  return {
    build: { rollupOptions },
    plugins:
      deployTarget === "cloudflare"
        ? [
            productionApiUrlGuard(apiUrl),
            cloudflare({ viteEnvironment: { name: "ssr" } }),
            ...sharedPlugins,
            viteReact(),
            tailwindcss(),
          ]
        : [
            productionApiUrlGuard(apiUrl),
            ...sharedPlugins,
            nitro({ compressPublicAssets: { gzip: true, brotli: true } }),
            viteReact(),
            tailwindcss(),
          ],
  };
});
