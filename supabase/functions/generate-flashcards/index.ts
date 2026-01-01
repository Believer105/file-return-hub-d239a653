import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

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

    const { courseId } = await req.json();

    if (!courseId) {
      throw new Error('courseId is required');
    }

    // Verify user owns the course and get chunks
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', courseId)
      .eq('user_id', user.id)
      .single();

    if (courseError || !course) {
      throw new Error('Course not found or access denied');
    }

    // Get chunks for the course
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('text')
      .eq('course_id', courseId)
      .order('chunk_index')
      .limit(15);

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No content found for this course');
    }

    console.log(`Generating flashcards for course ${courseId}`);

    const allText = chunks.map(c => c.text).join('\n\n');

    const systemPrompt = `Scan the following document for complex terminology, definitions, key concepts, important facts, and formulas. Generate 10-15 flashcards for revision.

Output JSON exactly in this format (no extra text):
{
  "flashcards": [
    { "front": "<term or question>", "back": "<definition or answer>" },
    ...
  ]
}

Rules:
- Focus on key terms, definitions, important concepts, dates, formulas
- Keep front (question) concise
- Keep back (answer) clear and complete but not too long
- All content must come from the provided text only

Document:
${allText}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini generation failed: ${await response.text()}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;

    let flashcardsData = { flashcards: [] };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        flashcardsData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse flashcards JSON:', e);
      throw new Error('Failed to generate valid flashcards');
    }

    // Delete existing flashcards for this course
    await supabase
      .from('flashcards')
      .delete()
      .eq('course_id', courseId);

    // Store new flashcards
    const flashcardRecords = flashcardsData.flashcards.map((fc: any) => ({
      course_id: courseId,
      front: fc.front,
      back: fc.back
    }));

    const { data: savedFlashcards, error: saveError } = await supabase
      .from('flashcards')
      .insert(flashcardRecords)
      .select();

    if (saveError) {
      console.error('Failed to save flashcards:', saveError);
      throw new Error('Failed to save flashcards');
    }

    console.log(`Generated ${savedFlashcards.length} flashcards`);

    return new Response(
      JSON.stringify(savedFlashcards),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-flashcards:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
