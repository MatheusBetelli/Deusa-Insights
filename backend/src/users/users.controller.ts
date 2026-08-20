import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { UserRole } from "@prisma/client";
import { UsersService } from "./users.service";

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
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  deleteUser(@Param("id") id: string, @Req() req: any) {
    return this.usersService.deleteUser(id, req.user?.sub);
  }
}
