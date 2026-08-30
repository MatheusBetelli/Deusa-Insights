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

  return {
    plugins:
      deployTarget === "cloudflare"
        ? [
            productionApiUrlGuard(apiUrl),
            cloudflare({ viteEnvironment: { name: "ssr" } }),
            ...sharedPlugins,
            viteReact(),
            tailwindcss(),
          ]
        : [productionApiUrlGuard(apiUrl), ...sharedPlugins, nitro(), viteReact(), tailwindcss()],
  };
});
