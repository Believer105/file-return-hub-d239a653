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

// Split text into chunks of ~300 tokens (roughly 1200 characters)
function chunkText(text: string, maxChunkSize = 1200): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If we only got one chunk and it's too large, split by sentences
  if (chunks.length === 1 && chunks[0].length > maxChunkSize * 2) {
    const sentences = chunks[0].split(/(?<=[.!?])\s+/);
    const newChunks: string[] = [];
    let current = '';
    
    for (const sentence of sentences) {
      if (current.length + sentence.length > maxChunkSize && current.length > 0) {
        newChunks.push(current.trim());
        current = sentence;
      } else {
        current += (current ? ' ' : '') + sentence;
      }
    }
    if (current.trim()) newChunks.push(current.trim());
    return newChunks;
  }

  return chunks;
}

// Get embeddings from Gemini
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const text of texts) {
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
      const error = await response.text();
      console.error('Gemini embedding error:', error);
      throw new Error(`Failed to get embedding: ${error}`);
    }

    const data = await response.json();
    embeddings.push(data.embedding.values);
  }

  return embeddings;
}

// Store vectors in Pinecone
async function storeInPinecone(courseId: string, chunks: string[], embeddings: number[][]) {
  const vectors = chunks.map((chunk, index) => ({
    id: `${courseId}_${index}`,
    values: embeddings[index],
    metadata: {
      courseId,
      chunkIndex: index,
      text: chunk.substring(0, 1000) // Store first 1000 chars as metadata
    }
  }));

  const response = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectors,
      namespace: 'courses'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Pinecone upsert error:', error);
    throw new Error(`Failed to store in Pinecone: ${error}`);
  }

  return await response.json();
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

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { name, content } = await req.json();

    if (!name || !content) {
      throw new Error('Name and content are required');
    }

    console.log(`Creating course "${name}" for user ${user.id}`);

    // Create course in database
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({ user_id: user.id, name, raw_text: content })
      .select()
      .single();

    if (courseError) {
      console.error('Course creation error:', courseError);
      throw new Error(`Failed to create course: ${courseError.message}`);
    }

    console.log(`Course created with ID: ${course.id}`);

    // Chunk the content
    const chunks = chunkText(content);
    console.log(`Created ${chunks.length} chunks`);

    // Store chunks in database
    const chunkRecords = chunks.map((text, index) => ({
      course_id: course.id,
      chunk_index: index,
      text,
      token_count: Math.ceil(text.length / 4) // Rough token estimate
    }));

    const { error: chunksError } = await supabase
      .from('chunks')
      .insert(chunkRecords);

    if (chunksError) {
      console.error('Chunks insertion error:', chunksError);
      throw new Error(`Failed to store chunks: ${chunksError.message}`);
    }

    // Get embeddings and store in Pinecone
    console.log('Getting embeddings from Gemini...');
    const embeddings = await getEmbeddings(chunks);
    
    console.log('Storing vectors in Pinecone...');
    await storeInPinecone(course.id, chunks, embeddings);

    console.log('Course creation complete');

    return new Response(
      JSON.stringify({ courseId: course.id, status: 'created', chunksCount: chunks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-course:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
