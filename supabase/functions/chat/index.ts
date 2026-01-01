import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
const PINECONE_HOST = Deno.env.get('PINECONE_HOST');

// Get embedding for query
async function getQueryEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get embedding: ${await response.text()}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

// Query Pinecone for similar chunks
async function queryPinecone(courseId: string, embedding: number[], topK = 5) {
  const response = await fetch(`${PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vector: embedding,
      topK,
      includeMetadata: true,
      namespace: 'courses',
      filter: { courseId: { $eq: courseId } }
    })
  });

  if (!response.ok) {
    throw new Error(`Pinecone query failed: ${await response.text()}`);
  }

  return await response.json();
}

// Generate answer using Gemini
async function generateAnswer(question: string, chunks: any[]): Promise<{ answer: string; sources: any[] }> {
  const contextParts = chunks.map((match, i) => 
    `---CHUNK ${match.metadata.chunkIndex}---\n${match.metadata.text}`
  ).join('\n\n');

  const systemPrompt = `You are an assistant that MUST answer the user's question using ONLY the provided source paragraphs. Do not use any outside knowledge. Use the following format as JSON:

{
  "answer": "<concise_answer_string>",
  "sources": [ { "chunkIndex": <int>, "excerpt": "<short excerpt>" } ]
}

Context paragraphs (each labeled with chunkIndex):
${contextParts}

Question:
${question}

If the answer cannot be fully derived from context, the assistant must say: "I cannot answer this fully from the provided material." and return any partial answers that are strictly supported.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini generation failed: ${await response.text()}`);
  }

  const data = await response.json();
  const responseText = data.candidates[0].content.parts[0].text;
  
  // Parse JSON from response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
  }

  // Fallback if JSON parsing fails
  return {
    answer: responseText,
    sources: chunks.map(c => ({ chunkIndex: c.metadata.chunkIndex, excerpt: c.metadata.text.substring(0, 100) }))
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { courseId, question } = await req.json();

    if (!courseId || !question) {
      throw new Error('courseId and question are required');
    }

    // Verify user owns the course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', user.id)
      .single();

    if (courseError || !course) {
      throw new Error('Course not found or access denied');
    }

    console.log(`Chat query for course ${courseId}: "${question}"`);

    // Get embedding for question
    const embedding = await getQueryEmbedding(question);

    // Query Pinecone
    const pineconeResult = await queryPinecone(courseId, embedding, 5);
    
    if (!pineconeResult.matches || pineconeResult.matches.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I couldn't find relevant information in the course material to answer this question.",
          sources: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate answer
    const result = await generateAnswer(question, pineconeResult.matches);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in chat:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
