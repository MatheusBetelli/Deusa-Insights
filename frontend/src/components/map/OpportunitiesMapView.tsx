import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Building2, Layers2, MapPin } from "lucide-react";
import { LoadingState } from "@/components/app/InterfaceStates";
import { OPPORTUNITY_COLORS } from "@/constants/mapValidation.constants";
import type { HeatmapData, MapOpportunity } from "@/types/mapOpportunity";

const DEFAULT_CENTER: [number, number] = [-22.05, -50.18];
const DEFAULT_ZOOM = 9;

// ── Tile layers ───────────────────────────────────────────────────────────────
const TILES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
};

// ── Custom commerce SVG icon (store pin) ─────────────────────────────────────
function makeStoreIconHtml(nivel: string): string {
  const c = OPPORTUNITY_COLORS[nivel.toLowerCase()] || OPPORTUNITY_COLORS.baixa;
  const color = c.bg;
  const glow = nivel === "alta" ? `0 0 12px ${color}88` : "none";

  return `
    <div style="
      position:relative;
      width:38px;
      height:46px;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45)) drop-shadow(${glow});
      cursor: pointer;
    ">
      <svg width="38" height="46" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 0C8.507 0 0 8.507 0 19C0 29.785 10.5 38.5 19 46C27.5 38.5 38 29.785 38 19C38 8.507 29.493 0 19 0Z"
              fill="${color}" />
        <circle cx="19" cy="18" r="12" fill="white" fill-opacity="0.95"/>
        <rect x="10" y="13" width="18" height="3" rx="1.5" fill="${color}"/>
        <rect x="12" y="16" width="14" height="10" rx="1" stroke="${color}" stroke-width="1.5" fill="none"/>
        <rect x="16.5" y="19" width="5" height="7" rx="1" fill="${color}"/>
        <rect x="13" y="18" width="3" height="3" rx="0.5" fill="${color}" fill-opacity="0.7"/>
        <rect x="22" y="18" width="3" height="3" rx="0.5" fill="${color}" fill-opacity="0.7"/>
      </svg>
    </div>
  `;
}

