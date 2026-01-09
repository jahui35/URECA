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

    const wordCount = Array.isArray(fields.wordCount)
      ? fields.wordCount[0]
      : fields.wordCount || '100';

    const style = Array.isArray(fields.style)
      ? fields.style[0]
      : fields.style || 'professional';

    // Map style to tone guidance
    const styleInstructions = {
      professional: "a professional art curator writing for a gallery exhibition",
      technical: "a technical analyst focusing on materials, brushwork, composition, and artistic process",
      poetic: "a poet describing the emotional and sensory experience evoked by the artwork",
      philosophical: "a philosopher exploring the conceptual, existential, or symbolic meaning of the piece",
      scientific: "a scientist analyzing visual patterns, color theory, symmetry, and perceptual effects",
      abstract: "an avant-garde critic using experimental and non-literal language to interpret the work"
    };

    const toneInstruction = styleInstructions[style] || styleInstructions.professional;

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
      // length of description
      //const desclength = 

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
                text: `You are ${toneInstruction}. Based on the image and this brief context: "${shortDesc}", write a polished, engaging, and insightful artwork description. Keep it approximately ${wordCount} words long. Focus on visual elements, meaning, technique (if relevant), and impact. Avoid markdown and do not mention word count in the response.`
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