import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { formatCnae, potentialLabels, statusLabels } from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { escapeHtml, escapeHtmlAttribute, safePathSegment } from "@/lib/html-safety";
import { mapService, type MapOpportunityQuery } from "@/services/mapService";
import type { MapOpportunity } from "@/types/mapOpportunity";
import {
  AlertTriangle,
  Building2,
  FileUp,
  Filter,
  Layers,
  RotateCcw,
  MapPin,
  Search,
  Navigation,
} from "lucide-react";

export type MapSearch = {
  uf?: string;
  city?: string;
  companyId?: string;
  category?: string;
  type?: string;
  precision?: string;
  search?: string;
  clusters?: boolean;
};

const MAP_STORAGE_KEY = "deusa_map_filters";

function getStoredMapFilters(): MapSearch {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredMapFilters(filters: MapSearch) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export const Route = createFileRoute("/_app/mapa-oportunidades")({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    uf: typeof search.uf === "string" ? search.uf : "SP",
    city: typeof search.city === "string" ? search.city : "Todas",
    companyId: typeof search.companyId === "string" ? search.companyId : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    precision: typeof search.precision === "string" ? search.precision : undefined,
    search: typeof search.search === "string" ? search.search : undefined,
    clusters: typeof search.clusters === "boolean" ? search.clusters : undefined,
  }),
  component: OpportunityMap,
});

const DEFAULT_CENTER: [number, number] = [-21.92, -50.73];
const DEFAULT_ZOOM = 12;

type CommercialCategory = "CLIENTE" | "CRITICO" | "PROSPECT";

function getCommercialCategory(item: MapOpportunity): CommercialCategory {
  if (item.isClient) return "CLIENTE";
  if (item.potentialLevel === "CRITICAL") return "CRITICO";
  return "PROSPECT";
}

function getPotentialLevelColor(level: MapOpportunity["potentialLevel"]): string {
  if (level === "CRITICAL") return "#ED1C24";
  if (level === "HIGH") return "#C2410C";
  return "#1061AF";
}

function getEstablishmentType(cnae?: string | null): string {
  const norm = (cnae ?? "").replace(/\D/g, "");
  if (norm === "4711302" || norm === "4711301") return "Supermercado";
  if (norm === "4721102" || norm === "4721100" || norm === "1091101" || norm === "1091102")
    return "Padaria";
  if (norm === "4712100") return "Minimercado / Mercearia";
  if (norm === "4722901") return "Açougue";
  return "Minimercado / Mercearia";
}

