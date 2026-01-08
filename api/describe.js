// api/describe.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use formidable to parse multipart form data (file + text)
  const formidable = require('formidable');
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Upload parsing failed' });
    }

    // Get inputs
    const shortDesc = fields.shortDesc?.[0] || '';
    const imageFile = files.imageUpload?.[0];

    // Validate
    if (!shortDesc.trim()) {
      return res.status(400).json({ error: 'Brief description is required' });
    }
    if (!imageFile) {
      return res.status(400).json({ error: 'Image is required' });
    }
    if (imageFile.size > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 4MB)' });
    }

    try {
      // Read image as base64
      const fs = require('fs');
      const buffer = fs.readFileSync(imageFile.filepath);
      const mimeType = imageFile.mimetype;
      const dataUrl = `${mimeType};base64,${buffer.toString('base64')}`;

      // Call OpenAI Vision
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Rewrite this brief description into a polished, professional artwork description:\n\n"${shortDesc}"` },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        max_tokens: 300
      });

      const polished = completion.choices[0].message.content.trim();
      res.status(200).json({ description: polished });
    } catch (error) {
      console.error('OpenAI error:', error);
      res.status(500).json({ error: 'Failed to generate description' });
    }
  });
}