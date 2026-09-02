import { Helper, Model } from 'casbin';
import { PrismaService } from '../PrismaService/prisma.service';

type CasbinRuleRecord = {
  ptype: string;
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
};

const RULE_FIELDS = ['v0', 'v1', 'v2', 'v3', 'v4', 'v5'] as const;

/**
 * Custom Casbin adapter for this project's casbin_rule table.
 * casbin-prisma-adapter cannot be used directly because it calls
 * prisma.casbinRule (camelCase) but this schema generates prisma.casbin_rule.
 */
export class PrismaCasbinAdapter {
  constructor(private readonly prisma: PrismaService) {}

  async loadPolicy(model: Model): Promise<void> {
    const rules = await this.prisma.casbin_rule.findMany();
    for (const rule of rules) {
      const parts = [rule.ptype, ...this.getRuleValues(rule)];
      Helper.loadPolicyLine(parts.join(', '), model);
    }
  }

  async savePolicy(model: Model): Promise<boolean> {
    const records: CasbinRuleRecord[] = [];

    for (const section of ['p', 'g']) {
      const sectionMap = model.model.get(section);
      if (!sectionMap) continue;
      for (const [ptype, assertion] of sectionMap) {
        for (const rule of assertion.policy) {
          records.push(this.buildRecord(ptype, rule));
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.casbin_rule.deleteMany(),
      ...(records.length > 0
        ? [this.prisma.casbin_rule.createMany({ data: records })]
        : []),
    ]);

    return true;
  }

  async addPolicy(_sec: string, ptype: string, rule: string[]): Promise<void> {
    await this.prisma.casbin_rule.create({
      data: this.buildRecord(ptype, rule),
    });
  }

  async addPolicies(_sec: string, ptype: string, rules: string[][]): Promise<void> {
    await this.prisma.casbin_rule.createMany({
      data: rules.map((r) => this.buildRecord(ptype, r)),
      skipDuplicates: true,
    });
  }

  async removePolicy(_sec: string, ptype: string, rule: string[]): Promise<void> {
    await this.prisma.casbin_rule.deleteMany({ where: this.buildRecord(ptype, rule) });
  }

  async removePolicies(_sec: string, ptype: string, rules: string[][]): Promise<void> {
    await this.prisma.$transaction(
      rules.map((rule) =>
        this.prisma.casbin_rule.deleteMany({
          where: this.buildRecord(ptype, rule),
        }),
      ),
    );
  }

  async removeFilteredPolicy(
    _sec: string,
    ptype: string,
    fieldIndex: number,
    ...fieldValues: string[]
  ): Promise<void> {
    const where: Record<string, string> = { ptype };
    for (let i = 0; i < fieldValues.length; i++) {
      const field = RULE_FIELDS[fieldIndex + i];
      if (field && fieldValues[i] !== '') {
        where[field] = fieldValues[i];
      }
    }
    await this.prisma.casbin_rule.deleteMany({ where });
  }

  private buildRecord(ptype: string, rule: string[]): CasbinRuleRecord {
    return {
      ptype,
      v0: rule[0] ?? null,
      v1: rule[1] ?? null,
      v2: rule[2] ?? null,
      v3: rule[3] ?? null,
      v4: rule[4] ?? null,
      v5: rule[5] ?? null,
    };
  }

  private getRuleValues(rule: CasbinRuleRecord): string[] {
    return RULE_FIELDS.map((field) => rule[field]).filter(
      (value): value is string => value !== null && value !== '',
    );
  }
}
