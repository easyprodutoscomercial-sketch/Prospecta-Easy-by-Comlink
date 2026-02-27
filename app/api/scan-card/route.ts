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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Voce extrai dados de cartoes de visita. Retorne APENAS um JSON valido com os campos encontrados. Campos possiveis: name, phone, email, company, cargo, cidade, estado. Se nao encontrar um campo, omita-o. Para phone, mantenha no formato (XX) XXXXX-XXXX. Para estado, use a sigla (SP, RJ, MG, etc). Nao inclua explicacoes, apenas o JSON.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os dados deste cartao de visita:' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' } },
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
