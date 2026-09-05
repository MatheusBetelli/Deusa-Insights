export type ProductionConfig = {
  databaseUrl?: string;
  directUrl?: string;
  jwtSecret?: string;
  frontendUrl?: string;
  allowedOrigins?: string;
  authCookieSameSite?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  resendTestRecipient?: string;
  enableLeadMutations?: string;
  enableCommercialActions?: string;
};

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isValidProductionOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.origin === origin && !isLocalhostOrigin(origin);
  } catch {
    return false;
  }
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isPlaceholderDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return new Set(["host", "hostname", "database", "db", "your-host"]).has(hostname);
  } catch {
    return false;
  }
}

function validateDatabaseConfig(config: ProductionConfig): string[] {
  const errors: string[] = [];
  const databaseUrl = config.databaseUrl?.trim() ?? "";

  if (!databaseUrl) {
    errors.push("DATABASE_URL não está definida.");
  } else if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    errors.push("DATABASE_URL deve usar PostgreSQL.");
  } else if (isLocalDatabaseUrl(databaseUrl)) {
    errors.push("DATABASE_URL não pode apontar para localhost em produção.");
  } else if (isPlaceholderDatabaseUrl(databaseUrl)) {
    errors.push("DATABASE_URL não pode apontar para um host de placeholder em produção.");
  }

  if (config.directUrl?.trim()) {
    errors.push(
      "DIRECT_URL não deve ser injetada no runtime do Cloud Run; use-a somente no job de migrations.",
    );
  }

  return errors;
}

function isValidEmailAddress(email: string): boolean {
  const atIndex = email.indexOf("@");
  const dotIndex = email.lastIndexOf(".");
  return (
    atIndex > 0 &&
    dotIndex > atIndex + 1 &&
    dotIndex < email.length - 1 &&
    !/[\s<>()[\],;:]/.test(email)
  );
}

export function validateProductionConfig(config: ProductionConfig): string[] {
  const errors: string[] = [];
  const jwtSecret = config.jwtSecret ?? "";

  errors.push(...validateDatabaseConfig(config));

  const normalizedJwtSecret = jwtSecret.toLowerCase();
  const weakSecretMarkers = [
    "dev-secret-change-me",
    "change-me",
    "dev-secret",
    "placeholder",
    "gere_um_segredo",
  ];
  if (!jwtSecret) {
    errors.push("JWT_SECRET não está definida.");
  } else if (jwtSecret.length < 32) {
    errors.push("JWT_SECRET deve possuir pelo menos 32 caracteres.");
  } else if (weakSecretMarkers.some((marker) => normalizedJwtSecret.includes(marker))) {
    errors.push("JWT_SECRET parece usar um valor padrão ou de desenvolvimento.");
  }

  if (config.enableLeadMutations?.trim().toLowerCase() !== "false") {
    errors.push(
      "ENABLE_LEAD_MUTATIONS deve ser explicitamente false para preservar a carteira congelada.",
    );
  }
  if (config.enableCommercialActions?.trim().toLowerCase() !== "true") {
    errors.push(
      "ENABLE_COMMERCIAL_ACTIONS deve ser explicitamente true para o fluxo comercial autorizado.",
    );
  }

  const allowedOrigins = (config.allowedOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    allowedOrigins.length === 0 ||
    allowedOrigins.some((origin) => !isValidProductionOrigin(origin))
  ) {
    errors.push("ALLOWED_ORIGINS deve conter somente origens HTTPS completas e sem barra final.");
  }

  const frontendUrl = config.frontendUrl?.trim() ?? "";
  if (!frontendUrl || !isValidProductionOrigin(frontendUrl)) {
    errors.push("FRONTEND_URL deve ser uma origem HTTPS válida e sem barra final.");
  }

  const cookieSameSite = config.authCookieSameSite?.trim().toLowerCase() ?? "";
  if (!cookieSameSite || !["lax", "strict", "none"].includes(cookieSameSite)) {
    errors.push("AUTH_COOKIE_SAME_SITE deve ser lax, strict ou none.");
  }

  if (!config.resendApiKey?.trim() || !config.resendFromEmail?.trim()) {
    errors.push("RESEND_API_KEY e RESEND_FROM_EMAIL são obrigatórias para recuperação de senha.");
  }

  if (
    config.resendTestRecipient?.trim() &&
    !isValidEmailAddress(config.resendTestRecipient.trim())
  ) {
    errors.push("RESEND_TEST_RECIPIENT deve ser um e-mail válido quando configurado.");
  }

  return errors;
}
