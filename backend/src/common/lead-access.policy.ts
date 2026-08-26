import { ForbiddenException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";

export type LeadAccessActor = {
  sub: string;
  email?: string;
  role?: string;
};

export function hasFullPortfolioAccess(actor: LeadAccessActor): boolean {
  return actor.role === UserRole.ADMIN || actor.role === UserRole.MANAGER;
}

export function buildLeadAccessWhere(actor: LeadAccessActor): Prisma.LeadWhereInput {
  if (hasFullPortfolioAccess(actor)) return {};

  const ownership: Prisma.LeadWhereInput[] = [{ assignedToId_legacy: actor.sub }];
  if (actor.email) {
    ownership.push({ assignedTo: { is: { email: actor.email } } });
  }

  return { OR: ownership };
}

export function scopeLeadWhere(
  where: Prisma.LeadWhereInput,
  actor: LeadAccessActor,
): Prisma.LeadWhereInput {
  if (hasFullPortfolioAccess(actor)) return where;
  return { AND: [where, buildLeadAccessWhere(actor)] };
}

export function scopeCompanyWhere(
  where: Prisma.CompanyWhereInput,
  actor: LeadAccessActor,
): Prisma.CompanyWhereInput {
  if (hasFullPortfolioAccess(actor)) return where;
  return {
    AND: [where, { lead: { is: buildLeadAccessWhere(actor) } }],
  };
}

export function assertSalesCannotManageLeadAssignment(
  actor: LeadAccessActor,
  fields: { assignedToId?: unknown; score?: unknown; potentialLevel?: unknown },
): void {
  if (
    !hasFullPortfolioAccess(actor) &&
    (fields.assignedToId !== undefined ||
      fields.score !== undefined ||
      fields.potentialLevel !== undefined)
  ) {
    throw new ForbiddenException(
      "Vendedores não podem alterar responsável, score ou potencial do lead",
    );
  }
}

export function leadAccessCacheKey(actor: LeadAccessActor): string {
  return hasFullPortfolioAccess(actor) ? "portfolio:all" : `portfolio:user:${actor.sub}`;
}
