// api/describe.js
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';

export default async function handler(req, res) {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Disable bodyParser for this route (Vercel/Next.js specific)
  // This allows formidable to parse the multipart data
  
  const form = formidable({
    maxFileSize: 4 * 1024 * 1024, // 4MB
    keepExtensions: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(500).json({ error: 'Upload parsing failed' });
    }

    // Extract fields (formidable v3 returns arrays)
    const shortDesc = Array.isArray(fields.shortDesc) 
      ? fields.shortDesc[0] 
      : fields.shortDesc || '';
    
    const imageFile = Array.isArray(files.imageUpload)
      ? files.imageUpload[0]
      : files.imageUpload;

    // Validate inputs
    if (!shortDesc || !shortDesc.trim()) {
      return res.status(400).json({ error: 'Brief description is required' });
    }

    if (!imageFile) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (imageFile.size > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 4MB)' });
    }

    try {
      // Read image file and convert to base64
      const buffer = fs.readFileSync(imageFile.filepath);
      const base64Image = buffer.toString('base64');
      const mimeType = imageFile.mimetype || 'image/jpeg';
      
      // Create proper data URL
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Initialize OpenAI client
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Call OpenAI Vision API
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `You are an art curator writing professional artwork descriptions. Based on the image and this brief description: "${shortDesc}", create a polished, detailed, and professional artwork description. Focus on the visual elements, technique, color palette, composition, and emotional impact. Keep it concise but evocative (2-3 paragraphs).` 
              },
              { 
                type: 'image_url', 
                image_url: { 
                  url: dataUrl,
                  detail: 'high'
                } 
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const polishedDescription = completion.choices[0].message.content.trim();

      // Clean up temporary file
      try {
        fs.unlinkSync(imageFile.filepath);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }

      // Return success response
      return res.status(200).json({ 
        description: polishedDescription 
      });

    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Provide more specific error messages
      if (error.code === 'insufficient_quota') {
        return res.status(500).json({ 
          error: 'API quota exceeded. Please check your OpenAI billing.' 
        });
      }
      
      if (error.status === 401) {
        return res.status(500).json({ 
          error: 'Invalid API key. Please check your configuration.' 
        });
      }

      return res.status(500).json({ 
        error: 'Failed to generate description. Please try again.' 
      });
    }
  });
}

// Required for Next.js API routes with formidable
export const config = {
  api: {
    bodyParser: false,
  },
};