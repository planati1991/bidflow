// Vercel config for larger PDFs
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  },
  maxDuration: 60 // 60 seconds timeout for large PDFs
};

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
        max_tokens: 16384,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: `You are an expert at reading landscape architectural plant schedules from construction plans and PDFs.

Extract ALL plants from this document. Carefully examine every page — plant schedules may span multiple pages and can appear as tables, lists, or within plan notes.

Common plant schedule formats:
- Tables with columns: Symbol/Code, Botanical Name, Common Name, Size/Spec, Quantity
- Sometimes columns are: Key, Plant, Description, Container/Cal, Spacing, Qty
- The table may have a "Remarks" or "Notes" column — ignore that column
- Quantities may appear as totals at the end of a row or in a dedicated "Qty" column
- Size specs may include: caliper (e.g. 4" Cal), height (e.g. 14' HT), gallon size (e.g. 30 Gal), spread, spacing
- Some schedules split trees, shrubs, groundcover, and grasses into separate sections

Rules:
- Include EVERY plant row, even if some fields are missing
- For botanical names, use proper Latin format (genus species 'Cultivar') — do NOT include size info in the botanical field
- Combine all size/specification info into the "spec" field (caliper, height, gallon, spread, container, B&B, etc.)
- If a plant appears in multiple rows with different sizes, include each as a separate entry
- Qty must be a number. If it says "As Shown" or is blank, use 0
- Categorize based on the plant type or the section header it appears under

Return ONLY a valid JSON array. No markdown, no code fences, no explanation. Just the raw JSON array.

Each object must have exactly these fields:
{"code":"QV","botanical":"Quercus virginiana","common":"Live Oak","spec":"4\\" Cal, 14' HT, 8' Spr","qty":5,"category":"tree"}

category must be one of: "tree", "palm", "shrub", "grass", "groundcover"`
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
