import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/InterfaceStates";
import { formatCnpj } from "@/lib/commercial-formatters";
import { mapService } from "@/services/mapService";
import type { LeadStatus } from "@/types/lead";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { AlertTriangle, FileUp, Filter, Layers, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_app/mapa-oportunidades")({
  component: OpportunityMap,
});

const DEFAULT_CENTER: [number, number] = [-22.05, -50.18];
const DEFAULT_ZOOM = 9;

type ClientCategory = "CLIENTE" | "POTENCIAL" | "NAO_CLIENTE";

const clientCategoryLabels: Record<ClientCategory, string> = {
  CLIENTE: "Cliente",
  POTENCIAL: "Potencial Cliente",
  NAO_CLIENTE: "Não Cliente",
};

function getClientCategory(status: LeadStatus): ClientCategory {
  if (status === "CONVERTED") return "CLIENTE";
  if (status === "NOT_INTERESTED" || status === "INACTIVE") return "NAO_CLIENTE";
  return "POTENCIAL";
}

// Visual config per category — colors only, no complex SVGs
const CATEGORY_CONFIG: Record<
  ClientCategory,
  { bg: string; border: string; shadow: string }
> = {
  CLIENTE:     { bg: "#16A34A", border: "#86efac", shadow: "rgba(22,163,74,0.30)" },
  POTENCIAL:   { bg: "#D97706", border: "#fcd34d", shadow: "rgba(217,119,6,0.30)" },
  NAO_CLIENTE: { bg: "#DC2626", border: "#fca5a5", shadow: "rgba(220,38,38,0.30)" },
};

// Simple filled circle with a small white dot in the centre
function makePinHtml(category: ClientCategory, isAprox: boolean): string {
  const c = CATEGORY_CONFIG[category];
  const size = 22; // px — kept small to avoid pollution
  const half = size / 2;
  const outline = isAprox
    ? `outline:2px dashed ${c.border};outline-offset:2px;`
    : `box-shadow:0 2px 6px ${c.shadow},0 0 0 2px rgba(255,255,255,0.85);`;
  return `<div style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:${c.bg};
    ${outline}
    display:flex;align-items:center;justify-content:center;
  ">
    <div style="width:${Math.round(half * 0.45)}px;height:${Math.round(half * 0.45)}px;border-radius:50%;background:rgba(255,255,255,0.80);"></div>
  </div>`;
}

function OpportunityMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null);
  const markerById = useRef<Map<string, L.Marker>>(new Map());

  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<MapOpportunity[]>([]);
  const [selectedCity, setSelectedCity] = useState("Todas");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [clustersOn, setClustersOn] = useState(true);

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

  const filtered = useMemo(
    () =>
      opportunities.filter((p) => {
        const cityOk = selectedCity === "Todas" || p.city === selectedCity;
        const catOk = selectedCategory === "Todas" || getClientCategory(p.status) === selectedCategory;
        return cityOk && catOk;
      }),
    [opportunities, selectedCity, selectedCategory],
  );

  const withCoords = useMemo(
    () => filtered.filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number"),
    [filtered],
  );

  const withoutCoords = useMemo(
    () => filtered.filter((p) => typeof p.latitude !== "number" || typeof p.longitude !== "number"),
    [filtered],
  );

  const topLeads = useMemo(() => [...filtered].sort((a, b) => b.score - a.score).slice(0, 5), [filtered]);

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

        const map = Leaflet.map(mapElRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          scrollWheelZoom: true,
        });

        Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          minZoom: 3,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Remove old cluster/layer
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let group: any;

      if (clustersOn) {
        // Side-effect import extends Leaflet with markerClusterGroup
        await import("leaflet.markercluster");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        group = (Leaflet as any).markerClusterGroup({
          maxClusterRadius: 60,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          iconCreateFunction: (cluster: any) => {
            const n = cluster.getChildCount();
            const size = n >= 100 ? 48 : n >= 30 ? 40 : 32;
            const fs = n >= 100 ? 11 : 13;
            return Leaflet.divIcon({
              className: "",
              html: `<div style="
                width:${size}px;height:${size}px;border-radius:50%;
                background:#334155;
                border:2.5px solid #fff;
                box-shadow:0 2px 8px rgba(0,0,0,0.22);
                display:flex;align-items:center;justify-content:center;
                font-weight:700;font-size:${fs}px;
                color:#fff;font-family:Inter,system-ui,sans-serif;
                letter-spacing:-0.3px;
              ">${n}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });
          },
        });
      } else {
        group = Leaflet.layerGroup();
      }

      withCoords.forEach((point) => {
        const cat = getClientCategory(point.status);
        const isAprox = !!(
          point.origemCoordenada?.includes("centroide") ||
          point.origemCoordenada?.includes("jitter")
        );

        const icon = Leaflet.divIcon({
          className: "",
          html: makePinHtml(cat, isAprox),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -14],
        });

        const aproxBanner = isAprox
          ? `<div style="margin-top:8px;padding:6px 8px;background:#e0f2fe;border-radius:6px;font-size:11px;color:#0369a1;display:flex;gap:6px;">
               <span>📍</span>
               <span>Localização aproximada por município. A Receita Federal não fornece o endereço exato.</span>
             </div>`
          : "";

        const marker = Leaflet.marker([point.latitude!, point.longitude!], { icon }).bindPopup(
          `<div class="deusa-map-popup">
             <strong>${point.companyName}</strong>
             <span>${formatCnpj(point.cnpj)} · ${point.city}/${point.uf}</span>
             <dl>
               <div><dt>Bairro</dt><dd>${point.bairro ?? "–"}</dd></div>
               <div><dt>Score</dt><dd>${point.score}</dd></div>
               <div><dt>Categoria</dt><dd>${clientCategoryLabels[cat]}</dd></div>
             </dl>
             ${aproxBanner}
           </div>`,
          { maxWidth: 300, minWidth: 220 },
        );

        group.addLayer(marker);
        markerById.current.set(point.id, marker);
      });

      if (!mapRef.current) return; // guard: may have unmounted
      group.addTo(mapRef.current);
      clusterRef.current = group;

      const bounds = Leaflet.latLngBounds(withCoords.map((p) => [p.latitude!, p.longitude!]));
      if (bounds.isValid()) {
        if (withCoords.length === 1) mapRef.current.setView(bounds.getCenter(), 13);
        else mapRef.current.fitBounds(bounds.pad(0.22), { maxZoom: 11 });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withCoords, mapStatus, clustersOn]);

  // --- counts ---
  const clienteCount = filtered.filter((p) => getClientCategory(p.status) === "CLIENTE").length;
  const potencialCount = filtered.filter((p) => getClientCategory(p.status) === "POTENCIAL").length;
  const naoClienteCount = filtered.filter((p) => getClientCategory(p.status) === "NAO_CLIENTE").length;
  const aproxCount = withCoords.filter(
    (p) => p.origemCoordenada?.includes("centroide") || p.origemCoordenada?.includes("jitter"),
  ).length;

  return (
    <div>
      <PageHeader
        title="Mapa"
        subtitle="Veja onde estão as oportunidades comerciais com coordenadas válidas."
        actions={
          <Link
            to="/importar-cnpjs"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF]"
          >
            <FileUp className="h-4 w-4 text-[#FFF200]" />
            Importar CNPJs
          </Link>
        }
      />

      {/* Error banner */}
      {dataError && (
        <div className="mb-4">
          <ErrorState
            description={dataError}
            action={
              <button onClick={loadData} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {/* Filters */}
      <section className="mb-4 rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[180px]">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Filter className="h-3.5 w-3.5" />
              Cidade
            </span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option>Todas</option>
              {Array.from(new Set(opportunities.map((p) => p.city)))
                .sort()
                .map((city) => (
                  <option key={city}>{city}</option>
                ))}
            </select>
          </label>

          <label className="block min-w-[180px]">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Categoria</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option>Todas</option>
              <option value="CLIENTE">Cliente</option>
              <option value="POTENCIAL">Potencial Cliente</option>
              <option value="NAO_CLIENTE">Não Cliente</option>
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
              setSelectedCity("Todas");
              setSelectedCategory("Todas");
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
          {/* Cliente */}
          <div className="flex items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 py-2 text-sm shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16A34A]">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </span>
            <span className="font-semibold text-[#0B1F33]">Clientes:</span>
            <span className="font-bold text-[#16A34A]">{clienteCount}</span>
          </div>
          {/* Potencial */}
          <div className="flex items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 py-2 text-sm shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D97706]">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </span>
            <span className="font-semibold text-[#0B1F33]">Potenciais:</span>
            <span className="font-bold text-[#D97706]">{potencialCount}</span>
          </div>
          {/* Não cliente */}
          <div className="flex items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 py-2 text-sm shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626]">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </span>
            <span className="font-semibold text-[#0B1F33]">Não clientes:</span>
            <span className="font-bold text-[#DC2626]">{naoClienteCount}</span>
          </div>
          {/* No mapa */}
          <div className="flex items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 py-2 text-sm shadow-sm">
            <span className="font-semibold text-[#0B1F33]">📍 No mapa:</span>
            <span className="font-bold text-[#1061AF]">{withCoords.length}</span>
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
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Map card */}
          <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
            {/* Header with legend */}
            <div className="flex flex-col gap-3 border-b border-[#DDE5EF] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-bold text-[#0B1F33]">Oportunidades no mapa</h2>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#16A34A]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  Cliente
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-bold text-[#D97706]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                  Potencial
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-bold text-[#DC2626]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Não cliente
                </span>
              </div>
            </div>

            {/* Cluster hint */}
            {clustersOn && withCoords.length > 0 && (
              <div className="flex items-center gap-2 border-b border-[#DDE5EF] bg-[#F8FAFC] px-5 py-2.5 text-xs text-[#64748B]">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>Agrupamento ativo — clique nos círculos ou dê zoom para ver os marcadores individualmente.</span>
              </div>
            )}

            {/* Map container */}
            <div className="relative h-[620px] bg-[#E8EEF5]">
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

          {/* Top leads sidebar */}
          <aside className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-[#0B1F33]">Top oportunidades</h2>
            {topLeads.length === 0 ? (
              <p className="mt-4 text-sm text-[#64748B]">Nenhuma oportunidade para listar.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {topLeads.map((point) => {
                  const cat = getClientCategory(point.status);
                  const c = CATEGORY_CONFIG[cat];
                  const canFly = typeof point.latitude === "number";
                  return (
                    <div
                      key={point.id}
                      className={`rounded-lg border border-[#EEF2F7] p-3 transition-colors ${canFly ? "cursor-pointer hover:border-[#1061AF]" : ""}`}
                      onClick={() => {
                        if (canFly) {
                          mapRef.current?.flyTo([point.latitude!, point.longitude!], 15);
                          setTimeout(() => markerById.current.get(point.id)?.openPopup(), 800);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: c.bg }}
                          />
                          <div>
                            <div className="font-bold leading-snug text-[#0B1F33]">{point.companyName}</div>
                            <div className="mt-0.5 text-xs text-[#64748B]">{point.city}/{point.uf}</div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-[#1061AF]/10 px-2 py-1 text-xs font-bold text-[#0F58A0]">
                          {point.score}
                        </span>
                      </div>
                      <div className="mt-2 text-xs font-bold" style={{ color: c.bg }}>
                        {clientCategoryLabels[cat]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </section>
      )}

      {/* Sem coords warning */}
      {withoutCoords.length > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#713F12]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#CA8A04]" />
          <span>{withoutCoords.length} oportunidade(s) sem latitude/longitude não aparecem no mapa.</span>
        </div>
      )}

      {/* Approx location banner */}
      {withCoords.length > 0 && aproxCount / withCoords.length > 0.8 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <strong>Localizações aproximadas:</strong> {aproxCount} de {withCoords.length} pontos representam
            aproximações baseadas no centroide do município. Pontos aproximados têm borda tracejada.
          </span>
        </div>
      )}
    </div>
  );
}
