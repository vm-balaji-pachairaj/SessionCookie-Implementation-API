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

    if (policy.field) {
      // P3: Field-level check
      allowed = await this.casbinService.enforce(
        roleName,
        policy.lob,
        policy.page,
        policy.mod,
        policy.sec,
        policy.field,
        policy.access,
      );
    } else if (policy.menu && (!policy.page || policy.page === policy.sec)) {
      // P2: Menu-level check
      allowed = await this.casbinService.enforce(roleName, policy.menu);
    } else if (policy.policy && !policy.access) {
      // Named policy check
      allowed = this.casbinService.g3_has_policy(roleName, policy.policy);
    } else {
      // P: Section-level check
      allowed = await this.casbinService.enforce(
        roleName,
        policy.lob,
        policy.page,
        policy.mod,
        policy.sec,
        policy.access,
      );
    }

    if (!allowed) {
      const details = policy.field
        ? `field="${policy.field}" in menu="${policy.mod}" section="${policy.page}" access="${policy.access}"`
        : policy.menu
        ? `menu="${policy.menu}"`
        : `section="${policy.sec || policy.page}" access="${policy.access}"`;

      throw new ForbiddenException(
        `Role "${roleName}" is not allowed access to: ${details}`,
      );
    }

    return true;
  }
}
