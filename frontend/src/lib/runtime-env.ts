type PublicRuntimeEnv = {
  VITE_API_URL?: string;
  VITE_STORE_URL?: string;
  DEV?: boolean;
  PROD?: boolean;
};

function isNodeTestRuntime(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "test";
}

function resolvePublicRuntimeEnv(): PublicRuntimeEnv {
  if (isNodeTestRuntime()) {
    return {
      VITE_API_URL: process.env.VITE_API_URL,
      VITE_STORE_URL: process.env.VITE_STORE_URL,
      DEV: true,
      PROD: false,
    };
  }

  return {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_STORE_URL: import.meta.env.VITE_STORE_URL,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };
}

export const publicRuntimeEnv = resolvePublicRuntimeEnv();
