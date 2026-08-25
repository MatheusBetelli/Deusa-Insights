import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
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

  return {
    plugins: [
      productionApiUrlGuard(apiUrl),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      viteReact(),
      tailwindcss(),
    ],
  };
});
