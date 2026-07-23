import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Building2, Check, ExternalLink, Globe, MapPin, X } from "lucide-react";
import type { MapOpportunity, PendingLocation, ValidateLocationPayload } from "@/types/mapOpportunity";

const DEFAULT_CENTER: [number, number] = [-22.05, -50.18];

export type LocationValidationModalProps = {
  item: PendingLocation | MapOpportunity;
  onClose: () => void;
  onSave: (id: string, payload: ValidateLocationPayload) => Promise<void>;
};

export function LocationValidationModal({
  item,
  onClose,
  onSave,
}: LocationValidationModalProps) {
  const miniMapRef = useRef<L.Map | null>(null);
  const miniMapElRef = useRef<HTMLDivElement | null>(null);
  const miniMapMarkerRef = useRef<L.Marker | null>(null);

  const isAlreadyConfirmed = item.statusValidacao === "confirmado";

  const [valLat, setValLat] = useState<number | "">(isAlreadyConfirmed ? item.latitude || "" : "");
  const [valLng, setValLng] = useState<number | "">(isAlreadyConfirmed ? item.longitude || "" : "");
  const [valStatus, setValStatus] = useState<string>(isAlreadyConfirmed ? "confirmado" : "aguardando_validacao");
  const [valOrigem, setValOrigem] = useState<string>("validacao_manual_com_evidencia");
  const [valFonte, setValFonte] = useState<string>("Google Maps");
  const [valUrl, setValUrl] = useState<string>(item.urlEvidencia || "");
  const [valPlaceId, setValPlaceId] = useState<string>(item.placeId || "");
  const [valNomeEnc, setValNomeEnc] = useState<string>(isAlreadyConfirmed ? item.nomeEncontrado || "" : "");
  const [valEndEnc, setValEndEnc] = useState<string>(isAlreadyConfirmed ? item.enderecoEncontrado || "" : "");
  const [valTelEnc, setValTelEnc] = useState<string>(isAlreadyConfirmed ? item.telefoneEncontrado || "" : "");
  const [valCatEnc, setValCatEnc] = useState<string>(isAlreadyConfirmed ? item.categoriaEncontrada || "" : "");
  const [valSitAparente, setValSitAparente] = useState<string>(item.situacaoAparente || "em_funcionamento");
  const [valJustificativa, setValJustificativa] = useState<string>(item.justificativaDecisao || "");
  const [valRespVisita, setValRespVisita] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar mini-mapa
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!miniMapElRef.current) return;
      const Leaflet = await import("leaflet");

      const initLat = typeof valLat === "number" ? valLat : DEFAULT_CENTER[0];
      const initLng = typeof valLng === "number" ? valLng : DEFAULT_CENTER[1];

      const miniMap = Leaflet.map(miniMapElRef.current, {
        center: [initLat, initLng],
        zoom: typeof valLat === "number" ? 15 : 10,
      });

      Leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(miniMap);

      const marker = Leaflet.marker([initLat, initLng], { draggable: true }).addTo(miniMap);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setValLat(Number(pos.lat.toFixed(6)));
        setValLng(Number(pos.lng.toFixed(6)));
      });

      miniMap.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setValLat(Number(e.latlng.lat.toFixed(6)));
        setValLng(Number(e.latlng.lng.toFixed(6)));
      });

      miniMapRef.current = miniMap;
      miniMapMarkerRef.current = marker;
    }, 150);

    return () => {
      clearTimeout(timer);
      miniMapRef.current?.remove();
      miniMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      miniMapRef.current &&
      miniMapMarkerRef.current &&
      typeof valLat === "number" &&
      typeof valLng === "number"
    ) {
      miniMapMarkerRef.current.setLatLng([valLat, valLng]);
      miniMapRef.current.setView([valLat, valLng], 15);
    }
  }, [valLat, valLng]);

  // Links de Pesquisa Rápida (Sem chamadas a APIs pagas)
  const qNomeEnd = encodeURIComponent(`${item.nomeFantasia || item.razaoSocial} ${item.logradouro || ""} ${item.municipio}`);
  const qCnpj = encodeURIComponent(item.cnpj);
  const qRazaoMuni = encodeURIComponent(`${item.razaoSocial} ${item.municipio}`);
  const qTel = item.telefone ? encodeURIComponent(item.telefone) : null;
  const qEndCompl = encodeURIComponent(`${item.logradouro || ""} ${item.numero || ""} ${item.bairro || ""} ${item.municipio} ${item.estado}`);
  const qMapsNome = encodeURIComponent(`${item.nomeFantasia || item.razaoSocial} ${item.municipio}`);

  const linkNomeEnd = `https://www.google.com/search?q=${qNomeEnd}`;
  const linkCnpj = `https://www.google.com/search?q=${qCnpj}`;
  const linkRazaoMuni = `https://www.google.com/search?q=${qRazaoMuni}`;
  const linkTel = qTel ? `https://www.google.com/search?q=${qTel}` : null;
  const linkEndCompl = `https://www.google.com/maps/search/?api=1&query=${qEndCompl}`;
  const linkMapsNome = `https://www.google.com/maps/search/?api=1&query=${qMapsNome}`;

  async function handleSave() {
    if (valStatus === "confirmado") {
      if (!valUrl.trim()) {
        alert("Para classificar como CONFIRMADO, é obrigatório colar a URL da evidência digital (link compartilhável do Google Maps).");
        return;
      }
      if (!valNomeEnc.trim()) {
        alert("Informe o nome do estabelecimento comercial encontrado.");
        return;
      }
      if (!valEndEnc.trim()) {
        alert("Informe o endereço físico do estabelecimento comercial encontrado.");
        return;
      }
      if (!valCatEnc.trim()) {
        alert("Informe a categoria comercial do estabelecimento encontrado.");
        return;
      }
      if (typeof valLat !== "number" || typeof valLng !== "number" || valLat === 0 || valLng === 0) {
        alert("Informe a latitude e longitude exatas e numéricas do estabelecimento.");
        return;
      }
      if (valLat < -90 || valLat > 90 || valLng < -180 || valLng > 180) {
        alert("Coordenadas inválidas. A latitude deve estar entre -90 e 90, e a longitude entre -180 e 180.");
        return;
      }
      if (!valJustificativa.trim()) {
        alert("A justificativa específica da decisão é obrigatória.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(item.id, {
        latitude: typeof valLat === "number" ? valLat : undefined,
        longitude: typeof valLng === "number" ? valLng : undefined,
        statusValidacao: valStatus,
        origemCoordenada: valOrigem,
        fonteConsultada: valFonte,
        urlEvidencia: valUrl,
        placeId: valPlaceId,
        nomeEncontrado: valNomeEnc,
        enderecoEncontrado: valEndEnc,
        telefoneEncontrado: valTelEnc,
        categoriaEncontrada: valCatEnc,
        situacaoAparente: valSitAparente,
        justificativaDecisao: valJustificativa,
        nomeResponsavelVisita: valRespVisita,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar validação comercial.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#0B1F33]">
                Validação Manual do Estabelecimento Comercial
              </h3>
            </div>
            <p className="text-xs text-[#64748B]">
              CNPJ: {item.cnpjFormatado} · <strong>Razão Social:</strong> {item.razaoSocial}
              {item.nomeFantasia && ` (Fantasia: ${item.nomeFantasia})`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Aviso de Divergência de Endereço */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Alerta de Divergência de Endereço</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900">
            <strong>Endereço cadastral atual:</strong> Rua Brasil, 780, Vila Espanha, Tupã/SP, CEP 17607-090.<br />
            <strong>Possível endereço encontrado em fonte externa:</strong> Rua Brasil, 665, bairro Barcelona, Tupã/SP.
          </p>
          <div className="font-bold text-amber-800 pt-1">
            “Foi encontrada possível divergência de endereço. Confira se o estabelecimento mudou de local antes de confirmar.”
          </div>
        </div>

        {/* 1. Links de Pesquisa Rápida (Sem Custos) */}
        <div className="rounded-xl border border-[#1061AF]/30 bg-[#F0F7FF] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#1061AF]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F58A0]">
              1. Links de Pesquisa Manual Externa (Abrem em nova guia)
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href={linkNomeEnd} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#DDE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F33] hover:bg-[#EEF2F7]">
              <ExternalLink className="h-3.5 w-3.5 text-[#1061AF]" /> 1. Nome + Endereço
            </a>
            <a href={linkCnpj} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#DDE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F33] hover:bg-[#EEF2F7]">
              <ExternalLink className="h-3.5 w-3.5 text-[#1061AF]" /> 2. CNPJ
            </a>
            <a href={linkRazaoMuni} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#DDE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F33] hover:bg-[#EEF2F7]">
              <ExternalLink className="h-3.5 w-3.5 text-[#1061AF]" /> 3. Razão Social + Município
            </a>
            {linkTel && (
              <a href={linkTel} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#DDE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F33] hover:bg-[#EEF2F7]">
                <ExternalLink className="h-3.5 w-3.5 text-[#1061AF]" /> 4. Telefone
              </a>
            )}
            <a href={linkEndCompl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#DDE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F33] hover:bg-[#EEF2F7]">
              <ExternalLink className="h-3.5 w-3.5 text-[#1061AF]" /> 5. Endereço Completo
            </a>
            <a href={linkMapsNome} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#DDE5EF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F33] hover:bg-[#EEF2F7]">
              <ExternalLink className="h-3.5 w-3.5 text-[#1061AF]" /> 6. Nome + Google Maps
            </a>
          </div>
        </div>

        {/* 2. Formulário de Registro de Evidências */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F33]">
            2. Evidências do Estabelecimento Localizado
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#475569]">Fonte Consultada *</label>
              <input
                type="text"
                value={valFonte}
                onChange={(e) => setValFonte(e.target.value)}
                placeholder="Ex: Google Maps / Street View"
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569]">Origem da Validação *</label>
              <select
                value={valOrigem}
                onChange={(e) => setValOrigem(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold"
              >
                <option value="validacao_manual_com_evidencia">📍 Validação Manual com Evidência (Link Google Maps)</option>
                <option value="google_maps">Google Maps / Busca Digital</option>
                <option value="site_oficial">Site Oficial do Comércio</option>
                <option value="rede_social_oficial">Rede Social Oficial (Instagram/Facebook)</option>
                <option value="validacao_em_campo">📍 Validação em Campo (Visita Presencial)</option>
                <option value="coordenada_manual">❌ Coordenada Manual Sem Evidência (Apenas Provável)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#475569]">URL da Evidência Digital (Link Compartilhável do Google Maps) *</label>
            <input
              type="text"
              value={valUrl}
              onChange={(e) => setValUrl(e.target.value)}
              placeholder="https://www.google.com/maps/place/..."
              className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#475569]">Nome Encontrado no Local *</label>
              <input
                type="text"
                value={valNomeEnc}
                onChange={(e) => setValNomeEnc(e.target.value)}
                placeholder="Nome na fachada ou no mapa"
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569]">Endereço Encontrado no Local *</label>
              <input
                type="text"
                value={valEndEnc}
                onChange={(e) => setValEndEnc(e.target.value)}
                placeholder="Endereço físico localizado"
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#475569]">Categoria Comercial *</label>
              <input
                type="text"
                value={valCatEnc}
                onChange={(e) => setValCatEnc(e.target.value)}
                placeholder="Ex: Mercearia, Minimercado..."
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569]">Telefone Encontrado</label>
              <input
                type="text"
                value={valTelEnc}
                onChange={(e) => setValTelEnc(e.target.value)}
                placeholder="(14) 3496-0000"
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569]">Situação Aparente *</label>
              <select
                value={valSitAparente}
                onChange={(e) => setValSitAparente(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs"
              >
                <option value="em_funcionamento">Em Funcionamento</option>
                <option value="fechado">Fechado Definitivamente</option>
                <option value="residencia">Residência / Terreno</option>
                <option value="nao_identificado">Não Identificado</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Coordenadas Geográficas & Mini Mapa */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#475569]">
              3. Coordenadas Geográficas (Latitude e Longitude):
            </label>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Aviso Importante:</strong> A coordenada deve ser copiada ou conferida com uma fonte externa. Selecionar um ponto no mapa não comprova a existência do estabelecimento.
            </span>
          </div>

          <div className="relative h-44 w-full rounded-xl border border-[#DDE5EF] bg-[#F8FAFC]">
            <div ref={miniMapElRef} className="h-full w-full rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-[#475569]">Latitude Exata *</label>
              <input
                type="number"
                step="any"
                value={valLat}
                onChange={(e) => setValLat(e.target.value ? Number(e.target.value) : "")}
                placeholder="-21.9412"
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] px-3 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#475569]">Longitude Exata *</label>
              <input
                type="number"
                step="any"
                value={valLng}
                onChange={(e) => setValLng(e.target.value ? Number(e.target.value) : "")}
                placeholder="-50.5195"
                className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] px-3 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* 4. Decisão e Justificativa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-[#EEF2F7] pt-3">
          <div>
            <label className="block text-xs font-bold text-[#475569]">Classificação da Decisão *</label>
            <select
              value={valStatus}
              onChange={(e) => setValStatus(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#DDE5EF] px-3 text-xs font-bold"
            >
              <option value="confirmado">✅ CONFIRMADO (Comércio Identificado & Comprovado)</option>
              <option value="provavel">⚠️ PROVÁVEL (Comércio no Local, CNPJ a Confirmar)</option>
              <option value="nao_encontrado">❓ NÃO ENCONTRADO (Nenhum Comércio no Local)</option>
              <option value="resultado_incompativel">🚫 RESULTADO INCOMPATÍVEL (Residência/Outro Ramo)</option>
              <option value="fechado">🔒 FECHADO DEFINITIVAMENTE</option>
              <option value="revisao_manual">🔍 REVISÃO MANUAL NECESSÁRIA</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#475569]">Justificativa Específica da Decisão *</label>
            <input
              type="text"
              value={valJustificativa}
              onChange={(e) => setValJustificativa(e.target.value)}
              placeholder="Ex: Estabelecimento comercial localizado no Google Maps com foto de fachada."
              className="mt-1 h-10 w-full rounded-lg border border-[#DDE5EF] px-3 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F7] pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#DDE5EF] px-4 py-2 text-xs font-bold text-[#64748B] hover:bg-[#F8FAFC]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F33] px-5 py-2 text-xs font-bold text-white hover:bg-[#1061AF] disabled:opacity-50"
          >
            <Check className="h-4 w-4 text-[#FFF200]" />
            {isSubmitting ? "Salvando..." : "Salvar Validação Comercial"}
          </button>
        </div>
      </div>
    </div>
  );
}
