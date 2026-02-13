export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    // Fallback: return empty — AI will use its own knowledge
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'br',
        hl: 'pt-br',
        num: 5,
      }),
    });

    if (!response.ok) {
      console.error('Serper API error:', response.status);
      return [];
    }

    const data = await response.json();
    const organic = data.organic || [];

    return organic.slice(0, 5).map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
    }));
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}
