// api/describe.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse JSON body
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
      req.on('error', reject);
    });

    const {
      imageBase64,
      shortDesc,
      artistName = '',
      medium = '',
      dateFinished = '',
      context = '',
      inspiration = '',
      style = 'professional',
      wordCount = '100'
    } = body;

    if (!shortDesc || !shortDesc.trim()) {
      return res.status(400).json({ error: 'Brief description is required' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const styleInstructions = {
      professional: 'a professional art curator writing for gallery exhibitions and museum catalogs',
      technical: 'a technical analyst focusing on materials, brushwork, composition, and artistic process',
      poetic: 'a poet describing the emotional and sensory experience evoked by the artwork',
      philosophical: 'a philosopher exploring the conceptual, existential, or symbolic meaning of the piece',
      scientific: 'a scientist analyzing visual patterns, color theory, symmetry, and perceptual effects',
      abstract: 'an avant-garde critic using experimental and non-literal language to interpret the work'
    };

    const toneInstruction = styleInstructions[style] || styleInstructions.professional;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are ${toneInstruction}. Based on the image and description "${shortDesc}", analyze the artwork purely as an aesthetic and conceptual object.${artistName ? ` Artist: ${artistName}.` : ''}${medium ? ` Medium: ${medium}.` : ''}${dateFinished ? ` Date: ${dateFinished}.` : ''}${context ? ` Context: ${context}.` : ''}${inspiration ? ` Inspiration: ${inspiration}.` : ''} Keep it ${wordCount} words long. Focus on visual elements, meaning, technique (if relevant), and impact. Avoid markdown and do not mention word count in the response.`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const description = completion.choices[0].message.content.trim();
    return res.status(200).json({ description });

  } catch (error) {
    console.error('Error:', error);

    if (error.code === 'insufficient_quota') {
      return res.status(500).json({ error: 'API quota exceeded. Please check your OpenAI billing.' });
    }
    if (error.status === 401) {
      return res.status(500).json({ error: 'Invalid API key. Please check your configuration.' });
    }

    return res.status(500).json({ error: 'Failed to generate description. Please try again.' });
  }
}