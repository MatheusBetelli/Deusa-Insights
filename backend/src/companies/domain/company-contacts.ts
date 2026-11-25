import { BadRequestException } from "@nestjs/common";
import { ContactSource, ContactType } from "@prisma/client";
import { LeadAccessActor } from "../../common/lead-access.policy";
import { CreateCompanyContactDto, UpdateCompanyContactDto } from "../dto/company-contact.dto";
export type NormalizedContact = {
  type: ContactType;
  value: string;
  source: ContactSource;
  isPrimary: boolean;
  active: boolean;
};

function normalizeContactValue(type: ContactType, rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    throw new BadRequestException("Contato deve possuir um valor.");
  }

  if (type === ContactType.EMAIL) {
    const email = value.toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      throw new BadRequestException("E-mail comercial inválido.");
    }
    return email;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 13) {
    throw new BadRequestException("Telefone comercial deve possuir entre 8 e 13 dígitos.");
  }
  if (type === ContactType.WHATSAPP && digits.length < 10) {
    throw new BadRequestException("WhatsApp deve possuir DDD.");
  }
  return digits;
}

function normalizeContactDto(
  dto: CreateCompanyContactDto | UpdateCompanyContactDto,
  fallbackType?: ContactType,
  fallbackValue?: string,
): NormalizedContact {
  const type = "type" in dto && dto.type ? dto.type : fallbackType;
  if (!type) throw new BadRequestException("Tipo de contato é obrigatório.");

  const rawValue = dto.value ?? fallbackValue;
  if (!rawValue) throw new BadRequestException("Contato deve possuir um valor.");

  return {
    type,
    value: normalizeContactValue(type, rawValue),
    source: dto.source ?? ContactSource.MANUAL,
    isPrimary: dto.isPrimary ?? false,
    active: dto.active ?? true,
  };
}

export function normalizeManualContactDto(dto: CreateCompanyContactDto): NormalizedContact {
  return {
    ...normalizeContactDto(dto),
    source: ContactSource.MANUAL,
  };
}

export function normalizeContactUpdateDto(
  dto: UpdateCompanyContactDto,
  existing: NormalizedContact,
): NormalizedContact {
  const value =
    dto.value !== undefined ? normalizeContactValue(existing.type, dto.value) : existing.value;
  const active = dto.active ?? existing.active;
  return {
    type: existing.type,
    value,
    source: existing.source,
    isPrimary: active ? (dto.isPrimary ?? existing.isPrimary) : false,
    active,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export function contactAuditFields(actor: LeadAccessActor) {
  return isUuid(actor.sub)
    ? { createdBy: actor.sub, createdByLegacy: undefined }
    : { createdByLegacy: actor.sub };
}
