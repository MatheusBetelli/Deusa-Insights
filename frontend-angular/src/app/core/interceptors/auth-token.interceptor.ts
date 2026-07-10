import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { getStoredAuthToken } from "../services/auth.service";

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = getStoredAuthToken();
  const isApiRequest = request.url.startsWith(environment.apiUrl);

  if (!token || !isApiRequest) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
