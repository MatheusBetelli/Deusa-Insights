import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { MapOpportunity } from "../models/map-opportunity.model";
import { ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class MapOpportunitiesApiService {
  constructor(private readonly api: ApiService) {}

  getOpportunities(): Observable<MapOpportunity[]> {
    return this.api.get<MapOpportunity[]>("/map/opportunities");
  }
}
