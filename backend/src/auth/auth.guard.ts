import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) throw new UnauthorizedException("Token de autenticação não informado");

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
        algorithms: ["HS256"],
      });

      if (!payload?.sub || payload.type !== "access" || typeof payload.ver !== "number") {
        throw new UnauthorizedException("Token não autorizado para acesso à API");
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, role: true, updatedAt: true },
      });
      if (!user) throw new UnauthorizedException("Usuário não encontrado");
      if (payload.ver !== user.updatedAt.getTime()) {
        throw new UnauthorizedException("Sessão invalidada por alteração da conta");
      }

      request.user = {
        ...payload,
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Token de autenticação inválido");
    }
  }
}
