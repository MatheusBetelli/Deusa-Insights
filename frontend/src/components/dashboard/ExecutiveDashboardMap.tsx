import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { formatCnae, formatCnpj } from "@/lib/commercial-formatters";
import { escapeHtml, escapeHtmlAttribute } from "@/lib/html-safety";
import { mapService } from "@/services/mapService";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { ExternalLink, Layers, MapPin, Loader2 } from "lucide-react";

const DEFAULT_CENTER: [number, number] = [-21.92, -50.73];
const DEFAULT_ZOOM = 11;

interface ExecutiveDashboardMapProps {
  selectedCity?: string;
  selectedCnae?: string | null;
  selectedUf?: string;
  selectedResponsibleId?: string;
  onSelectCity?: (city: string) => void;
}

function getCommercialCategory(item: MapOpportunity): "CLIENTE" | "CRITICO" | "PROSPECT" {
  if (item.status === "CONVERTED" || item.isClient) return "CLIENTE";
  if (item.score >= 80 || item.potentialLevel === "CRITICAL") return "CRITICO";
  return "PROSPECT";
}

function makePinHtml(category: "CLIENTE" | "CRITICO" | "PROSPECT"): string {
  let bg = "#F59E0B"; // Amarelo/Laranja para Prospect
  if (category === "CLIENTE") {
    bg = "#16A34A"; // Verde para Cliente Ativo
  } else if (category === "CRITICO") {
    bg = "#ED1C24"; // Vermelho para Oportunidade Crítica
  }

  return `<div style="
    position: relative;
    width: 26px;
    height: 34px;
    cursor: pointer;
  ">
    <svg width="26" height="34" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27 13.2 39 16.2 41.5C16.68 41.9 17.32 41.9 17.8 41.5C20.8 39 34 27 34 17C34 7.61116 26.3888 0 17 0Z" fill="${bg}" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="17" cy="16" r="7" fill="rgba(255, 255, 255, 0.9)"/>
    </svg>
  </div>`;
}

