import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/InterfaceStates";
import { formatCnpj } from "@/lib/commercial-formatters";
import { mapService } from "@/services/mapService";
import type { LeadStatus } from "@/types/lead";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { AlertTriangle, FileUp, Filter, RotateCcw } from "lucide-react";

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

function categoryClass(category: ClientCategory) {
  if (category === "CLIENTE") return "bg-[#22C55E] text-white";
  if (category === "POTENCIAL") return "bg-[#F59E0B] text-[#0B1F33]";
  return "bg-[#EF4444] text-white";
}

function markerColor(status: LeadStatus) {
  const category = getClientCategory(status);
  if (category === "CLIENTE") return "#22C55E";
  if (category === "POTENCIAL") return "#F59E0B";
  return "#EF4444";
}

function OpportunityMap() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, Leaflet.Marker>>(new Map());

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<MapOpportunity[]>([]);
  const [selectedCity, setSelectedCity] = useState("Todas");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  async function loadOpportunities() {
    setDataLoading(true);
    setDataError(null);
    try {
      setOpportunities(await mapService.getOpportunities());
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Não foi possível carregar oportunidades do mapa.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadOpportunities();
  }, []);

  const filteredPoints = useMemo(() => {
    return opportunities.filter((point) => {
      const matchCity = selectedCity === "Todas" || point.city === selectedCity;
      const matchCategory = selectedCategory === "Todas" || getClientCategory(point.status) === selectedCategory;
      return matchCity && matchCategory;
    });
  }, [opportunities, selectedCity, selectedCategory]);

  const pointsWithCoordinates = useMemo(
    () => filteredPoints.filter((point) => typeof point.latitude === "number" && typeof point.longitude === "number"),
    [filteredPoints],
  );
  const pointsWithoutCoordinates = useMemo(
    () => filteredPoints.filter((point) => typeof point.latitude !== "number" || typeof point.longitude !== "number"),
    [filteredPoints],
  );
  const topOpportunities = [...filteredPoints].sort((a, b) => b.score - a.score).slice(0, 5);

  useEffect(() => {
    let mounted = true;

    async function initializeMap() {
      try {
        if (!mapElementRef.current || mapRef.current) return;
        const L = await import("leaflet");
        if (!mounted || !mapElementRef.current) return;

        leafletRef.current = L;
        const map = L.map(mapElementRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          scrollWheelZoom: true,
          maxBounds: [
            [-90, -180],
            [90, 180]
          ],
          maxBoundsViscosity: 1.0,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
          minZoom: 3,
          noWrap: true,
        }).addTo(map);

        markerLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setStatus("ready");
      } catch (error) {
        console.error("Map initialization error:", error);
        setStatus("error");
      }
    }

    initializeMap();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [dataLoading]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!L || !map || !markerLayer || status !== "ready") return;

    markerLayer.clearLayers();
    markerMapRef.current.clear();

    pointsWithCoordinates.forEach((point) => {
      const category = getClientCategory(point.status);
      const color = markerColor(point.status);
      const isAprox = point.origemCoordenada?.includes("centroide") || point.origemCoordenada?.includes("jitter");

      // Ícone diferenciado para pontos com localização aproximada (borda tracejada)
      const borderStyle = isAprox
        ? `border: 2.5px dashed ${color === "#F59E0B" ? "#0B1F33" : "#ffffff"}; opacity: 0.85;`
        : `border-color:${color === "#F59E0B" ? "#0B1F33" : "#ffffff"};`;

      const icon = L.divIcon({
        className: "deusa-score-marker",
        html: `<span style="background:${color}; ${borderStyle}">${point.score}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -14],
      });

      // Aviso de localização aproximada no popup (somente quando centroide/jitter)
      const avisoLocalizacao = isAprox
        ? `<div style="margin-top:8px;padding:6px 8px;background:#e0f2fe;border-radius:6px;font-size:11px;color:#0369a1;display:flex;align-items:flex-start;gap:4px;">
            <span style="font-size:13px;">📍</span>
            <span>Localização aproximada por município.<br>A Receita Federal não fornece o endereço exato deste estabelecimento.</span>
           </div>`
        : "";

      const marker = L.marker([point.latitude!, point.longitude!], { icon })
        .bindPopup(
          `<div class="deusa-map-popup"><strong>${point.companyName}</strong><span>${formatCnpj(point.cnpj)} · ${point.city}/${point.uf}</span><dl><div><dt>Bairro</dt><dd>${point.bairro ?? "-"}</dd></div><div><dt>Score</dt><dd>${point.score}</dd></div><div><dt>Categoria</dt><dd>${clientCategoryLabels[category]}</dd></div></dl>${avisoLocalizacao}</div>`,
          { maxWidth: 300, minWidth: 220 },
        )
        .addTo(markerLayer);

      markerMapRef.current.set(point.id, marker);
    });

    if (pointsWithCoordinates.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(pointsWithCoordinates.map((point) => [point.latitude!, point.longitude!]));
    if (bounds.isValid()) {
      if (pointsWithCoordinates.length === 1) map.setView(bounds.getCenter(), 12);
      else map.fitBounds(bounds.pad(0.22), { maxZoom: 11 });
    }
  }, [pointsWithCoordinates, status]);

  return (
    <div>
      <PageHeader
        title="Mapa"
        subtitle="Veja onde estão as oportunidades comerciais com coordenadas válidas."
        actions={
          <Link to="/importar-cnpjs" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF]">
            <FileUp className="h-4 w-4 text-[#FFF200]" />
            Importar CNPJs
          </Link>
        }
      />

      {dataError && (
        <div className="mb-4">
          <ErrorState description={dataError} action={<button onClick={loadOpportunities} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">Tentar novamente</button>} />
        </div>
      )}

      <section className="mb-4 rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[180px]">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Filter className="h-3.5 w-3.5" />
              Cidade
            </span>
            <select value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
              <option>Todas</option>
              {Array.from(new Set(opportunities.map((point) => point.city))).sort().map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label className="block min-w-[180px]">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Categoria</span>
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
              <option>Todas</option>
              <option value="CLIENTE">Cliente</option>
              <option value="POTENCIAL">Potencial Cliente</option>
              <option value="NAO_CLIENTE">Não Cliente</option>
            </select>
          </label>
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

      {status === "error" && <ErrorState title="Mapa indisponível" description="A tela continua estável, mas não foi possível iniciar o mapa interativo neste navegador." />}

      {dataLoading ? (
        <LoadingState message="Carregando oportunidades do mapa..." />
      ) : opportunities.length === 0 ? (
        <EmptyState title="Nenhuma oportunidade encontrada" description="Não há oportunidades cadastradas. Importe novos CNPJs." />
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#DDE5EF] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-bold text-[#0B1F33]">Oportunidades no mapa</h2>
              <div className="flex flex-wrap gap-2">
                {(["CLIENTE", "POTENCIAL", "NAO_CLIENTE"] as ClientCategory[]).map((category) => (
                  <span key={category} className={`rounded-full px-3 py-1 text-xs font-bold ${categoryClass(category)}`}>
                    {clientCategoryLabels[category]}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative h-[620px] bg-[#E8EEF5]">
              <div ref={mapElementRef} className="h-full w-full" />
              {status === "loading" && (
                <div className="absolute inset-0 z-[500] bg-white/70 p-6">
                  <LoadingState message="Carregando mapa..." />
                </div>
              )}
              {filteredPoints.length === 0 && status === "ready" && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/90 p-6">
                  <EmptyState title="Nenhuma oportunidade encontrada" description="Não há oportunidades para os filtros selecionados. Limpe os filtros ou importe novos CNPJs." />
                </div>
              )}
              {filteredPoints.length > 0 && pointsWithCoordinates.length === 0 && status === "ready" && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 p-6">
                  <EmptyState title="Sem coordenadas para exibir" description="Os registros selecionados ainda não possuem latitude e longitude." />
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-[#0B1F33]">Top oportunidades</h2>
            {topOpportunities.length === 0 ? (
              <p className="mt-4 text-sm text-[#64748B]">Nenhuma oportunidade para listar.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {topOpportunities.map((point) => (
                <div
                  key={point.id}
                  className={`rounded-lg border border-[#EEF2F7] p-3 transition-colors ${typeof point.latitude === "number" ? "cursor-pointer hover:border-[#1061AF]" : ""}`}
                  onClick={() => {
                    if (typeof point.latitude === "number" && typeof point.longitude === "number") {
                      mapRef.current?.flyTo([point.latitude, point.longitude], 15);
                      markerMapRef.current.get(point.id)?.openPopup();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold leading-snug text-[#0B1F33]">{point.companyName}</div>
                      <div className="mt-1 text-xs text-[#64748B]">{point.city}/{point.uf}</div>
                    </div>
                    <span className="rounded-md bg-[#1061AF]/10 px-2 py-1 text-xs font-bold text-[#0F58A0]">{point.score}</span>
                  </div>
                  <div className="mt-3 text-xs font-bold text-[#64748B]">{clientCategoryLabels[getClientCategory(point.status)]}</div>
                </div>
              ))}
            </div>
            )}
          </aside>
        </section>
      )}

      {pointsWithoutCoordinates.length > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#713F12]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#CA8A04]" />
          <span>{pointsWithoutCoordinates.length} oportunidade(s) sem latitude/longitude não aparecem no mapa.</span>
        </div>
      )}

      {/* Banner: se >80% dos pontos tiverem localização aproximada, informa a limitação */}
      {pointsWithCoordinates.length > 0 && (() => {
        const aproxCount = pointsWithCoordinates.filter(
          (p) => p.origemCoordenada?.includes("centroide") || p.origemCoordenada?.includes("jitter")
        ).length;
        const aproxRatio = aproxCount / pointsWithCoordinates.length;
        return aproxRatio > 0.8 ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <span>
              <strong>Localizações aproximadas:</strong> {aproxCount} de {pointsWithCoordinates.length} pontos neste mapa
              representam aproximações visuais baseadas no centroide do município, não o endereço exato dos estabelecimentos.
              A base da Receita Federal não fornece latitude e longitude dos estabelecimentos.
              Pontos aproximados são exibidos com marcador de borda tracejada.
            </span>
          </div>
        ) : null;
      })()}
    </div>
  );
}
