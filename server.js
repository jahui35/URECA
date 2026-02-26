// server.js - Standalone Express server
import express from 'express';
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES Module directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (your HTML)
app.use(express.static(__dirname));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API endpoint
app.post('/api/describe', (req, res) => {
  const form = formidable({
    maxFileSize: 4 * 1024 * 1024, // 4MB
    keepExtensions: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(500).json({ error: 'Upload parsing failed' });
    }

    // Extract fields
    const shortDesc = Array.isArray(fields.shortDesc) 
      ? fields.shortDesc[0] 
      : fields.shortDesc || '';
    
    const artistName = Array.isArray(fields.artistName)
      ? fields.artistName[0]
      : fields.artistName || '';
    
    const medium = Array.isArray(fields.medium)
      ? fields.medium[0]
      : fields.medium || '';
    
    const dateFinished = Array.isArray(fields.dateFinished)
      ? fields.dateFinished[0]
      : fields.dateFinished || '';
    
    const context = Array.isArray(fields.context)
      ? fields.context[0]
      : fields.context || '';
    
    const inspiration = Array.isArray(fields.inspiration)
      ? fields.inspiration[0]
      : fields.inspiration || '';
    
    const style = Array.isArray(fields.style)
      ? fields.style[0]
      : fields.style || 'professional';

    const imageFile = Array.isArray(files.imageUpload)
      ? files.imageUpload[0]
      : files.imageUpload;

    // Validate
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
      // Check for API key
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: 'OPENAI_API_KEY not found in environment variables' 
        });
      }

      // Read and encode image
      const buffer = fs.readFileSync(imageFile.filepath);
      const base64Image = buffer.toString('base64');
      const mimeType = imageFile.mimetype || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      console.log('Processing request...');
      console.log('Description:', shortDesc);
      console.log('Artist:', artistName);
      console.log('Medium:', medium);
      console.log('Date:', dateFinished);
      console.log('Context:', context);
      console.log('Inspiration:', inspiration);
      console.log('Style:', style);
      console.log('Image size:', imageFile.size, 'bytes');

      // Initialize OpenAI
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Build additional context string
      let additionalContext = '';
      
      if (artistName.trim()) {
        additionalContext += `Artist: ${artistName.trim()}\n`;
      }
      
      if (medium.trim()) {
        additionalContext += `Medium: ${medium.trim()}\n`;
      }
      
      if (dateFinished.trim()) {
        additionalContext += `Date Finished: ${dateFinished.trim()}\n`;
      }
      
      if (context.trim()) {
        additionalContext += `Context: ${context.trim()}\n`;
      }
      
      if (inspiration.trim()) {
        additionalContext += `Inspiration: ${inspiration.trim()}\n`;
      }

      // Define style-specific instructions
      const styleInstructions = {
        'professional': 'Write in a professional, curatorial tone suitable for gallery exhibitions and museum catalogs. Focus on artistic merit, technique, and historical significance.',
        'technical': 'Focus on technical aspects: materials, techniques, brushwork, color theory, composition, and artistic process. Use precise terminology appropriate for art students and professionals.',
        'poetic': 'Write in an evocative, poetic style that captures the emotional and sensory experience of the artwork. Use metaphor, imagery, and lyrical language.',
        'philosophical': 'Explore conceptual themes, symbolism, and philosophical implications. Connect the artwork to broader ideas about existence, meaning, and human experience.',
        'scientific': 'Analyze the artwork using scientific and analytical language. Discuss color psychology, visual perception, compositional principles, and material properties.',
        'abstract': 'Write in an experimental, non-linear style that mirrors the abstract nature of the artwork. Use fragmented language, unconventional structure, and interpretive ambiguity.'
      };

      const styleInstruction = styleInstructions[style] || styleInstructions['professional'];

      // Call OpenAI Vision API
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `You are an art curator writing professional artwork descriptions. Based on the image and the following information, create a polished, detailed, and professional artwork description.\n\nBrief Description: "${shortDesc}"\n\n${additionalContext ? 'Additional Information:\n' + additionalContext : ''}\n${styleInstruction}\n\nFocus on visual elements, technique, color palette, composition, emotional impact, and meaning. Incorporate the artist name, medium, date, context, and inspiration when provided. Write 2-3 well-structured paragraphs.` 
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

      // Cleanup temp file
      try {
        fs.unlinkSync(imageFile.filepath);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }

      console.log('Success! Generated description.');
      return res.status(200).json({ description: polishedDescription });

    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Specific error handling
      if (error.code === 'insufficient_quota') {
        return res.status(500).json({ 
          error: 'API quota exceeded. Please add credits at https://platform.openai.com/account/billing' 
        });
      }
      
      if (error.status === 401 || error.message?.includes('Incorrect API key')) {
        return res.status(500).json({ 
          error: 'Invalid API key. Please check your .env.local file.' 
        });
      }

      return res.status(500).json({ 
        error: `Failed to generate description: ${error.message}` 
      });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎨 Artwork Description Server Running!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`📁 Serving: ${__dirname}`);
  console.log(`🔑 API Key: ${process.env.OPENAI_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});