import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Simple in-memory rate limiter for middleware
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 60_000; // 1 minute
const LOGIN_MAX_ATTEMPTS = 10; // max 10 attempts per minute per IP

export async function middleware(request: NextRequest) {
  // Skip if Supabase env vars are not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  // Rate limit login page requests
  if (request.nextUrl.pathname === '/login' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const existing = loginAttempts.get(ip);

    if (existing && existing.resetAt > now) {
      existing.count++;
      if (existing.count > LOGIN_MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Muitas tentativas. Tente novamente em 1 minuto.' },
          { status: 429 }
        );
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — treat as unauthenticated
  }

  // Arquivos publicos do PWA que NUNCA podem ser redirecionados pro login —
  // o navegador chama eles sem cookie de auth (manifest/sw/icones), entao
  // se redirecionar vira HTML do login e o parser do PWA explode com
  // "Manifest: Syntax error". Mesma logica pra sw.js e qualquer asset
  // servido direto do /public.
  const pathname = request.nextUrl.pathname;
  const isPublicPwaAsset =
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/offline' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/splash/') ||
    pathname.endsWith('.webmanifest') ||
    /^\/worker-[a-z0-9]+\.js$/.test(pathname);

  // Redirecionar para login se não autenticado (exceto na própria página de login)
  if (
    !user &&
    !isPublicPwaAsset &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/lead-capture') &&
    !pathname.startsWith('/quiz') &&
    !pathname.startsWith('/portal') &&
    !pathname.startsWith('/walkin-fill') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Add security headers
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HSTS — em prod (Vercel) ja forca HTTPS, mas o header instrui o navegador a
  // recusar HTTP por 1 ano mesmo se tentar acessar manualmente.
  // includeSubDomains: cobre futuros subdominios (api.x, etc).
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP — limita origens de scripts/imagens/fontes pra mitigar XSS.
  // 'unsafe-inline'/'unsafe-eval' em script-src sao infelizmente necessarios pelo
  // Next.js (hydration inline scripts) e Tailwind dev. Em prod, idealmente
  // migrar pra nonce-based CSP. Por agora, pelo menos restringe origens externas.
  // Origens permitidas:
  //   - Supabase (auth, storage, realtime)
  //   - OpenAI (chamadas server-side, mas frontend pode tentar)
  //   - Vercel insights (telemetria do hosting)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://api.zapt.tech https://maps.zapt.tech https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.zapt.tech https://api.openai.com https://*.vercel-insights.com",
    "frame-src 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  supabaseResponse.headers.set('Content-Security-Policy', csp);

  // Cache headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    supabaseResponse.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
