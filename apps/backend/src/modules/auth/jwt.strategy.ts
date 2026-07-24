import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { RequestUser } from '../../core/authz/request-user';

function requiredAccessSecret(): string {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value) throw new Error('JWT_ACCESS_SECRET is required');
  return value;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requiredAccessSecret(),
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        organizationId: true,
        status: true,
        branchLinks: { select: { branchId: true } },
        roleLinks: {
          select: {
            role: {
              select: {
                code: true,
                permissionLinks: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('انتهت صلاحية الجلسة أو تم إيقاف الحساب');
    }

    const roleCodes = user.roleLinks.map((link) => link.role.code);
    const permissions = [
      ...new Set(
        user.roleLinks.flatMap((link) =>
          link.role.permissionLinks.map((permissionLink) => permissionLink.permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      branchIds: user.branchLinks.map((link) => link.branchId),
      permissions,
      roleCodes,
      isOwner: roleCodes.includes('OWNER'),
    };
  }
}
