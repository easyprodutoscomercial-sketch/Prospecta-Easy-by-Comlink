import { NextRequest, NextResponse } from 'next/server';

// Allow large image uploads (default is 1MB)
export const runtime = 'nodejs';
export const maxDuration = 30;

// Rate limit em memoria: 5 chamadas/minuto por IP. Protege contra bot que
// queime o saldo OpenAI (cada chamada ~R$ 0.30-1.00 com gpt-4o detail:high).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const ipBuckets = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'anon';
}

function checkRate(ip: string): boolean {
  const now = Date.now();
  const bucket = (ipBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_MAX) {
    ipBuckets.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  ipBuckets.set(ip, bucket);
  return true;
}

// POST /api/scan-card - Extrai dados de cartao de visita via IA (sem auth - publico)
export async function POST(request: NextRequest) {
  try {
    // Rate limit pra impedir bot queimando saldo OpenAI
    const ip = getClientIp(request);
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'Muitas tentativas em pouco tempo. Aguarde 1 minuto.' }, { status: 429 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'IA nao configurada' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Imagem obrigatoria' }, { status: 400 });
    }

    // Limite de tamanho (evita custo OpenAI alto + DoS via imagem gigante)
    const MAX_SCAN_SIZE = 8 * 1024 * 1024; // 8MB
    if (file.size > MAX_SCAN_SIZE) {
      return NextResponse.json({ error: 'Imagem muito grande. Tire uma foto mais leve (max 8MB).' }, { status: 400 });
    }

    // So aceita imagens (evita enviar arquivo arbitrario pra OpenAI)
    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens sao aceitas (jpg, png, webp).' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a business card data extractor. You can read business cards in ANY language worldwide.

Extract contact information and return ONLY a valid JSON object with these fields (omit any field not found):
- "name": full name of the person
- "phone": phone number (keep original format with country code if present)
- "email": email address
- "company": company or organization name
- "cargo": job title / position (translate to Portuguese if the card is in another language)
- "cidade": city name
- "estado": state, province or region (use abbreviation if Brazilian, e.g. SP, RJ, MG)
- "associacao": association/cooperative/union the person or company belongs to, if mentioned. Common examples in Brazilian sugarcane/agro sector: ORPLANA, COPERCANA, SOCICANA, UNICANA, CANAOESTE, ACAER, APROCANA, ASCANA, ASSOBARI, APLANA, APMP, APROVALE, AFOCAPI, CANASOL, CANACAMPO, CANAROEIRA, CANAUSSU, NOVOCANA, OLICANA, ORICANA, SULCANAS, ASSOVALE, ASSOCANA, ASSOCAP, ASSOCICANA, ASFORAMA, ASPROVAC, AFCOP, AFIBB, AFOCAN, AFOCANA, AFOPORTO, APCA, APCRO, APLACANA. Return ONLY the acronym/short name (e.g. "SOCICANA"), not the full "Associação dos ...". Do NOT invent — only extract if clearly present on the card (logo, text, footer, side bar).

Rules:
- The card can be in Portuguese, English, Spanish, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, or any other language
- Always return valid JSON, no explanations, no markdown
- If you cannot read any data, return {}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the data from this business card image:' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '{}';

    // Parse JSON - handle markdown code blocks
    let json: Record<string, string> = {};
    try {
      const cleaned = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      json = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Nao foi possivel interpretar o cartao' }, { status: 422 });
    }

    return NextResponse.json(json);
  } catch (error: any) {
    console.error('Error scanning card:', error);
    return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 });
  }
}
