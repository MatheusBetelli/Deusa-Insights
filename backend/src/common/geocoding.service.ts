import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

export type GeocodeResult = {
  lat: number;
  lng: number;
  enderecoRetornado: string;
  fonte: string;
  confianca: number;
  dataVerificacao: Date;
  placeName?: string;
  placePhone?: string;
  placeId?: string;
  placeCategory?: string;
};

export type GeocodeInput = {
  cnpj?: string | null;
  nomeFantasia?: string | null;
  razaoSocial?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
};

function cleanString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDigits(str: string): string {
  return str.replace(/\D/g, "");
}

@Injectable()
export class GeocodingService implements OnModuleInit {
  private readonly logger = new Logger(GeocodingService.name);
  private apiKey: string | undefined;

  onModuleInit() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (this.isAvailable()) {
      this.logger.log("Google Maps configurado. Operações individuais autorizadas estão disponíveis.");
    } else {
      this.logger.warn(`[Google Maps API] ℹ️ Chave GOOGLE_MAPS_API_KEY não configurada no backend/.env. O sistema operará no modo estático/centroide.`);
    }
  }

  isAvailable(): boolean {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  getMaskedKey(): string {
    if (!this.apiKey) return "Não configurada";
    if (this.apiKey.length <= 8) return "********";
    return `${this.apiKey.slice(0, 4)}...${this.apiKey.slice(-4)}`;
  }


  /**
   * Valida e geocodifica um endereço com Google Geocoding API.
   * Busca também a existência do estabelecimento via Google Places API se o geocoding funcionar.
   */
  async geocodeAndVerify(input: GeocodeInput): Promise<GeocodeResult | null> {
    if (!this.apiKey) {
      this.apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    }
    if (!this.apiKey) {
      this.logger.warn("GOOGLE_MAPS_API_KEY não configurada. Validação do Google desativada.");
      return null;
    }

    const hasSearchIdentity = Boolean(
      input.nomeFantasia?.trim() ||
        input.razaoSocial?.trim() ||
        input.logradouro?.trim() ||
        input.cep?.trim(),
    );
    if (!hasSearchIdentity || !input.cidade?.trim()) {
      this.logger.warn("Endereço insuficiente para executar a consulta individual de geocodificação.");
      return null;
    }

    const businessName = input.nomeFantasia || input.razaoSocial || "";
    const searchTerms = [businessName, input.logradouro, input.numero, input.cidade, input.uf || "SP"].filter(Boolean).join(" ");
    const addressSearch = [input.logradouro, input.numero, input.bairro, input.cidade, input.uf || "SP", "Brasil"].filter(Boolean).join(", ");

    try {
      // 1. Tenta Places API (New) para encontrar o estabelecimento comercial
      const placesNewRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.businessStatus,places.primaryType",
        },
        body: JSON.stringify({
          textQuery: searchTerms,
          languageCode: "pt-BR",
        }),
      });

      if (!placesNewRes.ok) {
        this.logger.warn(`Google Places indisponível (HTTP ${placesNewRes.status}); consulta interrompida sem fallback adicional.`);
        return null;
      }

      let placeResult: any = null;
      const placesNewData = (await placesNewRes.json()) as any;
      if (placesNewData.places && placesNewData.places.length > 0) {
        placeResult = placesNewData.places[0];
      }

      // Se não encontrou pelo nome + endereço, tenta buscar só pelo endereço no Places API (New)
      if (!placeResult) {
        const addressRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.primaryType",
          },
          body: JSON.stringify({
            textQuery: addressSearch,
            languageCode: "pt-BR",
          }),
        });

        if (!addressRes.ok) {
          this.logger.warn(`Google Places indisponível (HTTP ${addressRes.status}); consulta interrompida sem fallback adicional.`);
          return null;
        }

        const addressData = (await addressRes.json()) as any;
        if (addressData.places && addressData.places.length > 0) {
          placeResult = addressData.places[0];
        }
      }

      // Fallback para Geocoding API clássica caso Places API (New) não retorne
      if (!placeResult) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          addressSearch
        )}&key=${this.apiKey}`;
        const geoResponse = await fetch(geocodeUrl, { signal: AbortSignal.timeout(10_000) });
        if (!geoResponse.ok) {
          this.logger.warn(`Google Geocoding indisponível (HTTP ${geoResponse.status}).`);
          return null;
        }
        const geoData = (await geoResponse.json()) as any;

        if (geoData.status === "OK" && geoData.results && geoData.results.length > 0) {
          const geoResult = geoData.results[0];
          const returnedAddress = cleanString(geoResult.formatted_address || "");
          const expectedCity = cleanString(input.cidade || "");
          const expectedUf = cleanString(input.uf || "SP");
          if (
            (expectedCity && !returnedAddress.includes(expectedCity)) ||
            (expectedUf && !returnedAddress.includes(expectedUf))
          ) {
            this.logger.warn("Google Geocoding retornou endereço fora da cidade ou UF solicitada; resultado descartado.");
            return null;
          }
          return {
            lat: geoResult.geometry.location.lat,
            lng: geoResult.geometry.location.lng,
            enderecoRetornado: geoResult.formatted_address,
            fonte: "google_geocoding",
            confianca: 60,
            dataVerificacao: new Date(),
          };
        }

        this.logger.warn("Endereço não localizado no Google Places/Geocoding.");
        return null;
      }

      const lat = placeResult.location.latitude;
      const lng = placeResult.location.longitude;
      const formattedAddress = placeResult.formattedAddress || addressSearch;
      const placeName = placeResult.displayName?.text || placeResult.name;
      const placePhone = placeResult.nationalPhoneNumber;

      // Cálculo de Confiança
      let confianca = 50; // Base por encontrar no Places API (New)

      if (placeName) {
        const placeNameClean = cleanString(placeName);
        const nomeFantasiaClean = input.nomeFantasia ? cleanString(input.nomeFantasia) : "";
        const razaoSocialClean = input.razaoSocial ? cleanString(input.razaoSocial) : "";

        const nameMatch =
          (nomeFantasiaClean && (placeNameClean.includes(nomeFantasiaClean) || nomeFantasiaClean.includes(placeNameClean))) ||
          (razaoSocialClean && (placeNameClean.includes(razaoSocialClean) || razaoSocialClean.includes(placeNameClean)));

        if (nameMatch) {
          confianca += 30;
        }
      }

      const addressClean = cleanString(formattedAddress);
      const logradouroClean = input.logradouro ? cleanString(input.logradouro) : "";
      const numeroClean = input.numero ? cleanString(input.numero) : "";
      const bairroClean = input.bairro ? cleanString(input.bairro) : "";
      const cidadeClean = input.cidade ? cleanString(input.cidade) : "";
      const ufClean = input.uf ? cleanString(input.uf) : "";

      if (logradouroClean && addressClean.includes(logradouroClean)) {
        confianca += 10;
      }
      if (numeroClean && addressClean.includes(numeroClean)) {
        confianca += 10;
      }
      if (bairroClean && addressClean.includes(bairroClean)) {
        confianca += 5;
      }
      if (cidadeClean && addressClean.includes(cidadeClean)) {
        confianca += 10;
      }
      if (ufClean && addressClean.includes(ufClean)) {
        confianca += 5;
      }

      // CEP bate ou é compatível (+10)
      if (input.cep) {
        const cepDigits = extractDigits(input.cep);
        const firstFiveCep = cepDigits.slice(0, 5);
        if (firstFiveCep && addressClean.includes(firstFiveCep)) {
          confianca += 10;
        }
      }

      // Telefone bate (+10)
      if (input.telefone && placePhone) {
        const inputPhoneDigits = extractDigits(input.telefone);
        const placePhoneDigits = extractDigits(placePhone);
        if (
          inputPhoneDigits.length >= 8 &&
          placePhoneDigits.length >= 8 &&
          (inputPhoneDigits.includes(placePhoneDigits) || placePhoneDigits.includes(inputPhoneDigits))
        ) {
          confianca += 10;
        }
      }

      // ── Validação Estrita Territorial (UF / Cidade) ─────────────────────
      // Se o Google retornou um endereço em outro Estado (ex: CE ou SC para SP),
      // a resposta é totalmente incompatível.
      if (ufClean && !addressClean.includes(ufClean)) {
        this.logger.warn("Google Places retornou UF divergente; resultado descartado.");
        return null;
      } else if (cidadeClean && !addressClean.includes(cidadeClean)) {
        this.logger.warn("Google Places retornou cidade divergente; resultado descartado.");
        return null;
      }

      const placeId = placeResult.id;
      const placeCategory = placeResult.primaryType;

      return {
        lat,
        lng,
        enderecoRetornado: formattedAddress,
        fonte: "google_places_v1",
        confianca: Math.min(100, confianca),
        dataVerificacao: new Date(),
        placeName,
        placePhone,
        placeId,
        placeCategory,
      };
    } catch (error) {
      this.logger.error("Erro ao consultar as APIs do Google; nenhum resultado foi persistido.");
      return null;
    }
  }

  /**
   * Chamada direta à Geocoding API para obter lat/lng a partir do texto do endereço.
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
    if (!this.apiKey) {
      this.apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    }
    if (!this.apiKey) return null;

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
        };
      }
      return null;
    } catch (err) {
      this.logger.error("Erro na Geocoding API; nenhum resultado foi persistido.");
      return null;
    }
  }

  /**
   * Chamada direta à Places API (New) para buscar estabelecimentos por texto com suporte a PAGINAÇÃO (nextPageToken).
   */
  async searchPlace(
    query: string,
    options?: { maxPages?: number; locationBias?: any },
  ): Promise<any[] | null> {
    if (!this.apiKey) {
      this.apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    }
    if (!this.apiKey) return null;

    const maxPages = 1;
    const allPlaces: any[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;

    try {
      do {
        pageCount++;
        const body: any = {
          textQuery: query,
          languageCode: "pt-BR",
          pageSize: 20,
        };
        if (pageToken) {
          body.pageToken = pageToken;
        }
        if (options?.locationBias) {
          body.locationBias = options.locationBias;
        }

        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.businessStatus,places.primaryType,places.types,places.websiteUri,places.googleMapsUri,nextPageToken",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          this.logger.warn(`Google Places retornou HTTP ${res.status}; paginação interrompida.`);
          break;
        }

        const data = (await res.json()) as any;
        const places = data.places || [];
        allPlaces.push(...places);

        pageToken = data.nextPageToken;
        if (pageToken && pageCount < maxPages) {
          // Pequena pausa recomendada entre páginas da Places API
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          break;
        }
      } while (pageToken && pageCount < maxPages);

      return allPlaces;
    } catch (err) {
      this.logger.error("Erro na Places API; paginação interrompida.");
      return allPlaces.length > 0 ? allPlaces : null;
    }
  }
}
