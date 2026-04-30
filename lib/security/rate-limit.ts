// Rate limiter simples em memoria pra rotas publicas.
//
// Por que em memoria (e nao Redis): sistema interno, 1 instancia, baixo volume.
// Cada bucket e por (chave + IP), com janela deslizante (sliding window).
//
// Uso:
//   import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
//   const ip = getClientIp(request);
//   if (!checkRateLimit('lead-capture', ip, { windowMs: 60_000, max: 30 })) {
//     return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 });
//   }
//
// Limitacao conhecida: em deploy serverless (Vercel) cada lambda tem seu proprio
// Map em memoria, entao o limite efetivo e por instancia. Pra rate limit
// distribuido seria necessario Redis (Upstash, etc). Pra sistema interno + uso
// em feira, isso ja resolve 95% do uso indevido (bot de 1 origem batendo em
// loop). Por isso defini valores generosos — falsa sensacao de seguranca seria
// pior que limite leve.

import { NextRequest } from 'next/server';

type Bucket = number[]; // timestamps das requests
const buckets: Map<string, Bucket> = new Map();

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anon'
  );
}

export function checkRateLimit(
  key: string,
  ip: string,
  opts: { windowMs: number; max: number },
): boolean {
  const now = Date.now();
  const bucketKey = `${key}::${ip}`;
  const bucket = (buckets.get(bucketKey) || []).filter((t) => now - t < opts.windowMs);

  if (bucket.length >= opts.max) {
    buckets.set(bucketKey, bucket);
    return false;
  }

  bucket.push(now);
  buckets.set(bucketKey, bucket);

  // Garbage collection ocasional pra nao acumular keys orfas em memoria
  if (Math.random() < 0.01 && buckets.size > 1000) {
    for (const [k, v] of buckets.entries()) {
      const fresh = v.filter((t) => now - t < opts.windowMs);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    }
  }

  return true;
}
