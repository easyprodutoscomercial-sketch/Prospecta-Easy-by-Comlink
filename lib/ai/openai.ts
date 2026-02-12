// OpenAI API wrapper using fetch (no npm package needed)

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export async function chatCompletion({
  messages,
  maxTokens = 1000,
  temperature = 0.7,
}: ChatCompletionOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function chatCompletionJSON<T = any>(
  options: ChatCompletionOptions
): Promise<T> {
  const result = await chatCompletion(options);

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, result];
  const jsonStr = (jsonMatch[1] || result).trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse OpenAI response as JSON: ${jsonStr.substring(0, 200)}`);
  }
}
