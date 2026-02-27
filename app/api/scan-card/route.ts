import { NextRequest, NextResponse } from 'next/server';

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
            content: `You extract data from business cards in ANY language (Portuguese, English, Spanish, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, Hindi, Dutch, Swedish, Norwegian, Danish, Polish, Turkish, Thai, Vietnamese, etc). Return ONLY a valid JSON with the fields found. Possible fields: name, phone, email, company, cargo (job title), cidade (city), estado (state/province/region). If a field is not found, omit it. For phone, keep the original format with country code if present. For cargo, translate to Portuguese if possible. For cidade and estado, keep the original name. Do not include explanations, only the JSON.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os dados deste cartao de visita:' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'auto' } },
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
