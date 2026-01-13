export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { pdfBase64 } = req.body;
    
    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: `Extract all plants from this landscape/planting schedule. Return ONLY a JSON array with no other text. Each plant should have:
- code: the plant code/symbol (e.g. "QV", "SAP")
- botanical: botanical/scientific name (e.g. "Quercus virginiana")
- common: common name (e.g. "Live Oak")
- spec: size specification (e.g. "4" Cal, 14' HT" or "3 Gal")
- qty: quantity as a number
- category: one of "tree", "palm", "shrub", "grass", "groundcover"

Example format:
[{"code":"QV","botanical":"Quercus virginiana","common":"Live Oak","spec":"4\\" Cal, 14' HT","qty":5,"category":"tree"}]`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Claude API error: ${errorText}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Extraction error:', error);
    return res.status(500).json({ error: error.message });
  }
}
