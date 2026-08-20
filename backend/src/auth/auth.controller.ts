import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
  me(@Req() request: any) {
    return this.authService.me(request.user.sub);
  }

  @Patch("password")
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  changePassword(@Req() request: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(request.user.sub, dto);
  }
}
