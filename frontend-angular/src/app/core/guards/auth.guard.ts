import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { catchError, map, of } from "rxjs";
import { AuthService } from "../services/auth.service";

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.parseUrl("/login");
  }

  return auth.me().pipe(
    map(() => true),
    catchError(() => {
      auth.logout();
      return of(router.parseUrl("/login"));
    }),
  );
};
