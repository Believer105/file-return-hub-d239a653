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

    const { courseId, length = 'medium' } = await req.json();

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
      .limit(20);

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No content found for this course');
    }

    console.log(`Generating summary for course ${courseId}`);

    const allText = chunks.map(c => c.text).join('\n\n');

    const lengthInstructions = {
      short: 'Keep each section brief with 3-5 bullet points.',
      medium: 'Provide moderate detail with 5-8 bullet points per section.',
      long: 'Be comprehensive with 8-12 bullet points per section.'
    };

    const systemPrompt = `Generate a "Cheat Sheet" summary of the following document. Break it down into structured sections.

Output JSON exactly in this format (no extra text):
{
  "coreConcepts": ["<concept 1>", "<concept 2>", ...],
  "keyFacts": ["<fact/date/formula 1>", "<fact/date/formula 2>", ...],
  "actionSteps": ["<actionable step 1>", "<actionable step 2>", ...]
}

Rules:
- coreConcepts: Main ideas, theories, or principles
- keyFacts: Important dates, formulas, statistics, definitions
- actionSteps: Practical applications or things to remember for exams
- ${lengthInstructions[length as keyof typeof lengthInstructions] || lengthInstructions.medium}
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

    let summaryData = { coreConcepts: [], keyFacts: [], actionSteps: [] };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse summary JSON:', e);
      throw new Error('Failed to generate valid summary');
    }

    // Store summary
    const { data: savedSummary, error: saveError } = await supabase
      .from('summaries')
      .insert({
        course_id: courseId,
        summary_json: summaryData,
        length
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save summary:', saveError);
    }

    console.log(`Summary generated for course ${courseId}`);

    return new Response(
      JSON.stringify(summaryData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-summary:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
