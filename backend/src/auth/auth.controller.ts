import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { CookieOptions, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";

export const AUTH_COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function getAuthCookieOptions(rememberMe = true): CookieOptions {
  const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === "production";
  const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  const sameSite =
    configuredSameSite === "none" || configuredSameSite === "strict" ? configuredSameSite : "lax";
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: "/",
  };
  if (rememberMe) options.maxAge = COOKIE_MAX_AGE_MS;
  return options;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, user } = await this.authService.login(dto);
    response.cookie(AUTH_COOKIE_NAME, accessToken, getAuthCookieOptions(dto.rememberMe));
    return { user };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions(false));
    return { message: "Logout realizado com sucesso" };
  }

  @Post("forgot-password")
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post("reset-password")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedHttpRequest) {
    return this.authService.me(request.user.sub);
  }

  @Patch("password")
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  changePassword(@Req() request: AuthenticatedHttpRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(request.user.sub, dto);
  }
}
