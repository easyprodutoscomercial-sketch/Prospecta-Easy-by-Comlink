import { NextRequest, NextResponse } from 'next/server';

// Allow large image uploads (default is 1MB)
export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/scan-card - Extrai dados de cartao de visita via IA (sem auth - publico)
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'IA nao configurada' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Imagem obrigatoria' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

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
        max_tokens: 300,
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
