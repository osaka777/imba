import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, appendFile, readFile } from 'fs/promises';
import { dirname } from 'path';

type AuditRole = 'superadmin' | 'finance' | 'support' | 'marketing' | 'readonly';

type AuditWriteArgs = {
  actorRole: AuditRole;
  actorToken?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AuditListFilters = {
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
};

@Injectable()
export class AdminAuditService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuditService.name);
  private readonly storagePath = process.env.ADMIN_AUDIT_LOG_PATH || '/tmp/admin-audit.log';

  constructor() {}

  async onModuleInit() {
    try {
      await mkdir(dirname(this.storagePath), { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to prepare admin audit storage: ${message}`);
    }
  }

  async log(args: AuditWriteArgs): Promise<void> {
    const tokenHash = args.actorToken
      ? createHash('sha256').update(args.actorToken).digest('hex')
      : null;
    const payload = {
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      actorRole: args.actorRole,
      actorTokenHash: tokenHash,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId ? String(args.entityId) : null,
      ip: args.ip || null,
      userAgent: args.userAgent || null,
      metadata: args.metadata || {},
      createdAt: new Date().toISOString(),
    };
    try {
      await appendFile(this.storagePath, `${JSON.stringify(payload)}\n`, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to write admin audit record: ${message}`);
    }
  }

  async list(filters: AuditListFilters = {}) {
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    try {
      const content = await readFile(this.storagePath, 'utf8');
      const allRows = content
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter((row): row is Record<string, unknown> => row != null);

      const filtered = allRows.filter((row) => {
        if (filters.action && row.action !== filters.action) return false;
        if (filters.entityType && row.entityType !== filters.entityType) return false;
        return true;
      });

      const sorted = filtered.sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );

      return sorted.slice(offset, offset + limit);
    } catch {
      return [];
    }
  }
}
