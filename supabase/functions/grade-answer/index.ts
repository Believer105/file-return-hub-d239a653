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

    const { courseId, question, userAnswer, sourceChunkIndex, expectedAnswer } = await req.json();

    if (!courseId || !question || userAnswer === undefined) {
      throw new Error('courseId, question, and userAnswer are required');
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

    // Get the source chunk if provided
    let contextText = '';
    if (sourceChunkIndex !== undefined) {
      const { data: chunk } = await supabase
        .from('chunks')
        .select('text')
        .eq('course_id', courseId)
        .eq('chunk_index', sourceChunkIndex)
        .single();
      
      if (chunk) {
        contextText = chunk.text;
      }
    }

    // If no chunk found, use expected answer as context
    if (!contextText && expectedAnswer) {
      contextText = `Expected answer: ${expectedAnswer}`;
    }

    console.log(`Grading answer for course ${courseId}`);

    const systemPrompt = `You are a strict grader. Use only the given context paragraph as "ground truth". Rate the student's short answer on a 0-10 scale where:
- 9-10: complete and accurate (all key points)
- 6-8: mostly correct but missing 1 key point
- 3-5: partially correct; missing multiple key points
- 0-2: incorrect or unsupported.

Output JSON exactly:
{ "score": <int 0-10>, "feedback": "<one sentence feedback identifying missed key points or confirming correctness>" }

Input:
Context paragraph:
${contextText}

Question:
${question}

Student Answer:
${userAnswer}

If the student's answer repeats the context verbatim, award full score but still provide brief feedback.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini generation failed: ${await response.text()}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;

    let result = { score: 0, feedback: 'Unable to grade response' };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse grading JSON:', e);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in grade-answer:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
