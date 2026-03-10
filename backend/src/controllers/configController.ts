/**
 * System Config Controller
 * Admin-only endpoint for reading and updating tunable business constants.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { configService } from '../services/configService';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../middleware/errorHandler';

/** GET /api/config — list all configs, optionally filtered by category */
export async function listConfigs(req: Request, res: Response): Promise<void> {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;

  const configs = await prisma.systemConfig.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
    select: {
      id: true, key: true, value: true, dataType: true,
      category: true, label: true, description: true, unit: true,
      minValue: true, maxValue: true, isEditable: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Group by category for convenient frontend consumption
  const grouped: Record<string, typeof configs> = {};
  for (const c of configs) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  res.json({ configs, grouped, categories: Object.keys(grouped).sort() });
}

const updateSchema = z.object({
  value: z.string().min(1, 'Value cannot be empty'),
});

/** PATCH /api/config/:key — update a single config value */
export async function updateConfig(req: Request, res: Response): Promise<void> {
  const { key } = req.params;
  const { value } = updateSchema.parse(req.body);

  const existing = await prisma.systemConfig.findUnique({ where: { key } });
  if (!existing) throw new AppError(404, `Config key "${key}" not found`);
  if (!existing.isEditable) throw new AppError(403, `Config key "${key}" is read-only`);

  // Validate value against minValue/maxValue
  const num = parseFloat(value);
  if (!isNaN(num)) {
    if (existing.minValue !== null && num < existing.minValue) {
      throw new AppError(400, `Value ${num} is below minimum ${existing.minValue}`);
    }
    if (existing.maxValue !== null && num > existing.maxValue) {
      throw new AppError(400, `Value ${num} exceeds maximum ${existing.maxValue}`);
    }
  }

  const updated = await prisma.systemConfig.update({
    where: { key },
    data: { value, updatedById: req.user!.sub },
    select: {
      id: true, key: true, value: true, dataType: true,
      category: true, label: true, unit: true, updatedAt: true,
    },
  });

  // Refresh the in-memory cache immediately
  await configService.refresh();

  await writeAuditLog(req.user!.sub, 'UPDATE_SYSTEM_CONFIG', 'system_configs', key, req, {
    previousValue: existing.value,
    newValue: value,
    label: existing.label,
  });

  res.json(updated);
}

/** POST /api/config/reset/:key — reset a config to its default value */
export async function resetConfig(req: Request, res: Response): Promise<void> {
  const { key } = req.params;

  const existing = await prisma.systemConfig.findUnique({ where: { key } });
  if (!existing) throw new AppError(404, `Config key "${key}" not found`);
  if (!existing.isEditable) throw new AppError(403, `Config key "${key}" is read-only`);

  // Import defaults
  const { CONFIG_DEFAULTS } = await import('../services/configDefaults');
  const defaultValue = CONFIG_DEFAULTS[key];
  if (defaultValue === undefined) throw new AppError(404, `No default found for "${key}"`);

  const updated = await prisma.systemConfig.update({
    where: { key },
    data: { value: String(defaultValue), updatedById: req.user!.sub },
    select: { id: true, key: true, value: true, updatedAt: true },
  });

  await configService.refresh();

  await writeAuditLog(req.user!.sub, 'RESET_SYSTEM_CONFIG', 'system_configs', key, req, {
    previousValue: existing.value,
    resetToDefault: String(defaultValue),
  });

  res.json({ ...updated, defaultValue: String(defaultValue) });
}
