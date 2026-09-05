import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "@prisma/client";
import { UsersService } from "./users.service";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { CreateInvitationDto } from "./dto/create-invitation.dto";

@Controller("users")
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  createUser(@Body() dto: CreateInvitationDto, @Req() request: AuthenticatedHttpRequest) {
    return this.createInvitationForRequest(dto, request);
  }

  @Post("invitations")
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  createInvitationExplicit(
    @Body() dto: CreateInvitationDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.createInvitationForRequest(dto, request);
  }

  private createInvitationForRequest(
    dto: CreateInvitationDto,
    request: AuthenticatedHttpRequest,
  ) {
    return this.usersService.createInvitation(dto, {
      id: request.user.sub,
      email: request.user.email,
    });
  }

  @Post(":id/invitation/resend")
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  resendInvitation(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.usersService.resendInvitation(id, {
      id: request.user.sub,
      email: request.user.email,
    });
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  deleteUser(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.usersService.deleteUser(id, request.user.sub);
  }
}
