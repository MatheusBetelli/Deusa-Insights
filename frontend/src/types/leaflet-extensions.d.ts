import type * as Leaflet from "leaflet";

declare module "leaflet" {
  interface MarkerOptions {
    commCat?: "CLIENTE" | "CRITICO" | "PROSPECT";
  }
}

declare global {
  interface Window {
    L?: typeof Leaflet;
  }
}

export {};