export function ExecutiveDashboardMap({
  selectedCity = "Todas",
  selectedCnae,
  selectedUf = "SP",
  selectedResponsibleId,
  onSelectCity,
}: ExecutiveDashboardMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  const [opportunities, setOpportunities] = useState<MapOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Carregar dados georreferenciados existentes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await mapService.getOpportunities();
        if (isMounted) setOpportunities(data);
      } catch (err) {
        console.error("Erro ao carregar comércios para o mapa:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtragem dos pontos pelas propriedades do Dashboard
  const filteredPoints = useMemo(() => {
    const norm = (str?: string | null) =>
      str
        ? str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
        : "";

    return opportunities.filter((item) => {
      if (typeof item.latitude !== "number" || typeof item.longitude !== "number") return false;
      if (selectedUf && selectedUf !== "Todos" && item.uf !== selectedUf) return false;
      if (selectedCity && selectedCity !== "Todas" && norm(item.city) !== norm(selectedCity))
        return false;
      if (
        selectedCnae &&
        item.cnaePrincipal &&
        !item.cnaePrincipal.includes(selectedCnae.replace(/\D/g, ""))
      ) {
        return false;
      }
      return true;
    });
  }, [opportunities, selectedCity, selectedCnae, selectedUf]);

  const stats = useMemo(() => {
    let clients = 0;
    let critical = 0;
    let prospects = 0;

    for (const p of filteredPoints) {
      const cat = getCommercialCategory(p);
      if (cat === "CLIENTE") clients++;
      else if (cat === "CRITICO") critical++;
      else prospects++;
    }

    return { total: filteredPoints.length, clients, critical, prospects };
  }, [filteredPoints]);

  // Inicialização do Leaflet
  useEffect(() => {
    if (loading) return;
    if (mapRef.current || !mapElRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const LeafletModule = await import("leaflet");
        const Leaflet = LeafletModule.default || LeafletModule;
        if (cancelled || !mapElRef.current) return;

        const SP_MAP_BOUNDS: [[number, number], [number, number]] = [
          [-25.5, -53.8],
          [-19.5, -44.0],
        ];

        window.L = Leaflet;

        const map = Leaflet.map(mapElRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: 7,
          maxZoom: 19,
          zoomControl: true,
          scrollWheelZoom: true,
          preferCanvas: true,
          maxBounds: SP_MAP_BOUNDS,
          maxBoundsViscosity: 1.0,
        });

        Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          minZoom: 7,
          noWrap: true,
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error("Erro ao inicializar mapa Leaflet:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar marcadores quando o filtro ou os pontos mudarem
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;

    (async () => {
      const LeafletModule = await import("leaflet");
      const Leaflet = LeafletModule.default || LeafletModule;
      if (cancelled || !mapRef.current) return;
      window.L = Leaflet;

      if (clusterRef.current) {
        clusterRef.current.clearLayers();
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }

      if (filteredPoints.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      await import("leaflet.markercluster");
      if (cancelled || !mapRef.current) return;

      const clusterGroup = Leaflet.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: L.MarkerCluster) => {
          const n = cluster.getChildCount();
          const childMarkers = cluster.getAllChildMarkers();

          const hasClient = childMarkers.some((marker) => marker.options.commCat === "CLIENTE");
          const hasCritical = childMarkers.some((marker) => marker.options.commCat === "CRITICO");

          let bg = "#1061AF";
          if (hasClient) {
            bg = "#16A34A";
          } else if (hasCritical) {
            bg = "#ED1C24";
          }

          const border = "#FFFFFF";
          const size = n >= 100 ? 46 : n >= 25 ? 40 : 34;

          return Leaflet.divIcon({
            className: "deusa-cluster-pin",
            html: `<div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:${bg};
              border:3px solid ${border};
              box-shadow:0 3px 10px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              font-weight:800;font-size:13px;
              color:#FFFFFF;font-family:Inter,system-ui,sans-serif;
            "><span>${n}</span></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });

      const bounds = Leaflet.latLngBounds([]);

      for (const p of filteredPoints) {
        if (typeof p.latitude !== "number" || typeof p.longitude !== "number") continue;

        const cat = getCommercialCategory(p);
        const pinHtml = makePinHtml(cat);

        const customIcon = Leaflet.divIcon({
          html: pinHtml,
          className: "",
          iconSize: [26, 34],
          iconAnchor: [13, 34],
          popupAnchor: [0, -32],
        });

        const marker = Leaflet.marker([p.latitude, p.longitude], {
          icon: customIcon,
          commCat: cat,
        });

        const statusBadge =
          cat === "CLIENTE"
            ? `<span style="background-color: #DCFCE7; color: #15803D; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px;">CLIENTE DEUSA</span>`
            : cat === "CRITICO"
              ? `<span style="background-color: #FEE2E2; color: #B91C1C; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px;">OPORTUNIDADE CRÍTICA</span>`
              : `<span style="background-color: #FEF3C7; color: #B45309; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 9999px;">PROSPECTO ELEGÍVEL</span>`;

        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 210px; padding: 4px;">
            <div style="margin-bottom: 6px;">${statusBadge}</div>
            <div style="font-weight: 700; font-size: 14px; color: #0B1F33; margin-bottom: 2px;">
              ${escapeHtml(p.companyName)}
            </div>
            <div style="font-size: 12px; color: #4B5563; margin-bottom: 4px;">
              ${escapeHtml(p.city)} / ${escapeHtml(p.uf)}
            </div>
            <div style="font-size: 11px; color: #6B7280; margin-bottom: 6px;">
              CNPJ: ${formatCnpj(p.cnpj)}<br/>
              CNAE: ${formatCnae(p.cnaePrincipal)}
              ${p.responsibleName ? `<br/>Responsável: <b>${escapeHtml(p.responsibleName)}</b>` : ""}
            </div>
            <a href="/leads-b2b/${escapeHtmlAttribute(p.id)}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #1061AF; text-decoration: none;">
              Ver ficha do comércio &rarr;
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);
        clusterGroup.addLayer(marker);
        bounds.extend([p.latitude, p.longitude]);
      }

      if (cancelled || !mapRef.current) return;
      map.addLayer(clusterGroup);
      clusterRef.current = clusterGroup;

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filteredPoints, mapReady]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Header Bar do Mapa */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-900 px-5 py-3.5 text-white">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-blue-600/30 p-1.5 text-blue-400">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white">
              Análise Geográfica de Mercado
            </h3>
            <p className="text-xs text-slate-400">
              Mapeamento territorial de clientes e oportunidades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-4 text-xs sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Clientes ({stats.clients})</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-300">
                Oportunidades ({stats.prospects + stats.critical})
              </span>
            </span>
          </div>

          <Link
            to="/mapa-oportunidades"
            search={{ uf: selectedUf, city: selectedCity }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            <span>Mapa Completo</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Container do Mapa */}
      <div className="relative h-[420px] w-full bg-slate-100">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span>Carregando dados georreferenciados...</span>
            </div>
          </div>
        )}

        <div ref={mapElRef} className="h-full w-full" />
      </div>

      {/* Footer informativo */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-500">
        <span>
          Exibindo <strong>{stats.total}</strong> comércios na região selecionada
        </span>
        <span className="text-[11px] text-slate-400">
          *Fonte: PostgreSQL local (Leaflet + OpenStreetMap)
        </span>
      </div>
    </div>
  );
}
