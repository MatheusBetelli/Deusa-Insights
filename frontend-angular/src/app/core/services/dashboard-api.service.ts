import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { DashboardSummary } from "../models/dashboard.model";
import { ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class DashboardApiService {
  constructor(private readonly api: ApiService) {}

  getSummary(): Observable<DashboardSummary> {
    return this.api.get<DashboardSummary>("/dashboard/summary");
  }
}
