import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_PERMISSIONS } from './permissions.decorator';
import type { RequestUser } from './request-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('تعذر التحقق من صلاحيات المستخدم');

    const allowed = required.every((permission) => user.permissions.includes(permission));
    if (!allowed) throw new ForbiddenException('ليست لديك الصلاحية لتنفيذ هذا الإجراء');
    return true;
  }
}
