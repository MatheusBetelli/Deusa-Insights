import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, MessageCircle, Mail, PhoneCall, ChevronDown, Copy } from "lucide-react";
import type { Company } from "@/types/company";
import { toast } from "sonner";

export interface ContactItem {
  id: string;
  type: "phone" | "email";
  label: string;
  value: string;
  raw: string;
  isMobile: boolean;
  canWhatsapp: boolean;
}

// Cidade -> DDD padrão de fallback caso número tenha apenas 8 ou 9 dígitos sem DDD
const CITY_DDD_MAP: Record<string, string> = {
  garca: "14",
  marilia: "14",
  tupa: "14",
  pompeia: "14",
  bauru: "14",
  lins: "14",
  assis: "14",
  ourinhos: "14",
  "sao paulo": "11",
  campinas: "19",
  santos: "13",
  "ribeirao preto": "16",
  "sao jose do rio preto": "17",
  "presidente prudente": "18",
};

function getCityDdd(cidade?: string | null): string {
  if (!cidade) return "14";
  const norm = cidade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return CITY_DDD_MAP[norm] || "14";
}

// Formata telefone para exibição
function formatPhoneDisplay(
  digits: string,
  cityDdd: string,
): { display: string; fullDigits: string; isMobile: boolean } {
  let clean = digits.replace(/\D/g, "");

  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.slice(2);
  }

  // Se tiver 8 ou 9 dígitos, acrescenta o DDD da cidade
  if (clean.length === 8 || clean.length === 9) {
    clean = `${cityDdd}${clean}`;
  }

  const ddd = clean.slice(0, 2);
  const numberPart = clean.slice(2);

  // Celular no Brasil: 11 dígitos total, com a parte local começando com 9
  const isMobile = clean.length === 11 && numberPart.startsWith("9");

  let display = clean;
  if (clean.length === 11) {
    display = `(${ddd}) ${numberPart.slice(0, 5)}-${numberPart.slice(5)}`;
  } else if (clean.length === 10) {
    display = `(${ddd}) ${numberPart.slice(0, 4)}-${numberPart.slice(4)}`;
  }

  return {
    display,
    fullDigits: `55${clean}`,
    isMobile,
  };
}

// Verifica se um e-mail é de escritório de contabilidade (não comercial do mercado)
function isAccountantEmail(email: string): boolean {
  const norm = email.toLowerCase().trim();
  const accountantKeywords = [
    "contador",
    "contadora",
    "contabil",
    "escritorio",
    "fiscal",
    "assessoria",
    "despachante",
    "auditoria",
    "terceiriz",
  ];
  return accountantKeywords.some((keyword) => norm.includes(keyword));
}

export function extractCompanyContacts(company: Company): ContactItem[] {
  const contacts: ContactItem[] = [];
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const defaultDdd = getCityDdd(company.cidade);

  const persistedContacts = (company.contacts ?? [])
    .filter((contact) => contact.active)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  // Ordem de prioridade de telefones: contatos comerciais persistidos -> Google Places -> legado/manual -> Receita
  const rawPhones: { source: string; raw: string; whatsapp: boolean }[] = [
    ...persistedContacts
      .filter((contact) => contact.type === "PHONE" || contact.type === "WHATSAPP")
      .map((contact) => ({
        source: contact.source.toLowerCase(),
        raw: contact.value,
        whatsapp: contact.type === "WHATSAPP",
      })),
    { source: "google", raw: company.telefoneEncontrado ?? "", whatsapp: false },
    { source: "manual", raw: company.details?.telefone ?? "", whatsapp: false },
    { source: "receita", raw: company.telefone ?? "", whatsapp: false },
  ].filter((p) => p.raw && p.raw.trim().length >= 8);

  for (const item of rawPhones) {
    const parsed = formatPhoneDisplay(item.raw, defaultDdd);
    if (!seenPhones.has(parsed.display)) {
      seenPhones.add(parsed.display);
      contacts.push({
        id: `phone-${parsed.fullDigits}`,
        type: "phone",
        label: item.whatsapp || parsed.isMobile ? "WhatsApp comercial" : "Telefone comercial",
        value: parsed.display,
        raw: parsed.fullDigits,
        isMobile: parsed.isMobile,
        canWhatsapp: item.whatsapp || parsed.isMobile,
      });
    }
  }

  // E-mails: contatos comerciais persistidos -> legado/manual -> Receita
  const rawEmails: { source: string; raw: string }[] = [
    ...persistedContacts
      .filter((contact) => contact.type === "EMAIL")
      .map((contact) => ({ source: contact.source.toLowerCase(), raw: contact.value })),
    { source: "manual", raw: company.details?.email ?? "" },
    { source: "receita", raw: company.email ?? "" },
  ].filter((e) => e.raw && e.raw.trim().length > 4 && e.raw.includes("@"));

  for (const item of rawEmails) {
    const cleanE = item.raw.trim().toLowerCase();

    // Se for e-mail de contabilidade vindo do cadastro da Receita, ignora para não poluir o comercial
    if (item.source === "receita" && isAccountantEmail(cleanE)) {
      continue;
    }

    if (!seenEmails.has(cleanE)) {
      seenEmails.add(cleanE);
      contacts.push({
        id: `email-${cleanE}`,
        type: "email",
        label: "E-mail comercial",
        value: cleanE,
        raw: cleanE,
        isMobile: false,
        canWhatsapp: false,
      });
    }
  }

  return contacts;
}

