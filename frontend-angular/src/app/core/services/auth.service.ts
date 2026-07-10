import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthResponse, LoginRequest } from "../models/auth.model";
import { User } from "../models/user.model";

const AUTH_TOKEN_KEY = "deusa_angular_auth_token";
const AUTH_USER_KEY = "deusa_angular_user";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<User | null>(this.readStoredUser());
  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  get token(): string | null {
    return getStoredAuthToken();
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload).pipe(
      tap((response) => this.storeSession(response.accessToken, response.user)),
    );
  }

  me(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this.storeUser(user)),
    );
  }

  logout(): void {
    if (this.hasStorage()) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(AUTH_USER_KEY);
    }
    this.userSubject.next(null);
  }

  private storeSession(token: string, user: User): void {
    if (this.hasStorage()) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    this.storeUser(user);
  }

  private storeUser(user: User): void {
    if (this.hasStorage()) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    this.userSubject.next(user);
  }

  private readStoredUser(): User | null {
    if (!this.hasStorage()) return null;
    const value = window.localStorage.getItem(AUTH_USER_KEY);
    if (!value) return null;

    try {
      return JSON.parse(value) as User;
    } catch {
      window.localStorage.removeItem(AUTH_USER_KEY);
      return null;
    }
  }

  private hasStorage(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }
}
