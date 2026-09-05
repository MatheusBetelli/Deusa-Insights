import { validateProductionConfig } from "./production-config";

const errors = validateProductionConfig({
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  authCookieSameSite: process.env.AUTH_COOKIE_SAME_SITE,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  resendTestRecipient: process.env.RESEND_TEST_RECIPIENT,
  enableLeadMutations: process.env.ENABLE_LEAD_MUTATIONS,
  enableCommercialActions: process.env.ENABLE_COMMERCIAL_ACTIONS,
});

if (errors.length > 0) {
  console.error("Configuração de produção inválida:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Configuração de produção válida; nenhum segredo foi exibido.");
}