async function copyContactValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error(`Não foi possível copiar ${label.toLowerCase()} neste navegador.`);
  }
}

interface LeadContactsPopoverProps {
  company: Company;
}

export function LeadContactsPopover({ company }: LeadContactsPopoverProps) {
  const contacts = extractCompanyContacts(company);
  const count = contacts.length;

  if (count === 0) {
    return <span className="text-xs font-semibold text-[#94A3B8]">Sem contatos</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-white px-2.5 py-1 text-xs font-semibold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF] cursor-pointer shadow-2xs"
          title="Ver contatos comerciais disponíveis"
        >
          <Phone className="h-3.5 w-3.5 text-[#1061AF]" />
          <span>{count === 1 ? "Contato" : `Contatos (${count})`}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
        className="w-72 rounded-lg border border-[#DDE5EF] bg-white p-3 shadow-lg text-[#0B1F33]"
      >
        <div className="border-b border-[#EEF2F7] pb-2 mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Contatos disponíveis
          </div>
          <div className="text-xs font-medium text-[#94A3B8] truncate">
            {company.nomeFantasia || company.razaoSocial}
          </div>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {contacts.map((contact) => {
            if (contact.type === "phone") {
              const waUrl = contact.canWhatsapp ? `https://wa.me/${contact.raw}` : null;
              return (
                <div
                  key={contact.id}
                  className="rounded-md bg-[#F8FAFC] p-2.5 border border-[#EEF2F7]"
                >
                  <div className="text-[10px] font-bold uppercase text-[#64748B] mb-0.5">
                    {contact.label}
                  </div>
                  <div className="font-mono text-xs font-bold text-[#0B1F33] mb-2">
                    {contact.value}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${contact.raw}`}
                      className="inline-flex h-7 items-center gap-1 rounded bg-[#0B1F33] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#1061AF]"
                    >
                      <PhoneCall className="h-3 w-3" />
                      Ligar
                    </a>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded bg-[#128C7E] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#075E54]"
                      >
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyContactValue("Telefone", contact.value)}
                      className="inline-flex h-7 items-center gap-1 rounded border border-[#DDE5EF] bg-white px-2.5 text-[11px] font-bold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF]"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={contact.id}
                className="rounded-md bg-[#F8FAFC] p-2.5 border border-[#EEF2F7]"
              >
                <div className="text-[10px] font-bold uppercase text-[#64748B] mb-0.5">
                  {contact.label}
                </div>
                <div
                  className="text-xs font-semibold text-[#0B1F33] truncate mb-2"
                  title={contact.value}
                >
                  {contact.value}
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`mailto:${contact.value}`}
                    className="inline-flex h-7 items-center gap-1 rounded bg-[#0B1F33] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#1061AF]"
                  >
                    <Mail className="h-3 w-3" />
                    Enviar e-mail
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyContactValue("E-mail", contact.value)}
                    className="inline-flex h-7 items-center gap-1 rounded border border-[#DDE5EF] bg-white px-2.5 text-[11px] font-bold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF]"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
