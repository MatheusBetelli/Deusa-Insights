import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Building2, Loader2 } from "lucide-react";
import type { HeatmapPoint } from "@/types/mapOpportunity";

// ── Configurações do mapa ────────────────────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [-22.05, -50.18];
const DEFAULT_ZOOM = 8;

const TILE_DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
};

// ── Legenda: faixas de concentração ─────────────────────────────────────────
const LEGEND_BANDS = [
  { label: "Alta concentração", color: "#FF0055", range: "> 70%" },
  { label: "Média concentração", color: "#FFFF00", range: "30–70%" },
  { label: "Baixa concentração", color: "#00BFFF", range: "< 30%" },
];

// ── Cor do círculo regional por intensidade ──────────────────────────────────
function circleColorByIntensidade(v: number): string {
  if (v >= 0.7) return "#FF2200";
  if (v >= 0.3) return "#FF8C00";
  return "#1061AF";
}

export type RegionalHeatmapProps = {
  points: HeatmapPoint[];
  loading: boolean;
  error: string | null;
};

export function RegionalHeatmap({ points, loading, error }: RegionalHeatmapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circlesGroupRef = useRef<any>(null);

  // ── Inicializar Leaflet (Dark tile) ──────────────────────────────────────
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

        Leaflet.tileLayer(TILE_DARK.url, {
          attribution: TILE_DARK.attribution,
          subdomains: TILE_DARK.subdomains,
          maxZoom: 18,
          minZoom: 3,
        }).addTo(map);

        mapRef.current = map;
      } catch (err) {
        console.error("Erro ao inicializar mapa:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cleanup ao desmontar ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Atualizar camadas ao receber novos dados ──────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove camadas anteriores
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (circlesGroupRef.current) {
      map.removeLayer(circlesGroupRef.current);
      circlesGroupRef.current = null;
    }

    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    (async () => {
      const Leaflet = await import("leaflet");
      await import("leaflet.heat");

      // ── Heatmap layer (gradiente vibrante sobre mapa escuro) ─────────────
      const heatPoints = points.map(
        (p) => [p.latitude, p.longitude, p.intensidade] as [number, number, number],
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heatLayer = (Leaflet as any).heatLayer(heatPoints, {
        radius: 60,
        blur: 40,
        maxZoom: 13,
        max: 1.0,
        gradient: {
          0.0: "#0000FF",
          0.2: "#00BFFF",
          0.4: "#00FF88",
          0.6: "#FFFF00",
          0.75: "#FF8C00",
          0.9: "#FF2200",
          1.0: "#FF0055",
        },
        minOpacity: 0.45,
      });
      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;

      // ── Círculos transparentes por município (para popup regional) ────────
      const group = Leaflet.layerGroup();

      points.forEach((p) => {
        const radius = Math.max(8000, p.intensidade * 22000);
        const color = circleColorByIntensidade(p.intensidade);

        const circle = Leaflet.circle([p.latitude, p.longitude], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.04,
          weight: 1.5,
          opacity: 0.5,
        });

        // Popup regional — sem dados individuais de estabelecimento
        const popupContent = `
          <div style="
            font-family: Inter, sans-serif;
            padding: 10px 4px;
            min-width: 200px;
          ">
            <div style="
              font-size: 15px;
              font-weight: 800;
              color: #0B1F33;
              margin-bottom: 2px;
            ">
              ${p.municipio}
              <span style="font-size: 11px; font-weight: 600; color: #64748B; margin-left: 4px;">${p.uf}</span>
            </div>

            <div style="
              display: flex;
              flex-direction: column;
              gap: 6px;
              margin-top: 10px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #64748B;">Empresas ATIVAS</span>
                <strong style="font-size: 13px; color: #0B1F33;">${p.quantidadeEmpresas.toLocaleString("pt-BR")}</strong>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #64748B;">Intensidade regional</span>
                <span style="
                  font-size: 12px;
                  font-weight: 700;
                  color: ${color};
                  background: ${color}18;
                  padding: 2px 8px;
                  border-radius: 20px;
                ">${(p.intensidade * 100).toFixed(0)}%</span>
              </div>

              <div style="
                margin-top: 4px;
                height: 6px;
                border-radius: 3px;
                background: linear-gradient(to right, #0000FF, #00BFFF, #00FF88, #FFFF00, #FF8C00, #FF0055);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: -3px;
                  left: ${(p.intensidade * 100).toFixed(0)}%;
                  transform: translateX(-50%);
                  width: 12px;
                  height: 12px;
                  border-radius: 50%;
                  background: white;
                  border: 2px solid ${color};
                  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                "></div>
              </div>
            </div>

            <div style="
              margin-top: 10px;
              font-size: 10px;
              color: #94A3B8;
              border-top: 1px solid #E2E8F0;
              padding-top: 8px;
            ">
              Situação cadastral: ATIVA · Receita Federal
            </div>
          </div>
        `;

        circle.bindPopup(popupContent, { maxWidth: 260, minWidth: 220 });
        group.addLayer(circle);
      });

      group.addTo(map);
      circlesGroupRef.current = group;

      // Ajusta o viewport ao conjunto de municípios
      const bounds = Leaflet.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      if (bounds.isValid()) {
        if (points.length === 1) {
          map.setView(bounds.getCenter(), 11);
        } else {
          map.fitBounds(bounds.pad(0.3), { maxZoom: 11 });
        }
      }
    })();
  }, [points]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="overflow-hidden rounded-xl border border-[#DDE5EF] shadow-sm">
      <div className="relative h-[620px] w-full">
        {/* Mapa */}
        <div ref={mapElRef} className="h-full w-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-[#0B1F33]/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-white/60" />
            <p className="mt-3 text-sm font-semibold text-white/70">Carregando dados regionais...</p>
          </div>
        )}

        {/* Estado vazio */}
        {!loading && !error && points.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#0B1F33]/80 p-6 backdrop-blur-sm">
            <div className="max-w-sm text-center">
              <Building2 className="mx-auto h-12 w-12 text-white/40" />
              <h3 className="mt-3 text-base font-bold text-white">
                Nenhuma empresa ativa encontrada
              </h3>
              <p className="mt-1 text-xs text-white/60">
                O mapa de calor regional exibe a concentração de empresas com situação cadastral
                ATIVA por município. Tente remover os filtros aplicados.
              </p>
            </div>
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#0B1F33]/80 p-6 backdrop-blur-sm">
            <div className="max-w-sm text-center">
              <p className="text-sm font-bold text-red-400">Erro ao carregar dados</p>
              <p className="mt-1 text-xs text-white/60">{error}</p>
            </div>
          </div>
        )}

        {/* Legenda de concentração — canto inferior esquerdo */}
        {!loading && points.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 16,
              zIndex: 500,
              background: "rgba(10,15,25,0.88)",
              backdropFilter: "blur(10px)",
              borderRadius: 12,
              padding: "12px 16px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              minWidth: 200,
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#64748B",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Concentração Regional
            </p>

            {/* Barra de gradiente contínua */}
            <div
              style={{
                height: 10,
                borderRadius: 5,
                background:
                  "linear-gradient(to right, #0000FF, #00BFFF, #00FF88, #FFFF00, #FF8C00, #FF2200, #FF0055)",
                marginBottom: 6,
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#64748B",
                marginBottom: 12,
              }}
            >
              <span>Baixa</span>
              <span>Média</span>
              <span>Alta</span>
            </div>

            {/* Faixas legenda */}
            {LEGEND_BANDS.map((b) => (
              <div
                key={b.label}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: b.color,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${b.color}80`,
                  }}
                />
                <span style={{ fontSize: 11, color: "#CBD5E1", fontWeight: 500 }}>
                  {b.label}
                </span>
                <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>
                  {b.range}
                </span>
              </div>
            ))}

            {/* Dica de interação */}
            <p
              style={{
                marginTop: 10,
                fontSize: 10,
                color: "#475569",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 8,
              }}
            >
              Clique em um município para ver detalhes
            </p>
          </div>
        )}

        {/* Badge modo */}
        {!loading && points.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 500,
              background: "rgba(10,15,25,0.82)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: 10,
              fontWeight: 700,
              color: "#94A3B8",
              fontFamily: "Inter, sans-serif",
              border: "1px solid rgba(255,255,255,0.08)",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>🔥</span>
            <span>ANÁLISE REGIONAL · EMPRESAS ATIVAS</span>
          </div>
        )}
      </div>
    </section>
  );
}