function makeClusterHtml(count: number): string {
  return `
    <div style="
      width:42px;height:42px;border-radius:50%;
      background:#1061AF;
      border:3px solid #ffffff;
      box-shadow:0 4px 14px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:13px;color:#ffffff;
      font-family:Inter,sans-serif;
      letter-spacing:-0.5px;
    ">${count}</div>
  `;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export type OpportunitiesMapViewProps = {
  /** Estabelecimentos CONFIRMADOS com validação manual — exibidos como ícones */
  opportunities: MapOpportunity[];
  /** Dados regionais do mapa de calor — empresas ATIVAS agrupadas por município */
  heatmapData: HeatmapData;
  dataLoading: boolean;
  viewMode: "markers" | "heatmap";
  clustersOn: boolean;
  onGoToPending: () => void;
  pendingCount: number;
};

export function OpportunitiesMapView({
  opportunities,
  heatmapData,
  dataLoading,
  viewMode,
  clustersOn,
  onGoToPending,
  pendingCount,
}: OpportunitiesMapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerGroupRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);
  const [activeTile, setActiveTile] = useState<"light" | "dark">("light");

  // ── Inicializar Leaflet ───────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
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

        const tile = TILES.light;
        tileLayerRef.current = Leaflet.tileLayer(tile.url, {
          attribution: tile.attribution,
          subdomains: tile.subdomains,
          maxZoom: 19,
          minZoom: 3,
        }).addTo(map);

        mapRef.current = map;
      } catch (err) {
        console.error("Erro ao inicializar mapa Leaflet:", err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Trocar tile conforme viewMode ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const Leaflet = await import("leaflet");
      const map = mapRef.current;
      if (!map) return;

      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

      const tileKey = viewMode === "heatmap" ? "dark" : "light";
      setActiveTile(tileKey);
      const tile = TILES[tileKey];
      tileLayerRef.current = Leaflet.tileLayer(tile.url, {
        attribution: tile.attribution,
        subdomains: tile.subdomains,
        maxZoom: 19,
        minZoom: 3,
      }).addTo(map);
    })();
  }, [viewMode]);

  // ── Reconstruir camada de dados ───────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    // ── MODO CALOR: dados regionais agrupados por município ─────────────────
    if (viewMode === "heatmap") {
      const { points } = heatmapData;
      if (points.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      (async () => {
        const Leaflet = await import("leaflet");
        await import("leaflet.heat");

        const heatPoints = points.map((p) => [p.latitude, p.longitude, p.intensity] as [number, number, number]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const heatLayer = (Leaflet as any).heatLayer(heatPoints, {
          radius: 55,
          blur: 38,
          maxZoom: 14,
          max: 1.0,
          // Gradiente vibrante: frio → quente
          gradient: {
            0.0: "#0000FF",
            0.2: "#00BFFF",
            0.4: "#00FF88",
            0.6: "#FFFF00",
            0.75: "#FF8C00",
            0.9: "#FF2200",
            1.0: "#FF0055",
          },
          minOpacity: 0.5,
        });
        heatLayer.addTo(map);
        layerGroupRef.current = heatLayer;

        const bounds = Leaflet.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
        if (bounds.isValid()) {
          if (points.length === 1) map.setView(bounds.getCenter(), 11);
          else map.fitBounds(bounds.pad(0.3), { maxZoom: 12 });
        }
      })();
      return;
    }

    // ── MODO MARCADORES: estabelecimentos com validação CONFIRMADA ──────────
    if (opportunities.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    (async () => {
      const Leaflet = await import("leaflet");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let group: any;

      if (clustersOn) {
        await import("leaflet.markercluster");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        group = (Leaflet as any).markerClusterGroup({
          maxClusterRadius: 55,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          iconCreateFunction: (cluster: any) =>
            Leaflet.divIcon({
              className: "",
              html: makeClusterHtml(cluster.getChildCount()),
              iconSize: [42, 42],
              iconAnchor: [21, 21],
            }),
        });
      } else {
        group = Leaflet.layerGroup();
      }

      opportunities.forEach((op) => {
        const icon = Leaflet.divIcon({
          className: "",
          html: makeStoreIconHtml(op.nivelOportunidade),
          iconSize: [38, 46],
          iconAnchor: [19, 46],
          popupAnchor: [0, -48],
        });

        const mapsUrl =
          op.urlEvidencia ||
          `https://www.google.com/maps/search/?api=1&query=${op.latitude},${op.longitude}`;

        const c = OPPORTUNITY_COLORS[op.nivelOportunidade?.toLowerCase()] || OPPORTUNITY_COLORS.baixa;

        const popupContent = `
          <div style="font-family:Inter,sans-serif;padding:6px 4px;max-width:290px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${c.bg};flex-shrink:0;box-shadow:0 0 6px ${c.bg}88;"></div>
              <div style="font-size:14px;font-weight:700;color:#0B1F33;">
                ${op.nomeEncontrado || op.nomeFantasia || op.razaoSocial}
              </div>
            </div>
            <div style="font-size:11px;color:#64748B;margin-bottom:6px;">Cadastrado: ${op.razaoSocial}</div>
            <div style="font-size:12px;font-weight:600;color:#1061AF;margin-bottom:8px;">CNPJ: ${op.cnpjFormatado}</div>
            <div style="font-size:11px;color:#334155;line-height:1.5;margin-bottom:8px;">
              <div>📍 <strong>Endereço:</strong> ${op.enderecoEncontrado || op.enderecoCompleto}</div>
              <div>🏷️ <strong>Categoria:</strong> ${op.categoriaEncontrada || "Varejo Alimentar"}</div>
              <div>🔍 <strong>Origem:</strong> ${op.origemCoordenada.toUpperCase().replace(/_/g, " ")}</div>
            </div>
            <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:6px;padding:5px 8px;font-size:11px;margin-bottom:8px;display:flex;align-items:center;gap:4px;">
              <span style="color:#16A34A;font-size:13px;">✓</span>
              <strong style="color:#16A34A;">VERIFICADO COMERCIALMENTE</strong>
            </div>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
              style="display:block;text-align:center;padding:7px;background:#0B1F33;color:#ffffff;border-radius:7px;font-size:11px;font-weight:700;text-decoration:none;">
              Ver no Google Maps ↗
            </a>
          </div>
        `;

        group.addLayer(
          Leaflet.marker([op.latitude, op.longitude], { icon }).bindPopup(popupContent, {
            maxWidth: 300,
          }),
        );
      });

      group.addTo(map);
      layerGroupRef.current = group;

      const bounds = Leaflet.latLngBounds(opportunities.map((op) => [op.latitude, op.longitude]));
      if (bounds.isValid()) {
        if (opportunities.length === 1) map.setView(bounds.getCenter(), 15);
        else map.fitBounds(bounds.pad(0.25), { maxZoom: 13 });
      }
    })();
  }, [opportunities, heatmapData, viewMode, clustersOn]);

  // ── Tela vazia conforme o modo ─────────────────────────────────────────────
  const isEmpty =
    viewMode === "heatmap" ? heatmapData.points.length === 0 : opportunities.length === 0;

  return (
    <section className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
      <div className="relative h-[660px] w-full bg-[#E8EEF5]">
        <div ref={mapElRef} className="h-full w-full" />

        {/* ── Legenda Mapa de Calor ─────────────────────────────────────── */}
        {viewMode === "heatmap" && heatmapData.points.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 16,
              zIndex: 500,
              background: "rgba(10,15,25,0.88)",
              backdropFilter: "blur(8px)",
              borderRadius: 10,
              padding: "12px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
              Concentração de Empresas Ativas
            </div>
            <div style={{ height: 10, width: 160, borderRadius: 5, background: "linear-gradient(to right, #0000FF, #00BFFF, #00FF88, #FFFF00, #FF8C00, #FF2200, #FF0055)", marginBottom: 5 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748B", marginBottom: 10 }}>
              <span>Menor</span>
              <span>Maior</span>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: "#E2E8F0", fontWeight: 600, marginBottom: 3 }}>
                {heatmapData.totalEmpresas} empresas ATIVAS
              </div>
              <div style={{ fontSize: 10, color: "#64748B" }}>
                em {heatmapData.totalMunicipios} {heatmapData.totalMunicipios === 1 ? "município" : "municípios"}
              </div>
            </div>
          </div>
        )}

        {/* ── Legenda Marcadores ────────────────────────────────────────── */}
        {viewMode === "markers" && opportunities.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 16,
              zIndex: 500,
              background: "rgba(255,255,255,0.93)",
              backdropFilter: "blur(8px)",
              borderRadius: 10,
              padding: "10px 14px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              border: "1px solid #DDE5EF",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
              <Layers2 size={12} style={{ color: "#1061AF" }} />
              Nível de Oportunidade
            </div>
            {(["alta", "media", "baixa"] as const).map((nivel) => {
              const c = OPPORTUNITY_COLORS[nivel];
              const labels: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
              return (
                <div key={nivel} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: c.bg, boxShadow: `0 0 6px ${c.bg}88` }} />
                  <span style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>{labels[nivel]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Badge modo calor ──────────────────────────────────────────── */}
        {activeTile === "dark" && heatmapData.points.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 500,
              background: "rgba(10,15,25,0.8)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 10,
              color: "#94A3B8",
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.1)",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>🔥</span>
            <span>ANÁLISE REGIONAL — EMPRESAS ATIVAS</span>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {dataLoading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70">
            <LoadingState message="Carregando mapa de oportunidades..." />
          </div>
        )}

        {/* ── Estado vazio ──────────────────────────────────────────────── */}
        {!dataLoading && isEmpty && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/90 p-6">
            <div className="max-w-md text-center">
              {viewMode === "heatmap" ? (
                <>
                  <Building2 className="mx-auto h-12 w-12 text-[#94A3B8]" />
                  <h3 className="mt-3 text-base font-bold text-[#0B1F33]">
                    Nenhuma empresa ativa encontrada
                  </h3>
                  <p className="mt-1 text-xs text-[#64748B]">
                    O mapa de calor regional exibe a concentração de empresas ATIVAS por município, importadas da Receita Federal. Nenhum registro ativo foi encontrado com os filtros atuais.
                  </p>
                </>
              ) : (
                <>
                  <MapPin className="mx-auto h-12 w-12 text-[#94A3B8]" />
                  <h3 className="mt-3 text-base font-bold text-[#0B1F33]">
                    Nenhum estabelecimento comercial verificado no mapa
                  </h3>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Somente estabelecimentos com localização comercial comprovada por pesquisa manual, site ou rede social oficial, fonte pública confiável ou visita em campo aparecem no mapa.
                  </p>
                  <button
                    onClick={onGoToPending}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0B1F33] px-4 py-2 text-xs font-bold text-white hover:bg-[#1061AF]"
                  >
                    Ir para Pendências ({pendingCount})
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
