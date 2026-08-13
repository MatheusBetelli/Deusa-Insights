import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { formatCnae, formatCnpj, potentialLabels, statusLabels } from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { mapService } from "@/services/mapService";
import type { LeadStatus } from "@/types/lead";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { AlertTriangle, FileUp, Filter, Layers, RotateCcw, MapPin, Loader2, Search, Navigation } from "lucide-react";

export const Route = createFileRoute("/_app/mapa-oportunidades")({
  validateSearch: (search) => ({
    uf: typeof search.uf === "string" ? search.uf : "Todos",
    city: typeof search.city === "string" ? search.city : "Todas",
  }),
  component: OpportunityMap,
});

const DEFAULT_CENTER: [number, number] = [-21.92, -50.73];
const DEFAULT_ZOOM = 12;

type CommercialCategory = "CLIENTE" | "CRITICO" | "PROSPECT";

function getCommercialCategory(item: MapOpportunity): CommercialCategory {
  if (item.status === "CONVERTED") return "CLIENTE";
  if (item.score >= 80 || item.potentialLevel === "CRITICAL") return "CRITICO";
  return "PROSPECT";
}

// Visual config para marcadores operacionais limpos
function makePinHtml(category: CommercialCategory, isAprox: boolean): string {
  let bg = "#1061AF"; // Navy institucional para Prospect
  let iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11a1 1 0 001 1h16a1 1 0 001-1V9"/></svg>`;

  if (category === "CLIENTE") {
    bg = "#16A34A"; // Verde para Cliente Ativo
    iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (category === "CRITICO") {
    bg = "#ED1C24"; // Vermelho para Oportunidade Crítica (Score >= 80)
    iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }

  const strokeDash = isAprox ? `stroke-dasharray="3,3"` : ``;

  return `<div style="
    position: relative;
    width: 30px;
    height: 38px;
    cursor: pointer;
  ">
    <svg width="30" height="38" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27 13.2 39 16.2 41.5C16.68 41.9 17.32 41.9 17.8 41.5C20.8 39 34 27 34 17C34 7.61116 26.3888 0 17 0Z" fill="${bg}" stroke="#FFFFFF" stroke-width="2" ${strokeDash}/>
      <circle cx="17" cy="16" r="10" fill="rgba(0, 0, 0, 0.16)"/>
    </svg>
    <div style="
      position: absolute;
      top: 8px;
      left: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
    ">
      ${iconSvg}
    </div>
  </div>`;
}

function OpportunityMap() {
  const routeSearch = Route.useSearch();
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null);
  const markerById = useRef<Map<string, L.Marker>>(new Map());

  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<MapOpportunity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUf, setSelectedUf] = useState(routeSearch.uf);
  const [selectedCity, setSelectedCity] = useState(routeSearch.city);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedPrecision, setSelectedPrecision] = useState("Todas");
  const [clustersOn, setClustersOn] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [optimizeMessage, setOptimizeMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  async function handleOptimizeLocations() {
    setIsOptimizing(true);
    setOptimizeMessage(null);
    try {
      const response = await mapService.optimizeLocations({
        limit: 50,
        dryRun: false,
      });
      if (response.error) throw new Error(response.message || "Erro desconhecido");

      setOptimizeMessage({
        text: response.message || "Otimização concluída.",
        type: "success",
      });

      // Reload map data
      await loadData();
    } catch (err) {
      setOptimizeMessage({
        text:
          (err instanceof Error ? err.message : null) ||
          "Falha ao otimizar localizações. Verifique se a API Key do Google Maps está configurada no backend.",
        type: "error",
      });
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleDiscoverMarkets() {
    const cidade = selectedCity !== "Todas" ? selectedCity : "";
    const uf = selectedUf !== "Todos" ? selectedUf : "";
    if (!cidade || !uf) {
      setOptimizeMessage({
        text: "Selecione um Estado (UF) e uma Cidade nos filtros antes de descobrir mercados.",
        type: "error",
      });
      return;
    }
    setIsDiscovering(true);
    setOptimizeMessage(null);
    try {
      const result = await mapService.discoverRegion(cidade, uf);
      setOptimizeMessage({
        text: result.message || `Descoberta concluída: ${result.discovered} novo(s), ${result.existing} já existente(s).`,
        type: result.success ? "success" : "error",
      });
      if (result.discovered > 0) await loadData();
    } catch (err) {
      setOptimizeMessage({
        text: (err instanceof Error ? err.message : null) || "Falha na descoberta de mercados.",
        type: "error",
      });
    } finally {
      setIsDiscovering(false);
    }
  }

  async function loadData() {
    setDataLoading(true);
    setDataError(null);
    try {
      setOpportunities(await mapService.getOpportunities());
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Erro ao carregar oportunidades.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedUf(routeSearch.uf);
    setSelectedCity(routeSearch.city);
  }, [routeSearch.uf, routeSearch.city]);

  const filtered = useMemo(
    () =>
      opportunities.filter((p) => {
        const ufOk = selectedUf === "Todos" || p.uf === selectedUf;
        const cityOk = selectedCity === "Todas" || p.city === selectedCity;
        const commCat = getCommercialCategory(p);
        const catOk =
          selectedCategory === "Todas" || commCat === selectedCategory;

        // Filtro de pesquisa por comércio, CNPJ ou endereço
        let searchOk = true;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const qClean = q.replace(/\D/g, "");
          const cnpjClean = p.cnpj ? p.cnpj.replace(/\D/g, "") : "";

          const matchName = p.companyName ? p.companyName.toLowerCase().includes(q) : false;
          const matchCnpj = qClean.length >= 3 && cnpjClean.includes(qClean);
          const matchLogradouro = p.logradouro ? p.logradouro.toLowerCase().includes(q) : false;
          const matchBairro = p.bairro ? p.bairro.toLowerCase().includes(q) : false;
          const matchCity = p.city ? p.city.toLowerCase().includes(q) : false;

          searchOk = matchName || matchCnpj || matchLogradouro || matchBairro || matchCity;
        }

        // Filtro de precisão
        let precOk = true;
        if (selectedPrecision !== "Todas") {
          const conf = p.confiancaVerificacao ?? 0;
          const isAprox = !!(p.origemCoordenada?.includes("centroide") || p.origemCoordenada?.includes("jitter"));
          if (selectedPrecision === "verificado") precOk = conf >= 90 && !isAprox;
          else if (selectedPrecision === "provavel") precOk = conf >= 60 && conf < 90 && !isAprox;
          else if (selectedPrecision === "aproximado") precOk = isAprox || conf < 60;
        }

        return ufOk && cityOk && catOk && precOk && searchOk;
      }),
    [opportunities, selectedUf, selectedCity, selectedCategory, selectedPrecision, searchQuery],
  );

  const withCoords = useMemo(
    () => filtered.filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number"),
    [filtered],
  );

  const withoutCoords = useMemo(
    () => filtered.filter((p) => typeof p.latitude !== "number" || typeof p.longitude !== "number"),
    [filtered],
  );

  // Initialize map once
  useEffect(() => {
    if (dataLoading) return;
    if (mapRef.current) return;
    if (!mapElRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const Leaflet = await import("leaflet");
        if (cancelled || !mapElRef.current) return;

        (window as any).L = Leaflet;

        const map = Leaflet.map(mapElRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          scrollWheelZoom: true,
          maxBounds: [
            [-90, -180],
            [90, 180],
          ],
          maxBoundsViscosity: 1.0,
        });

        Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          minZoom: 3,
          noWrap: true,
        }).addTo(map);

        mapRef.current = map;
        setMapStatus("ready");
      } catch {
        setMapStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Rebuild markers whenever data or cluster mode changes
  useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;

    const map = mapRef.current;

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    markerById.current.clear();

    if (withCoords.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    (async () => {
      const Leaflet = await import("leaflet");
      (window as any).L = Leaflet;

      let group: any;

      if (clustersOn) {
        try {
          await import("leaflet.markercluster");
          const MarkerClusterGroup = (Leaflet as any).markerClusterGroup || (window as any).L.markerClusterGroup;
          if (typeof MarkerClusterGroup === "function") {
            group = MarkerClusterGroup({
              maxClusterRadius: 30,
              spiderfyOnMaxZoom: true,
              showCoverageOnHover: false,
              zoomToBoundsOnClick: true,
              iconCreateFunction: (cluster: any) => {
                const n = cluster.getChildCount();
                const bg = "#0B1F33";
                const border = "#FFFFFF";
                const size = n >= 50 ? 44 : n >= 15 ? 40 : 36;

                return Leaflet.divIcon({
                  className: "",
                  html: `<div style="
                    width:${size}px;height:${size}px;border-radius:50%;
                    background:${bg};
                    border:2.5px solid ${border};
                    box-shadow:0 2px 8px rgba(0,0,0,0.25);
                    display:flex;align-items:center;justify-content:center;
                    font-weight:700;font-size:13px;
                    color:#FFFFFF;font-family:Inter,system-ui,sans-serif;
                  "><span>${n}</span></div>`,
                  iconSize: [size, size],
                  iconAnchor: [size / 2, size / 2],
                });
              },
            });
          } else {
            group = Leaflet.layerGroup();
          }
        } catch {
          group = Leaflet.layerGroup();
        }
      } else {
        group = Leaflet.layerGroup();
      }

      const boundPoints: [number, number][] = [];

      withCoords.forEach((point, idx) => {
        const commCat = getCommercialCategory(point);
        const isAprox = !!(
          point.origemCoordenada?.includes("centroide") ||
          point.origemCoordenada?.includes("jitter")
        );

        let lat = point.latitude!;
        let lng = point.longitude!;
        if (isAprox && withCoords.length > 1) {
          const angle = (idx * 137.5 * Math.PI) / 180;
          const radius = 0.0012 * Math.sqrt((idx % 12) + 1);
          lat += Math.sin(angle) * radius;
          lng += Math.cos(angle) * radius;
        }

        boundPoints.push([lat, lng]);

        const icon = Leaflet.divIcon({
          className: "",
          html: makePinHtml(commCat, isAprox),
          iconSize: [30, 38],
          iconAnchor: [15, 38],
          popupAnchor: [0, -34],
        });

        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        const isRealCnpj = /^\d{14}$/.test(point.cnpj.replace(/\D/g, "")) && !point.cnpj.startsWith("G-") && !point.cnpj.startsWith("GOOGLE-");
        const cnpjLine = isRealCnpj ? `${formatCnpj(point.cnpj)} · ` : "";
        const levelText = potentialLabels[point.potentialLevel as keyof typeof potentialLabels] || point.potentialLevel;
        const statusText = statusLabels[point.status as keyof typeof statusLabels] || point.status;
        const levelColor = point.score >= 80 ? "#ED1C24" : point.score >= 65 ? "#C2410C" : "#1061AF";

        const marker = Leaflet.marker([lat, lng], { icon }).bindPopup(
          `<div class="deusa-map-popup" style="font-family:Inter,system-ui,sans-serif;padding:2px;width:240px;">
             <div style="font-size:13px;font-weight:700;color:#0B1F33;line-height:1.2;">${point.companyName}</div>
             <div style="font-size:11px;color:#64748B;margin-top:2px;">${point.city}/${point.uf}</div>
             
             <div style="margin-top:8px;padding-top:6px;border-top:1px solid #E2E8F0;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
               <div><span style="color:#64748B;">CNAE:</span> <strong style="color:#0B1F33;">${formatCnae(point.cnaePrincipal)}</strong></div>
               <div><span style="color:#64748B;">Score:</span> <strong style="color:#0B1F33;">${point.score}/100</strong></div>
               <div><span style="color:#64748B;">Status:</span> <strong style="color:#0B1F33;">${statusText}</strong></div>
               <div><span style="color:#64748B;">Nível:</span> <strong style="color:${levelColor};">${levelText}</strong></div>
               <div style="grid-column:span 2;"><span style="color:#64748B;">Responsável:</span> <strong style="color:#0B1F33;">${point.responsibleName || "Não atribuído"}</strong></div>
             </div>

             <div style="margin-top:8px;padding-top:6px;border-top:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;gap:6px;">
               <a href="/leads-b2b/${point.id}" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:6px;background:#0B1F33;color:#FFFFFF;text-decoration:none;font-size:11px;font-weight:700;">
                 Abrir oportunidade →
               </a>
               <a href="${gmapsUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px;background:#F1F5F9;color:#0B1F33;text-decoration:none;font-size:11px;font-weight:600;">
                 Traçar rota
               </a>
             </div>
           </div>`,
          { maxWidth: 280, minWidth: 230 },
        );

        group.addLayer(marker);
        markerById.current.set(point.id, marker);
      });

      if (!mapRef.current) return;
      group.addTo(mapRef.current);
      clusterRef.current = group;

      const bounds = Leaflet.latLngBounds(boundPoints);
      if (bounds.isValid()) {
        if (withCoords.length === 1) mapRef.current.setView(bounds.getCenter(), 14);
        else mapRef.current.fitBounds(bounds.pad(0.12), { maxZoom: 14 });
      }
    })();
  }, [withCoords, mapStatus, clustersOn]);

  // --- counts ---
  const clienteCount = filtered.filter((p) => getCommercialCategory(p) === "CLIENTE").length;
  const criticaCount = filtered.filter((p) => getCommercialCategory(p) === "CRITICO").length;
  const prospectCount = filtered.filter((p) => getCommercialCategory(p) === "PROSPECT").length;
  const aproxCount = withCoords.filter(
    (p) => p.origemCoordenada?.includes("centroide") || p.origemCoordenada?.includes("jitter"),
  ).length;

  return (
    <div>
      <PageHeader
        title="Mapa"
        subtitle="Visualização operacional e inteligência territorial de oportunidades B2B."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscoverMarkets}
              disabled={isDiscovering}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-50"
              title="Selecione UF e Cidade nos filtros para descobrir mercados via Google Places"
            >
              {isDiscovering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1061AF]" />
              ) : (
                <Search className="h-3.5 w-3.5 text-[#1061AF]" />
              )}
              {isDiscovering ? "Descobrindo..." : "Descobrir Mercados"}
            </button>
            <button
              onClick={handleOptimizeLocations}
              disabled={isOptimizing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-50"
            >
              {isOptimizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1061AF]" />
              ) : (
                <MapPin className="h-3.5 w-3.5 text-[#1061AF]" />
              )}
              {isOptimizing ? "Otimizando..." : "Otimizar Localizações"}
            </button>
            <Link
              to="/importar-cnpjs"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-bold text-white transition hover:bg-[#1061AF]"
            >
              <FileUp className="h-3.5 w-3.5 text-[#FFF200]" />
              Importar CNPJs
            </Link>
          </div>
        }
      />

      {/* Error banner */}
      {dataError && (
        <div className="mb-4">
          <ErrorState
            description={dataError}
            action={
              <button
                onClick={loadData}
                className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
              >
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {/* Optimize message */}
      {optimizeMessage && (
        <div
          className={`mb-4 flex items-center justify-between rounded-lg border px-4 py-3 text-sm shadow-sm ${
            optimizeMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : optimizeMessage.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {optimizeMessage.type === "error" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            ) : (
              <MapPin
                className={`h-4 w-4 shrink-0 ${optimizeMessage.type === "success" ? "text-green-600" : "text-sky-600"}`}
              />
            )}
            <span>{optimizeMessage.text}</span>
          </div>
          <button
            onClick={() => setOptimizeMessage(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filters */}
      <section className="mb-4 rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Search className="h-3.5 w-3.5 text-[#1061AF]" />
              Pesquisar Comércio / Empresa
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nome do comércio, CNPJ, bairro..."
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#0B1F33] outline-none transition placeholder:text-[#94A3B8] focus:border-[#1061AF] focus:bg-white"
              />
            </div>
          </label>

          <label className="block min-w-[160px]">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Filter className="h-3.5 w-3.5" />
              Estado (UF)
            </span>
            <select
              value={selectedUf}
              onChange={(e) => {
                setSelectedUf(e.target.value);
                setSelectedCity("Todas");
              }}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option>Todos</option>
              {ESTADOS_UF.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </label>

          <label className="block min-w-[160px]">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
              Cidade
            </span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option>Todas</option>
              {Array.from(new Set(opportunities.filter((p) => selectedUf === "Todos" || p.uf === selectedUf).map((p) => p.city)))
                .filter(Boolean)
                .sort()
                .map((city) => (
                  <option key={city}>{city}</option>
                ))}
            </select>
          </label>

          <label className="block min-w-[170px]">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
              Categoria
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option value="Todas">Todas</option>
              <option value="CLIENTE">Cliente Ativo</option>
              <option value="CRITICO">Oportunidade Crítica (Score ≥ 80)</option>
              <option value="PROSPECT">Prospect Normal</option>
            </select>
          </label>

          <label className="block min-w-[160px]">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Navigation className="h-3.5 w-3.5" />
              Precisão
            </span>
            <select
              value={selectedPrecision}
              onChange={(e) => setSelectedPrecision(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option>Todas</option>
              <option value="verificado">🟢 Verificado (90-100%)</option>
              <option value="provavel">🟡 Provável (60-89%)</option>
              <option value="aproximado">🔴 Aproximado (centroide)</option>
            </select>
          </label>

          {/* Cluster toggle */}
          <div className="flex flex-col">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Layers className="h-3.5 w-3.5" />
              Agrupamento
            </span>
            <button
              onClick={() => setClustersOn((v) => !v)}
              className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${
                clustersOn
                  ? "border-[#1061AF] bg-[#1061AF] text-white"
                  : "border-[#DDE5EF] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
            >
              <Layers className="h-4 w-4" />
              {clustersOn ? "Clusters: ON" : "Clusters: OFF"}
            </button>
          </div>

          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedUf("Todos");
              setSelectedCity("Todas");
              setSelectedCategory("Todas");
              setSelectedPrecision("Todas");
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DDE5EF] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0B1F33]"
            title="Limpar filtros"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Summary counters */}
      {!dataLoading && opportunities.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {/* Cliente Ativo */}
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-sm shadow-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            <span className="font-semibold text-slate-700">Clientes Ativos:</span>
            <span className="font-extrabold text-[#16A34A] text-base">{clienteCount}</span>
          </div>
          {/* Oportunidades Críticas */}
          <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2 text-sm shadow-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ED1C24]" />
            <span className="font-semibold text-slate-700">Oportunidades Críticas:</span>
            <span className="font-extrabold text-[#ED1C24] text-base">{criticaCount}</span>
          </div>
          {/* Prospects Mapeados */}
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-2 text-sm shadow-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1061AF]" />
            <span className="font-semibold text-slate-700">Prospects Mapeados:</span>
            <span className="font-extrabold text-[#0B1F33] text-base">{prospectCount}</span>
          </div>
          {/* No mapa */}
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-xs">
            <MapPin className="h-4 w-4 text-[#1061AF]" />
            <span className="font-semibold text-slate-700">No mapa:</span>
            <span className="font-extrabold text-[#0B1F33] text-base">{withCoords.length}</span>
          </div>
        </div>
      )}

      {mapStatus === "error" && (
        <ErrorState
          title="Mapa indisponível"
          description="Não foi possível iniciar o mapa interativo neste navegador."
        />
      )}

      {dataLoading ? (
        <LoadingState message="Carregando oportunidades do mapa..." />
      ) : opportunities.length === 0 ? (
        <EmptyState
          title="Nenhuma oportunidade encontrada"
          description="Não há oportunidades cadastradas. Importe novos CNPJs."
        />
      ) : (
        <section className="w-full">
          {/* Map card */}
          <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
            {/* Header with legend */}
            <div className="flex flex-col gap-3 border-b border-[#DDE5EF] px-5 py-3 lg:flex-row lg:items-center lg:justify-between bg-[#F8FAFC]">
              <h2 className="text-sm font-bold text-[#0B1F33]">Oportunidades no mapa</h2>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                  Cliente Ativo
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-red-300/60 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                  <span className="h-2 w-2 rounded-full bg-[#ED1C24]" />
                  Oportunidade Crítica (Score ≥ 80)
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-slate-300/60 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-[#1061AF]" />
                  Prospect Normal
                </span>
              </div>
            </div>

            {/* Cluster hint */}
            {clustersOn && withCoords.length > 0 && (
              <div className="flex items-center gap-2 border-b border-[#DDE5EF] bg-[#F8FAFC] px-5 py-2.5 text-xs text-[#64748B]">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Agrupamento ativo — clique nos círculos ou dê zoom para ver os marcadores
                  individualmente.
                </span>
              </div>
            )}

            {/* Map container */}
            <div className="relative h-[680px] bg-[#E8EEF5]">
              <div ref={mapElRef} className="h-full w-full" />

              {mapStatus === "loading" && (
                <div className="absolute inset-0 z-[500] bg-white/70 p-6">
                  <LoadingState message="Carregando mapa..." />
                </div>
              )}
              {filtered.length === 0 && mapStatus === "ready" && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/90 p-6">
                  <EmptyState
                    title="Nenhuma oportunidade encontrada"
                    description="Sem oportunidades para os filtros selecionados."
                  />
                </div>
              )}
              {filtered.length > 0 && withCoords.length === 0 && mapStatus === "ready" && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 p-6">
                  <EmptyState
                    title="Sem coordenadas para exibir"
                    description="Os registros selecionados ainda não possuem latitude e longitude."
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Sem coords warning */}
      {withoutCoords.length > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#713F12]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#CA8A04]" />
          <span>
            {withoutCoords.length} oportunidade(s) sem latitude/longitude não aparecem no mapa.
          </span>
        </div>
      )}

      {/* Approx location banner */}
      {withCoords.length > 0 && aproxCount / withCoords.length > 0.8 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <strong>Localizações aproximadas:</strong> {aproxCount} de {withCoords.length} pontos
            representam aproximações baseadas no centroide do município. Pontos aproximados têm
            borda tracejada.
          </span>
        </div>
      )}
    </div>
  );
}
