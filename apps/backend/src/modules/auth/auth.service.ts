import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new InternalServerErrorException(`Missing environment variable: ${name}`);
  return value;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        roleLinks: {
          include: { role: { include: { permissionLinks: { include: { permission: true } } } } },
        },
        branchLinks: { include: { branch: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE' || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const permissions = [
      ...new Set(
        user.roleLinks.flatMap((link) =>
          link.role.permissionLinks.map((permissionLink) => permissionLink.permission.code),
        ),
      ),
    ];
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: requiredEnv('JWT_ACCESS_SECRET'),
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: requiredEnv('JWT_REFRESH_SECRET'),
      expiresIn: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800),
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await hash(refreshToken, 12) },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: this.toSessionUser(user, permissions),
    };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        roleLinks: {
          include: { role: { include: { permissionLinks: { include: { permission: true } } } } },
        },
        branchLinks: { include: { branch: true } },
      },
    });
    const permissions = [
      ...new Set(
        user.roleLinks.flatMap((link) =>
          link.role.permissionLinks.map((permissionLink) => permissionLink.permission.code),
        ),
      ),
    ];
    return this.toSessionUser(user, permissions);
  }

  async logout(user: RequestUser, ipAddress?: string): Promise<{ success: true }> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'auth.logout',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });
    return { success: true };
  }

  private toSessionUser(
    user: {
      id: string;
      name: string;
      email: string;
      roleLinks: { role: { name: string } }[];
      branchLinks: { branch: { id: string; name: string; code: string } }[];
    },
    permissions: string[],
  ) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.roleLinks[0]?.role.name ?? 'مستخدم',
      permissions,
      branches: user.branchLinks.map((link) => ({
        id: link.branch.id,
        name: link.branch.name,
        code: link.branch.code,
      })),
    };
  }
}
