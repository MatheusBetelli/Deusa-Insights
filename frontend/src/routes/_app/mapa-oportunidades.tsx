import type { MapSearch } from "@/features/map/types/search";
import { OpportunityMap } from "@/features/map/pages/OpportunityMap";
import { createFileRoute } from "@tanstack/react-router";
import markerClusterCss from "leaflet.markercluster/dist/MarkerCluster.css?url";
import markerClusterDefaultCss from "leaflet.markercluster/dist/MarkerCluster.Default.css?url";
import leafletCss from "leaflet/dist/leaflet.css?url";

export const Route = createFileRoute("/_app/mapa-oportunidades")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: leafletCss },
      { rel: "stylesheet", href: markerClusterCss },
      { rel: "stylesheet", href: markerClusterDefaultCss },
    ],
  }),
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