function getEstablishmentIconSvg(cnae?: string | null): string {
  const normCnae = (cnae ?? "").replace(/\D/g, "");

  if (normCnae === "4711302" || normCnae === "4711301") {
    // Carrinho para Supermercado
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
  }
  if (
    normCnae === "4721102" ||
    normCnae === "4721100" ||
    normCnae === "1091101" ||
    normCnae === "1091102"
  ) {
    // Pão / Bakery para Padaria
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 10.38 0A4 4 0 0 1 19.5 14H4.5z"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`;
  }
  if (normCnae === "4712100") {
    // Storefront para Minimercado / Mercearia
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M9 22V12h6v10"/></svg>`;
  }
  if (normCnae === "4722901") {
    // Carne para Açougue
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
}

// Visual config para marcadores operacionais limpos
function makePinHtml(category: CommercialCategory, cnae: string | null | undefined): string {
  let bg = "#1061AF"; // Navy institucional para Prospect
  if (category === "CLIENTE") {
    bg = "#16A34A"; // Verde para Cliente Ativo
  } else if (category === "CRITICO") {
    bg = "#ED1C24"; // Vermelho para prioridade crítica calculada no backend
  }

  const iconSvg = getEstablishmentIconSvg(cnae);

  return `<div style="
    position: relative;
    width: 30px;
    height: 38px;
    cursor: pointer;
  ">
    <svg width="30" height="38" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27 13.2 39 16.2 41.5C16.68 41.9 17.32 41.9 17.8 41.5C20.8 39 34 27 34 17C34 7.61116 26.3888 0 17 0Z" fill="${bg}" stroke="#FFFFFF" stroke-width="2"/>
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
  const navigate = Route.useNavigate();
  const storedFilters = useMemo(() => getStoredMapFilters(), []);

  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const clusterRef = useRef<L.LayerGroup | L.MarkerClusterGroup | null>(null);
  const markerById = useRef<Map<string, L.Marker>>(new Map());

  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<MapOpportunity[]>([]);
  const [searchQuery, setSearchQuery] = useState(routeSearch.search ?? storedFilters.search ?? "");
  const [selectedUf, setSelectedUf] = useState(routeSearch.uf ?? storedFilters.uf ?? "SP");
  const [selectedCity, setSelectedCity] = useState(
    routeSearch.city ?? storedFilters.city ?? "Todas",
  );
  const [selectedCategory, setSelectedCategory] = useState(
    routeSearch.category ?? storedFilters.category ?? "Todas",
  );
  const [selectedEstablishmentType, setSelectedEstablishmentType] = useState(
    routeSearch.type ?? storedFilters.type ?? "Todos",
  );
  const [selectedPrecision, setSelectedPrecision] = useState(
    routeSearch.precision ?? storedFilters.precision ?? "Todas",
  );
  const [clustersOn, setClustersOn] = useState(
    routeSearch.clusters ?? storedFilters.clusters ?? true,
  );
  const hasFittedRef = useRef(false);

  useEffect(() => {
    const params: MapSearch = {
      uf: selectedUf !== "SP" ? selectedUf : undefined,
      city: selectedCity !== "Todas" ? selectedCity : undefined,
      category: selectedCategory !== "Todas" ? selectedCategory : undefined,
      type: selectedEstablishmentType !== "Todos" ? selectedEstablishmentType : undefined,
      precision: selectedPrecision !== "Todas" ? selectedPrecision : undefined,
      search: searchQuery.trim() || undefined,
      clusters: clustersOn !== true ? clustersOn : undefined,
    };
    setStoredMapFilters(params);
    void navigate({ search: params, replace: true });
  }, [
    selectedUf,
    selectedCity,
    selectedCategory,
    selectedEstablishmentType,
    selectedPrecision,
    searchQuery,
    clustersOn,
    navigate,
  ]);
  const serverQuery = useMemo<MapOpportunityQuery>(() => {
    if (routeSearch.companyId) {
      return { companyId: routeSearch.companyId };
    }

    const query: MapOpportunityQuery = {};
    if (selectedUf && selectedUf !== "Todos") query.uf = selectedUf;
    if (selectedCity && selectedCity !== "Todas") query.city = selectedCity;
    if (searchQuery.trim()) query.search = searchQuery.trim();

    if (selectedCategory === "CLIENTE") {
      query.client = "true";
    } else if (selectedCategory === "CRITICO") {
      query.client = "false";
      query.potentialLevel = "CRITICAL";
    } else if (selectedCategory === "PROSPECT") {
      query.client = "false";
    }

    if (selectedEstablishmentType === "Minimercado / Mercearia") query.cnae = "4712100";
    if (selectedEstablishmentType === "Açougue") query.cnae = "4722901";
    if (selectedEstablishmentType === "Padaria") query.cnae = "4721102";

    return query;
  }, [
    routeSearch.companyId,
    searchQuery,
    selectedCategory,
    selectedCity,
    selectedEstablishmentType,
    selectedUf,
  ]);

  const loadData = useCallback(async () => {
    hasFittedRef.current = false;
    setDataLoading(true);
    setDataError(null);
    try {
      setOpportunities(await mapService.getOpportunities(serverQuery));
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Erro ao carregar oportunidades.");
    } finally {
      setDataLoading(false);
    }
  }, [serverQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    setSelectedUf(routeSearch.uf ?? storedFilters.uf ?? "SP");
    setSelectedCity(routeSearch.city ?? storedFilters.city ?? "Todas");
    if (routeSearch.companyId) {
      setSelectedCategory("Todas");
      setSelectedEstablishmentType("Todos");
      setSelectedPrecision("Todas");
      setSearchQuery("");
    }
    hasFittedRef.current = false;
  }, [
    routeSearch.uf,
    routeSearch.city,
    routeSearch.companyId,
    storedFilters.uf,
    storedFilters.city,
  ]);

  const filtered = useMemo(() => {
    const norm = (str?: string | null) =>
      str
        ? str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
        : "";
    return opportunities.filter((p) => {
      const ufOk = !selectedUf || selectedUf === "Todos" || p.uf === selectedUf;
      const cityOk = selectedCity === "Todas" || norm(p.city) === norm(selectedCity);
      const commCat = getCommercialCategory(p);
      const catOk = selectedCategory === "Todas" || commCat === selectedCategory;

      const estType = getEstablishmentType(p.cnaePrincipal);
      const estTypeOk =
        selectedEstablishmentType === "Todos" || estType === selectedEstablishmentType;

      // Filtro de pesquisa por comércio, CNPJ ou endereço
      let searchOk = true;
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        const qNorm = norm(q);
        const qClean = q.replace(/\D/g, "");
        const cnpjClean = p.cnpj ? p.cnpj.replace(/\D/g, "") : "";

        const matchName = p.companyName ? norm(p.companyName).includes(qNorm) : false;
        const matchCnpj = qClean.length >= 3 && cnpjClean.includes(qClean);
        const matchLogradouro = p.logradouro ? norm(p.logradouro).includes(qNorm) : false;
        const matchBairro = p.bairro ? norm(p.bairro).includes(qNorm) : false;
        const matchCity = p.city ? norm(p.city).includes(qNorm) : false;

        searchOk = matchName || matchCnpj || matchLogradouro || matchBairro || matchCity;
      }

      // Filtro de precisão
      let precOk = true;
      if (selectedPrecision !== "Todas") {
        const conf = p.confiancaVerificacao ?? 0;
        const isAprox = !!(
          p.origemCoordenada?.includes("centroide") || p.origemCoordenada?.includes("jitter")
        );
        if (selectedPrecision === "verificado") precOk = conf >= 90 && !isAprox;
        else if (selectedPrecision === "provavel") precOk = conf >= 60 && conf < 90 && !isAprox;
        else if (selectedPrecision === "aproximado") precOk = isAprox || conf < 60;
      }

      return ufOk && cityOk && catOk && estTypeOk && precOk && searchOk;
    });
  }, [
    opportunities,
    selectedUf,
    selectedCity,
    selectedCategory,
    selectedEstablishmentType,
    selectedPrecision,
    searchQuery,
  ]);

  const withCoords = useMemo(
    () =>
      filtered.filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          p.latitude >= -23.1 &&
          p.latitude <= -20.1 &&
          p.longitude >= -51.9 &&
          p.longitude <= -47.1,
      ),
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
    let cancelled = false;

    if (clusterRef.current) {
      clusterRef.current.clearLayers();
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    markerById.current.clear();

    if (withCoords.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    (async () => {
      const LeafletModule = await import("leaflet");
      const Leaflet = LeafletModule.default || LeafletModule;
      if (cancelled || !mapRef.current) return;
      window.L = Leaflet;

      let group: L.LayerGroup | L.MarkerClusterGroup;

      if (clustersOn) {
        try {
          await import("leaflet.markercluster");
          if (cancelled || !mapRef.current) return;
          group = Leaflet.markerClusterGroup({
            maxClusterRadius: 80,
            spiderfyOnMaxZoom: true,
            spiderfyDistanceMultiplier: 1.5,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 14,
            chunkedLoading: true,
            chunkInterval: 100,
            chunkDelay: 10,
            removeOutsideVisibleBounds: true,
            animate: true,
            animateAddingMarkers: false,
            iconCreateFunction: (cluster: L.MarkerCluster) => {
              const n = cluster.getChildCount();
              const childMarkers = cluster.getAllChildMarkers();

              const hasClient = childMarkers.some((marker) => marker.options.commCat === "CLIENTE");
              const hasCritical = childMarkers.some(
                (marker) => marker.options.commCat === "CRITICO",
              );

              let bg = "#1061AF"; // Azul para cluster de Prospects
              if (hasClient) {
                bg = "#16A34A"; // Verde EXCLUSIVAMENTE se contiver ao menos 1 Cliente Ativo
              } else if (hasCritical) {
                bg = "#ED1C24"; // Vermelho se contiver Oportunidade Crítica (e nenhum cliente)
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
        } catch {
          group = Leaflet.layerGroup();
        }
      } else {
        group = Leaflet.layerGroup();
      }

      const boundPoints: [number, number][] = [];

      // Renderiza a totalidade dos pontos tanto em modo Cluster ON quanto Cluster OFF
      const pointsToRender = withCoords;

      const iconCache = new Map<string, L.DivIcon>();
      const getIcon = (
        commCat: CommercialCategory,
        cnae: string | null | undefined,
        isAprox: boolean,
      ) => {
        const key = `${commCat}_${cnae ?? ""}_${isAprox}`;
        const cachedIcon = iconCache.get(key);
        if (cachedIcon) return cachedIcon;

        const icon = Leaflet.divIcon({
          className: "",
          html: makePinHtml(commCat, cnae),
          iconSize: [30, 38],
          iconAnchor: [15, 38],
          popupAnchor: [0, -34],
        });
        iconCache.set(key, icon);
        return icon;
      };

      const markersToBatch: L.Marker[] = [];
      const coordCounts = new Map<string, number>();

      pointsToRender.forEach((point, idx) => {
        const commCat = getCommercialCategory(point);
        const isAprox = !!(
          point.origemCoordenada?.includes("centroide") ||
          point.origemCoordenada?.includes("jitter")
        );

        let lat = point.latitude!;
        let lng = point.longitude!;
        const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        const dupCount = coordCounts.get(coordKey) || 0;
        coordCounts.set(coordKey, dupCount + 1);

        if (isAprox && withCoords.length > 1) {
          const angle = (idx * 137.5 * Math.PI) / 180;
          const radius = 0.0012 * Math.sqrt((idx % 12) + 1);
          lat += Math.sin(angle) * radius;
          lng += Math.cos(angle) * radius;
        } else if (dupCount > 0) {
          const angle = (dupCount * 120 * Math.PI) / 180;
          const offset = 0.00015;
          lat += Math.sin(angle) * offset;
          lng += Math.cos(angle) * offset;
        }

        boundPoints.push([lat, lng]);

        const icon = getIcon(commCat, point.cnaePrincipal, isAprox);

        // Avaliação tardia (lazy) do conteúdo HTML do popup ao clicar
        const marker = Leaflet.marker([lat, lng], { icon, commCat }).bindPopup(
          () => {
            const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.companyName} ${point.city} ${point.uf}`)}`;
            const levelText =
              potentialLabels[point.potentialLevel as keyof typeof potentialLabels] ||
              point.potentialLevel;
            const statusText =
              statusLabels[point.status as keyof typeof statusLabels] || point.status;
            const levelColor = getPotentialLevelColor(point.potentialLevel);
            const phoneDisplay = point.telefone || "Não identificado";
            const emailDisplay = point.email || "Não identificado";
            const leadHref = `/leads-b2b/${safePathSegment(point.id)}`;

            return `<div class="deusa-map-popup" style="font-family:Inter,system-ui,sans-serif;padding:2px;width:250px;">
              <div style="font-size:13px;font-weight:700;color:#0B1F33;line-height:1.2;">${escapeHtml(point.companyName)}</div>
              <div style="font-size:11px;color:#64748B;margin-top:2px;">${escapeHtml(point.city)}/${escapeHtml(point.uf)}</div>

              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #E2E8F0;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
                <div><span style="color:#64748B;">CNAE:</span> <strong style="color:#0B1F33;">${escapeHtml(formatCnae(point.cnaePrincipal))}</strong></div>
                <div><span style="color:#64748B;">Score:</span> <strong style="color:#0B1F33;">${escapeHtml(point.score)}/100</strong></div>
                <div><span style="color:#64748B;">Status:</span> <strong style="color:#0B1F33;">${escapeHtml(statusText)}</strong></div>
                <div><span style="color:#64748B;">Nível:</span> <strong style="color:${levelColor};">${escapeHtml(levelText)}</strong></div>
                <div style="grid-column:span 2;"><span style="color:#64748B;">Telefone:</span> <strong style="color:#0B1F33;">${escapeHtml(phoneDisplay)}</strong></div>
                <div style="grid-column:span 2;"><span style="color:#64748B;">E-mail:</span> <strong style="color:#0B1F33;">${escapeHtml(emailDisplay)}</strong></div>
                <div style="grid-column:span 2;"><span style="color:#64748B;">Responsável:</span> <strong style="color:#0B1F33;">${escapeHtml(point.responsibleName || "Não atribuído")}</strong></div>
              </div>

              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <a href="${escapeHtmlAttribute(leadHref)}" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px;background:#0B1F33;color:#FFFFFF;text-decoration:none;font-size:11px;font-weight:700;">
                  Abrir oportunidade →
                </a>
                <a href="${escapeHtmlAttribute(gmapsUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px;background:#F1F5F9;color:#0B1F33;text-decoration:none;font-size:11px;font-weight:600;">
                  Ver no Google Maps
                </a>
              </div>
            </div>`;
          },
          { maxWidth: 290, minWidth: 240 },
        );

        markersToBatch.push(marker);
        markerById.current.set(point.id, marker);
        if (point.companyId) {
          markerById.current.set(point.companyId, marker);
        }
      });

      if ("addLayers" in group) {
        group.addLayers(markersToBatch);
      } else {
        markersToBatch.forEach((marker) => group.addLayer(marker));
      }

      if (cancelled || !mapRef.current) return;
      group.addTo(mapRef.current);
      clusterRef.current = group;

      if (routeSearch.companyId) {
        const cleanCompanyId = routeSearch.companyId.trim();
        const target = withCoords.find(
          (p) =>
            p.companyId === cleanCompanyId ||
            p.id === cleanCompanyId ||
            (p.cnpj && p.cnpj === cleanCompanyId) ||
            (p.cnpj &&
              cleanCompanyId &&
              p.cnpj.replace(/\D/g, "") === cleanCompanyId.replace(/\D/g, "")),
        );

        if (target && mapRef.current) {
          hasFittedRef.current = true;
          const m =
            markerById.current.get(target.id) ||
            (target.companyId ? markerById.current.get(target.companyId) : null);

          if (m) {
            if ("zoomToShowLayer" in group) {
              group.zoomToShowLayer(m, () => {
                setTimeout(() => {
                  m.openPopup();
                }, 150);
              });
            } else {
              mapRef.current.setView([target.latitude!, target.longitude!], 17, { animate: true });
              setTimeout(() => {
                m.openPopup();
              }, 250);
            }
          } else if (typeof target.latitude === "number" && typeof target.longitude === "number") {
            mapRef.current.setView([target.latitude, target.longitude], 17, { animate: true });
          }
        }
      }

      const bounds = Leaflet.latLngBounds(boundPoints);
      if (!hasFittedRef.current && bounds.isValid()) {
        hasFittedRef.current = true;
        if (withCoords.length === 1) mapRef.current.setView(bounds.getCenter(), 14);
        else mapRef.current.fitBounds(bounds.pad(0.12), { maxZoom: 14 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [withCoords, mapStatus, clustersOn, routeSearch.companyId]);

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
        actions={
          <Link
            to="/importar-cnpjs"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-bold text-white transition hover:bg-[#1061AF]"
          >
            <FileUp className="h-3.5 w-3.5 text-[#FFF200]" />
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
              {(() => {
                const cityMap = new Map<string, string>();
                const norm = (s: string) =>
                  s
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .trim();
                opportunities
                  .filter((p) => selectedUf === "Todos" || p.uf === selectedUf)
                  .forEach((p) => {
                    if (!p.city) return;
                    const key = norm(p.city);
                    const existing = cityMap.get(key);
                    if (!existing) {
                      cityMap.set(key, p.city.trim());
                    } else if (/[a-z]/.test(p.city) && !/[a-z]/.test(existing)) {
                      cityMap.set(key, p.city.trim());
                    } else if (
                      /[\u00C0-\u024F]/.test(p.city) &&
                      !/[\u00C0-\u024F]/.test(existing)
                    ) {
                      cityMap.set(key, p.city.trim());
                    }
                  });
                return Array.from(cityMap.values())
                  .sort((a, b) => a.localeCompare(b, "pt-BR"))
                  .map((city) => <option key={city}>{city}</option>);
              })()}
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
              <option value="CRITICO">Oportunidade Crítica</option>
              <option value="PROSPECT">Prospect Normal</option>
            </select>
          </label>

          <label className="block min-w-[190px]">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#64748B]">
              <Building2 className="h-3.5 w-3.5 text-[#1061AF]" />
              Tipo de Comércio
            </span>
            <select
              value={selectedEstablishmentType}
              onChange={(e) => setSelectedEstablishmentType(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
            >
              <option value="Todos">Todos os Tipos</option>
              <option value="Supermercado">🛒 Supermercado</option>
              <option value="Padaria">🥖 Padaria</option>
              <option value="Minimercado / Mercearia">🏪 Minimercado / Mercado</option>
              <option value="Açougue">🥩 Açougue</option>
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
              setSelectedEstablishmentType("Todos");
              setSelectedPrecision("Todas");
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DDE5EF] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0B1F33]"
            title="Limpar filtros"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Legenda Simples e Clara do Mapa */}
      <section className="mb-4 rounded-xl border border-[#DDE5EF] bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status (Cores dos Pinos) */}
          <div className="flex flex-wrap items-center gap-3.5 text-xs">
            <span className="font-bold text-[#0B1F33] uppercase text-[11px] tracking-wider">
              Status (Cor do Pin):
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#16A34A] shadow-xs" />
              <span className="font-medium text-slate-700">Cliente Ativo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ED1C24] shadow-xs" />
              <span className="font-medium text-slate-700">Crítica</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#1061AF] shadow-xs" />
              <span className="font-medium text-slate-700">Prospect Normal</span>
            </div>
          </div>

          {/* Tipo de Comércio (Ícones Internos) */}
          <div className="flex flex-wrap items-center gap-2 text-xs border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
            <span className="font-bold text-[#0B1F33] uppercase text-[11px] tracking-wider">
              Tipo (Ícone):
            </span>
            <span
              className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-semibold"
              title="Supermercados"
            >
              🛒 Supermercado
            </span>
            <span
              className="inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-amber-800 font-semibold"
              title="Padarias"
            >
              🥖 Padaria
            </span>
            <span
              className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-semibold"
              title="Minimercados e Mercados"
            >
              🏪 Minimercado / Mercado
            </span>
            <span
              className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-semibold"
              title="Açougues"
            >
              🥩 Açougue
            </span>
          </div>
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
                  Oportunidade Crítica
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
            <div className="relative z-0 isolate h-[680px] bg-[#E8EEF5]">
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
