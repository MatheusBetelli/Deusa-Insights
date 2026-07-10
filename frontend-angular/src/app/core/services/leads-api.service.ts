import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Lead, LeadQuery } from "../models/lead.model";
import { ApiService } from "./api.service";

type QueryParams = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: "root" })
export class LeadsApiService {
  constructor(private readonly api: ApiService) {}

  getLeads(query?: LeadQuery): Observable<Lead[]> {
    return this.api.get<Lead[]>("/leads", query as QueryParams | undefined);
  }

  getLead(id: string): Observable<Lead> {
    return this.api.get<Lead>(`/leads/${id}`);
  }
}
