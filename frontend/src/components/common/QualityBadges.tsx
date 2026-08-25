/**
 * Quality badges distinguish cadastral completeness from externally verified locations.
 */

import { AlertTriangle, CheckCircle, MapPin } from "lucide-react";

type StatusVerificacaoProps = {
  status?: string | null;
  className?: string;
};

export function StatusVerificacaoBadge({ status, className = "" }: StatusVerificacaoProps) {
  switch (status) {
    case "confiavel_cadastralmente":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 ${className}`}
          title="Dados cadastrais completos para análise inicial. O endereço físico não foi verificado externamente."
        >
          <CheckCircle className="h-3 w-3" />
          Confiável Cadastralmente
        </span>
      );
    case "aproximado":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 ${className}`}
        >
          <MapPin className="h-3 w-3" />
          Aproximado
        </span>
      );
    case "verificado":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white ${className}`}
        >
          <CheckCircle className="h-3 w-3" />
          Verificado
        </span>
      );
    case "divergente":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 ${className}`}
        >
          <AlertTriangle className="h-3 w-3" />
          Divergente
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 ${className}`}
        >
          Não Verificado
        </span>
      );
  }
}

type ConfiancaBadgeProps = {
  confianca?: number | null;
  className?: string;
};

export function ConfiancaBadge({ confianca, className = "" }: ConfiancaBadgeProps) {
  if (confianca == null) return null;

  const color =
    confianca >= 80 ? "text-emerald-700" : confianca >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${color} ${className}`}
      title={`Confiança cadastral: ${confianca}/100`}
    >
      {confianca}
      <span className="font-normal text-gray-400">/100</span>
    </span>
  );
}

type PendenteBadgeProps = {
  pendente?: boolean;
  className?: string;
};

export function PendenteBadge({ pendente, className = "" }: PendenteBadgeProps) {
  if (!pendente) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 ${className}`}
    >
      <AlertTriangle className="h-3 w-3" />
      Pendente
    </span>
  );
}

type AvisoLocalizacaoAproximadaProps = {
  origemCoordenada?: string | null;
  className?: string;
};

export function AvisoLocalizacaoAproximada({
  origemCoordenada,
  className = "",
}: AvisoLocalizacaoAproximadaProps) {
  const isAprox = origemCoordenada?.includes("centroide") || origemCoordenada?.includes("jitter");
  if (!isAprox) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 ${className}`}
    >
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
      <p>
        <strong>Localização aproximada por município.</strong> A base da Receita Federal não fornece
        latitude e longitude exatas deste estabelecimento. O ponto exibido no mapa representa uma
        aproximação visual baseada no centroide do município.
      </p>
    </div>
  );
}
