import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapService } from "@/services/mapService";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { formatCnae, formatCnpj } from "@/lib/commercial-formatters";
import { escapeHtml, escapeHtmlAttribute } from "@/lib/html-safety";
import { ArrowRight, Building2, MapPinned, RefreshCw, ShieldCheck, Target, Users } from "lucide-react";

interface DashboardMapWidgetProps {
  selectedCity?: string;
  selectedCnae?: string;
  uf?: string;
}

const DEFAULT_CENTER: [number, number] = [-21.92, -50.73];
const DEFAULT_ZOOM = 10;

export function DashboardMapWidget({ selectedCity, selectedCnae, uf = "SP" }: DashboardMapWidgetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [allOpportunities, setAllOpportunities] = useState<MapOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Normalizar cidade para filtro
  const activeCity = useMemo(() => {
    if (!selectedCity || selectedCity === "Todas") return undefined;
    return selectedCity;
  }, [selectedCity]);

  // Normalizar CNAE para filtro
  const activeCnae = useMemo(() => {
    if (!selectedCnae || selectedCnae === "Todos") return undefined;
    return selectedCnae.replace(/\D/g, "");
  }, [selectedCnae]);

  // Carregar oportunidades do mapa em tempo real
  const fetchMapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mapService.getOpportunities();
      setAllOpportunities(data);
    } catch (err) {
      console.error("[DashboardMapWidget] Erro ao carregar mapa:", err);
      setError("Não foi possível carregar os dados geográficos dos comércios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMapData();
  }, []);

  // Filtrar oportunidades conforme a cidade e CNAE selecionados no Dashboard
  const opportunities = useMemo(() => {
    return allOpportunities.filter((item) => {
      if (uf && item.uf && item.uf.toUpperCase() !== uf.toUpperCase()) {
        return false;
      }
      if (activeCity && item.city && item.city.toLowerCase() !== activeCity.toLowerCase()) {
        return false;
      }
      if (activeCnae && item.cnaePrincipal) {
        const normItemCnae = item.cnaePrincipal.replace(/\D/g, "");
        if (normItemCnae !== activeCnae) {
          return false;
        }
      }
      return true;
    });
  }, [allOpportunities, activeCity, activeCnae, uf]);

  // Calcular estatísticas dos comércios mapeados
  const stats = useMemo(() => {
    let clients = 0;
    let criticals = 0;
    let prospects = 0;
    let withCoords = 0;

    for (const item of opportunities) {
      if (typeof item.latitude === "number" && typeof item.longitude === "number") {
        withCoords++;
      }
      const isClient = item.status === "CONVERTED";
      if (isClient) {
        clients++;
      } else if (item.score >= 80 || item.potentialLevel === "CRITICAL") {
        criticals++;
      } else {
        prospects++;
      }
    }

    return {
      total: opportunities.length,
      clients,
      criticals,
      prospects,
      opportunitiesCount: criticals + prospects,
      withCoords,
    };
  }, [opportunities]);

  // Inicializar o Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    async function initLeaflet() {
      const LModule = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = LModule.map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: false,
          attributionControl: false,
        });

        LModule.control.zoom({ position: "bottomright" }).addTo(map);

        LModule.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
        }).addTo(map);

        const layerGroup = LModule.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        mapInstanceRef.current = map;
      }
    }

    void initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Atualizar marcadores no mapa sempre que as oportunidades mudarem
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    async function updateMarkers() {
      const LModule = await import("leaflet");
      if (!layerGroupRef.current || !mapInstanceRef.current) return;

      layerGroupRef.current.clearLayers();

      const validPoints: [number, number][] = [];

      for (const item of opportunities) {
        if (typeof item.latitude !== "number" || typeof item.longitude !== "number") continue;

        const isClient = item.status === "CONVERTED";
        const isCritical = item.score >= 80 || item.potentialLevel === "CRITICAL";

        const pinColor = isClient ? "#22C55E" : isCritical ? "#F59E0B" : "#1061AF";
        const badgeText = isClient ? "CLIENTE" : isCritical ? "CRÍTICO" : "OPORTUNIDADE";

        const customIcon = LModule.divIcon({
          className: "custom-dashboard-marker",
          html: `<div style="
            background-color: ${pinColor};
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = LModule.marker([item.latitude, item.longitude], { icon: customIcon });

        const safeTitle = escapeHtml(item.companyName);
        const safeCity = escapeHtml(item.city);
        const safeCnae = escapeHtml(formatCnae(item.cnaePrincipal) || "N/A");
        const safeCnpj = item.cnpj ? escapeHtml(formatCnpj(item.cnpj)) : "N/A";
        const safeId = escapeHtmlAttribute(item.id);

        const popupContent = `
          <div style="font-family: Arial, sans-serif; padding: 4px; max-width: 220px;">
            <div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; color: white; background-color: ${pinColor}; margin-bottom: 6px;">
              ${badgeText}
            </div>
            <h4 style="font-size: 13px; font-weight: bold; margin: 0 0 4px 0; color: #0B1F33; line-height: 1.2;">${safeTitle}</h4>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 2px;">📍 ${safeCity} / SP</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 2px;">🏷️ ${safeCnae}</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 8px;">🏢 CNPJ: ${safeCnpj}</div>
            <a href="/leads-b2b/${safeId}" style="display: block; text-align: center; background-color: #0B1F33; color: white; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-decoration: none;">
              Ver Detalhes do Lead
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);
        layerGroupRef.current.addLayer(marker);
        validPoints.push([item.latitude, item.longitude]);
      }

      if (validPoints.length > 0) {
        const bounds = LModule.latLngBounds(validPoints);
        mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
      } else {
        mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
    }

    void updateMarkers();
  }, [opportunities]);

  const mapSearchQuery = useMemo(() => {
    return {
      uf,
      city: activeCity || "Todas",
      category: activeCnae,
    };
  }, [uf, activeCity, activeCnae]);

  return (
    <div className="rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#EEF2F7] pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-[#1061AF]" />
            <h3 className="font-bold text-[#0B1F33] text-base">Comércios e Clientes Mapeados no Território</h3>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Visualização em tempo real dos estabelecimentos ativos, clientes Deusa e prospecções georreferenciadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchMapData()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-[#F8FAFC] px-2.5 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
            title="Atualizar mapa"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#1061AF] ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>

          <Link
            to="/mapa-oportunidades"
            search={mapSearchQuery}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0B1F33] px-3 text-xs font-bold text-white transition hover:bg-[#1061AF]"
          >
            <span>Ver mapa completo</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#FFF200]" />
          </Link>
        </div>
      </div>

      {/* Grid de Resumo dos Comércios Mapeados */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B]">Total Mapeado</span>
            <Building2 className="h-4 w-4 text-[#1061AF]" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-[#0B1F33]">
            {loading ? "..." : stats.total}
          </div>
          <div className="text-[11px] text-[#64748B]">comércios cadastrados no filtro</div>
        </div>

        <div className="rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#166534]">Clientes Ativos</span>
            <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-[#15803D]">
            {loading ? "..." : stats.clients}
          </div>
          <div className="text-[11px] text-[#166534]">pins verdes no mapa</div>
        </div>

        <div className="rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#92400E]">Oportunidades Críticas</span>
            <Target className="h-4 w-4 text-[#F59E0B]" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-[#B45309]">
            {loading ? "..." : stats.criticals}
          </div>
          <div className="text-[11px] text-[#92400E]">alto potencial de compra (pins amarelos)</div>
        </div>

        <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E40AF]">Prospecções Elegíveis</span>
            <Users className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-[#1D4ED8]">
            {loading ? "..." : stats.prospects}
          </div>
          <div className="text-[11px] text-[#1E40AF]">prospectos no mapa (pins azuis)</div>
        </div>
      </div>

      {/* Container do Mini Mapa Leaflet */}
      <div className="relative overflow-hidden rounded-lg border border-[#CBD5E1] bg-[#E2E8F0] h-[320px]">
        <div ref={mapContainerRef} className="h-full w-full z-0" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs">
            <div className="flex items-center gap-2 rounded-lg bg-[#0B1F33] px-4 py-2 text-xs font-bold text-white shadow-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-[#FFF200]" />
              Sincronizando estabelecimentos do mapa...
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-lg bg-red-100 p-3 text-xs font-bold text-red-800 border border-red-300">
            {error}
          </div>
        )}

        {/* Legenda Flutuante do Mapa */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-md bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#0B1F33] shadow-md border border-[#DDE5EF]">
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E] inline-block"></span>
            <span>Cliente</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] inline-block"></span>
            <span>Oportunidade Crítica</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1061AF] inline-block"></span>
            <span>Prospecto</span>
          </div>
        </div>
      </div>
    </div>
  );
}
