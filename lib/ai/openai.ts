// OpenAI API wrapper using fetch (no npm package needed)

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

interface ChatCompletionWithToolsOptions extends ChatCompletionOptions {
  tools: ToolDefinition[];
  executeToolCall: (name: string, args: any) => Promise<string>;
  maxToolRounds?: number;
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

export async function chatCompletionWithTools({
  messages,
  tools,
  executeToolCall,
  maxTokens = 1200,
  temperature = 0.7,
  maxToolRounds = 3,
}: ChatCompletionWithToolsOptions): Promise<{ content: string; toolResults: { tool: string; result: string }[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const allToolResults: { tool: string; result: string }[] = [];
  const conversationMessages = [...messages];

  for (let round = 0; round < maxToolRounds; round++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        tools,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) throw new Error('No response from OpenAI');

    const assistantMessage = choice.message;

    // If no tool calls, return the final text
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return { content: assistantMessage.content || '', toolResults: allToolResults };
    }

    // Add assistant message with tool calls to conversation
    conversationMessages.push(assistantMessage);

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs: any;
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        fnArgs = {};
      }

      const result = await executeToolCall(fnName, fnArgs);
      allToolResults.push({ tool: fnName, result });

      conversationMessages.push({
        role: 'tool',
        content: result,
        tool_call_id: toolCall.id,
      });
    }
  }

  // If we exhausted tool rounds, do one final call without tools
  const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: conversationMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!finalResponse.ok) {
    const error = await finalResponse.text();
    throw new Error(`OpenAI API error: ${finalResponse.status} - ${error}`);
  }

  const finalData = await finalResponse.json();
  return {
    content: finalData.choices?.[0]?.message?.content || '',
    toolResults: allToolResults,
  };
}
