import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { UsersService } from "./users.service";

@UseGuards(AuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}
