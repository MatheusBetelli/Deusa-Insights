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
      const masked = this.getMaskedKey();
      this.logger.log(`[Google Maps API] 🚀 Chave detectada e ativa! Key: ${masked}. Geocodificação de precisão HABILITADA.`);
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
      this.logger.warn("GOOGLE_MAPS_API_KEY não configurada. Validação do Google desativada.");
      return null;
    }

    const addressParts = [
      input.logradouro,
      input.numero,
      input.bairro,
      input.cep,
      input.cidade,
      input.uf || "SP",
      "Brasil",
    ].filter(Boolean);

    if (addressParts.length < 2) {
      this.logger.warn(`Endereço muito incompleto para geocodificar: ${JSON.stringify(input)}`);
      return null;
    }

    const fullAddress = addressParts.join(", ");

    try {
      // 1. Geocoding API para validar endereço e obter coordenadas
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        fullAddress
      )}&key=${this.apiKey}`;
      
      const geoResponse = await fetch(geocodeUrl);
      const geoData = (await geoResponse.json()) as any;

      if (geoData.status !== "OK" || !geoData.results || geoData.results.length === 0) {
        this.logger.warn(`Geocoding sem resultados para: ${fullAddress}`);
        return null;
      }

      const geoResult = geoData.results[0];
      const lat = geoResult.geometry.location.lat;
      const lng = geoResult.geometry.location.lng;
      const formattedAddress = geoResult.formatted_address;

      // Delay de 200ms para rate limit simples
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 2. Places API (Text Search) para validar existência do comércio
      const businessName = input.nomeFantasia || input.razaoSocial || "";
      const searchTerms = [businessName, input.logradouro, input.numero, input.cidade].filter(Boolean).join(" ");
      
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        searchTerms
      )}&key=${this.apiKey}`;

      const placesResponse = await fetch(placesUrl);
      const placesData = (await placesResponse.json()) as any;

      let matchedPlace: any = null;
      let placePhone: string | undefined = undefined;

      if (placesData.status === "OK" && placesData.results && placesData.results.length > 0) {
        matchedPlace = placesData.results[0];
        
        // Fazer chamada adicional de detalhes do Place para obter telefone
        if (matchedPlace.place_id) {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${matchedPlace.place_id}&fields=name,formatted_address,formatted_phone_number,international_phone_number&key=${this.apiKey}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = (await detailsResponse.json()) as any;
          if (detailsData.status === "OK" && detailsData.result) {
            placePhone = detailsData.result.formatted_phone_number || detailsData.result.international_phone_number;
          }
        }
      }

      // 3. Regra de Match e Cálculo de Confiança
      let confianca = 0;

      // Nome parecido (+35)
      if (matchedPlace) {
        const placeNameClean = cleanString(matchedPlace.name || "");
        const nomeFantasiaClean = input.nomeFantasia ? cleanString(input.nomeFantasia) : "";
        const razaoSocialClean = input.razaoSocial ? cleanString(input.razaoSocial) : "";

        const nameMatch =
          (nomeFantasiaClean && (placeNameClean.includes(nomeFantasiaClean) || nomeFantasiaClean.includes(placeNameClean))) ||
          (razaoSocialClean && (placeNameClean.includes(razaoSocialClean) || razaoSocialClean.includes(placeNameClean)));

        if (nameMatch) {
          confianca += 35;
        }
      }

      // Endereço retornado bate com rua/número/bairro (+30)
      const addressClean = cleanString(formattedAddress);
      const logradouroClean = input.logradouro ? cleanString(input.logradouro) : "";
      const numeroClean = input.numero ? cleanString(input.numero) : "";
      const bairroClean = input.bairro ? cleanString(input.bairro) : "";

      if (logradouroClean && addressClean.includes(logradouroClean)) {
        confianca += 15;
      }
      if (numeroClean && addressClean.includes(numeroClean)) {
        confianca += 10;
      }
      if (bairroClean && addressClean.includes(bairroClean)) {
        confianca += 5;
      }

      // Cidade/UF batem (+15)
      const cidadeClean = input.cidade ? cleanString(input.cidade) : "";
      const ufClean = input.uf ? cleanString(input.uf) : "";

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
        if (addressClean.includes(firstFiveCep)) {
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

      return {
        lat,
        lng,
        enderecoRetornado: formattedAddress,
        fonte: "google_maps",
        confianca,
        dataVerificacao: new Date(),
        placeName: matchedPlace?.name,
        placePhone,
      };
    } catch (error) {
      this.logger.error(`Erro ao consultar as APIs do Google: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
