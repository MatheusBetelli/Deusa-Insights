import { Edit3, ExternalLink, Globe } from "lucide-react";
import { EmptyState } from "@/components/app/InterfaceStates";
import type { PendingLocation } from "@/types/mapOpportunity";

export type PendingLocationsListProps = {
  pendingLocations: PendingLocation[];
  onOpenValidation: (item: PendingLocation) => void;
};

export function PendingLocationsList({
  pendingLocations,
  onOpenValidation,
}: PendingLocationsListProps) {
  return (
    <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0B1F33]">
            Pendências de Validação Comercial ({pendingLocations.length})
          </h2>
          <p className="text-xs text-[#64748B]">
            Pesquise a existência real do comércio no Google Maps ou realize validação em campo antes de confirmar o registro.
          </p>
        </div>
      </div>

      {pendingLocations.length === 0 ? (
        <EmptyState
          title="Nenhuma pendência encontrada"
          description="Todos os estabelecimentos filtrados possuem localização validada."
        />
      ) : (
        <div className="divide-y divide-[#EEF2F7]">
          {pendingLocations.map((item) => {
            const queryAddress = encodeURIComponent(
              `${item.nomeFantasia || item.razaoSocial} ${item.logradouro || ""} ${item.municipio} ${item.estado}`
            );
            const queryCnpj = encodeURIComponent(item.cnpj);
            const queryPhone = item.telefone ? encodeURIComponent(item.telefone) : "";

            const linkMapsAddress = `https://www.google.com/maps/search/?api=1&query=${queryAddress}`;
            const linkGoogleCnpj = `https://www.google.com/search?q=${queryCnpj}`;
            const linkMapsCnpj = `https://www.google.com/maps/search/?api=1&query=${queryCnpj}`;
            const linkGooglePhone = queryPhone ? `https://www.google.com/search?q=${queryPhone}` : null;

            return (
              <div key={item.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#0B1F33] text-sm">
                        {item.nomeFantasia || item.razaoSocial}
                      </span>
                      <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-xs font-semibold text-[#475569]">
                        {item.cnpjFormatado}
                      </span>
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {item.statusValidacao.toUpperCase()}
                      </span>
                    </div>
                    {item.nomeFantasia && <div className="text-xs text-[#64748B]">{item.razaoSocial}</div>}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#475569]">
                      <span>📍 {item.logradouro ? `${item.logradouro}, ${item.numero || "S/N"} - ${item.bairro}` : "Sem logradouro"} ({item.municipio}/{item.estado})</span>
                      {item.telefone && <span>📞 {item.telefone}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenValidation(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F33] px-4 py-2 text-xs font-bold text-white hover:bg-[#1061AF]"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#FFF200]" />
                    Validar Estabelecimento
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F8FAFC] p-2.5 border border-[#E2E8F0]">
                  <span className="text-[11px] font-bold text-[#64748B] mr-1 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-[#1061AF]" />
                    Pesquisa Digital Rápida:
                  </span>
                  <a href={linkMapsAddress} target="_blank" rel="noreferrer" className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B1F33] border border-[#DDE5EF] hover:bg-[#EEF2F7] flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 text-[#1061AF]" /> Maps Endereço
                  </a>
                  <a href={linkMapsCnpj} target="_blank" rel="noreferrer" className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B1F33] border border-[#DDE5EF] hover:bg-[#EEF2F7] flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 text-[#1061AF]" /> Maps CNPJ
                  </a>
                  <a href={linkGoogleCnpj} target="_blank" rel="noreferrer" className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B1F33] border border-[#DDE5EF] hover:bg-[#EEF2F7] flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 text-[#1061AF]" /> Google CNPJ
                  </a>
                  {linkGooglePhone && (
                    <a href={linkGooglePhone} target="_blank" rel="noreferrer" className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B1F33] border border-[#DDE5EF] hover:bg-[#EEF2F7] flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 text-[#1061AF]" /> Google Telefone
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
