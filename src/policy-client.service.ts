import { Inject, Injectable } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export interface PolicyRequest {
  userId: string;
}

export interface Policy {
  policyId: string;
  customerName: string;
  policyType: string;
  sumInsured: number;
  premium: number;
  status: string;
}

export interface PolicyResponse {
  success: boolean;
  data: Policy[];
}

interface PolicyService {
  GetPolicies(data: PolicyRequest): Observable<PolicyResponse>;
}

@Injectable()
export class PolicyClientService {
  private policyService!: PolicyService;

  constructor(
    @Inject('POLICY_SERVICE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.policyService = this.client.getService<PolicyService>('PolicyService');
  }

  getPolicies(userId: string): Observable<PolicyResponse> {
    return this.policyService.GetPolicies({
      userId,
    });
  }
}