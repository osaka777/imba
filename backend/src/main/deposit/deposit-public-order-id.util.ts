import { PrismaService } from '~/prisma/prisma.service';

const MIN_PUBLIC_ID = 3847;
const MAX_PUBLIC_ID = 98762;

export function generatePublicOrderId(): number {
  return (
    Math.floor(Math.random() * (MAX_PUBLIC_ID - MIN_PUBLIC_ID + 1)) + MIN_PUBLIC_ID
  );
}

export function readPublicOrderId(meta: unknown): number | null {
  const m = (meta as Record<string, unknown> | null) || {};
  const v = m.publicOrderId;
  if (typeof v === 'number' && Number.isFinite(v) && v >= MIN_PUBLIC_ID) {
    return Math.round(v);
  }
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const n = Number(v);
    return n >= MIN_PUBLIC_ID ? n : null;
  }
  return null;
}

export async function createUniquePublicOrderId(
  prisma: PrismaService,
): Promise<number> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = generatePublicOrderId();
    const hit = await prisma.deposit.findFirst({
      where: {
        meta: {
          path: ['publicOrderId'],
          equals: candidate,
        },
      },
      select: { id: true },
    });
    if (!hit) return candidate;
  }
  return generatePublicOrderId();
}

export async function ensurePublicOrderId(
  prisma: PrismaService,
  depo: { id: number; meta: unknown },
): Promise<number> {
  const existing = readPublicOrderId(depo.meta);
  if (existing) return existing;

  const publicOrderId = await createUniquePublicOrderId(prisma);
  const oldMeta = ((depo.meta as Record<string, unknown>) || {}) as Record<
    string,
    unknown
  >;

  await prisma.deposit.update({
    where: { id: depo.id },
    data: {
      meta: {
        ...oldMeta,
        publicOrderId,
      } as any,
    },
  });

  return publicOrderId;
}
