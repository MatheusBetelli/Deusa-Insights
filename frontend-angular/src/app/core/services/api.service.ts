import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

type QueryValue = string | number | boolean | null | undefined;

@Injectable({ providedIn: "root" })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.params(query) });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? {});
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }

  private url(path: string): string {
    return path.startsWith("http") ? path : `${environment.apiUrl}${path}`;
  }

  private params(query?: Record<string, QueryValue>): HttpParams {
    let params = new HttpParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
