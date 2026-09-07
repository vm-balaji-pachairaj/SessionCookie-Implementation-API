import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenPayload } from '../app.service';
import { CHECK_POLICY_KEY, PolicyRequirement } from './casbin.decorator';
import { CasbinService } from './casbin.service';

// ============================================================================
// CASBIN GUARD — runs AFTER AuthGuard has already validated the JWT + Redis
// session and attached `request.user`. This guard purely checks permissions.
// Routes without @CheckPolicy are allowed through unconditionally.
// ============================================================================
@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly casbinService: CasbinService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<PolicyRequirement | undefined>(
      CHECK_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @CheckPolicy on this route — skip permission check.
    if (!policy) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();

    const roleName = request.user?.userDetails?.role_name;

    if (!roleName) {
      throw new ForbiddenException('Role information missing from token');
    }

    let allowed = false;

    if (policy.field || policy.type === 'field') {
      // P3: Field-level check (sub, lob, page, mod, sec, field, access)
      allowed = await this.casbinService.enforce(
        roleName,
        policy.lob || 'hcp',
        policy.page || policy.menu || 'main',
        policy.mod || policy.sec || policy.section || 'main',
        policy.sec || policy.section || 'main',
        policy.field || '',
        policy.access || 'read',
      );
    } else if (policy.type === 'menu' || (!policy.section && !policy.sec && policy.menu)) {
      // P: Menu-level check (sub, menuKey)
      const menuKey = policy.menu || policy.page || policy.policy || '';
      allowed = await this.casbinService.enforce(roleName, menuKey);
    } else if (policy.policy && !policy.access) {
      // Named policy check
      allowed = this.casbinService.g3_has_policy(roleName, policy.policy);
    } else {
      // P2: Section-level check (sub, lob, page, mod, sec, access)
      allowed = await this.casbinService.enforce(
        roleName,
        policy.lob || 'hcp',
        policy.page || policy.menu || 'main',
        policy.mod || policy.sec || policy.section || 'main',
        policy.sec || policy.section || 'main',
        policy.access || 'read',
      );
    }

    if (!allowed) {
      const details = policy.field
        ? `field="${policy.field}" in section="${policy.sec || policy.section || policy.mod}" page="${policy.page || policy.menu}" access="${policy.access}"`
        : policy.type === 'menu' || (!policy.section && !policy.sec && policy.menu)
        ? `menu="${policy.menu || policy.page || policy.policy}"`
        : `section="${policy.sec || policy.section || policy.page}" access="${policy.access}"`;

      throw new ForbiddenException(
        `Role "${roleName}" is not allowed access to: ${details}`,
      );
    }

    return true;
  }
}
