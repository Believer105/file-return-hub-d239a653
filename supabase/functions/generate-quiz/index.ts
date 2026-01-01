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

    const { courseId, difficulty = 'medium' } = await req.json();

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
      .select('chunk_index, text')
      .eq('course_id', courseId)
      .order('chunk_index')
      .limit(10);

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No content found for this course');
    }

    console.log(`Generating quiz for course ${courseId} with ${chunks.length} chunks`);

    const contextParts = chunks.map(c => 
      `---CHUNK ${c.chunk_index}---\n${c.text}`
    ).join('\n\n');

    const difficultyPrompts = {
      easy: 'Focus on basic recall and simple facts.',
      medium: 'Include both recall and understanding questions.',
      hard: 'Focus on analysis, comparison, and deeper understanding.'
    };

    const systemPrompt = `You must generate exactly 5 questions based ONLY on the provided context paragraphs. Output JSON exactly in this format (no extra text):

{
  "quizId": "<uuid>",
  "questions": [
    { "id": "q1", "type": "mcq", "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "sourceChunkIndex": 12 },
    { "id": "q2", "type": "short", "question": "...", "expectedAnswer": "...", "sourceChunkIndex": 14 },
    ...
  ]
}

Rules:
- Use a mix of 3 MCQs and 2 short answer questions.
- All facts must be directly supported by the chunks. Do not invent facts.
- Keep options plausible and drawn from the text.
- ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts] || difficultyPrompts.medium}
- correctAnswer for MCQ is the index (0-3) of the correct option.
- Generate a unique UUID for quizId.

Context paragraphs:
${contextParts}`;

    let retries = 0;
    let quizJson = null;

    while (retries < 3 && !quizJson) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.5,
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

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          quizJson = JSON.parse(jsonMatch[0]);
          
          // Validate structure
          if (!quizJson.quizId || !Array.isArray(quizJson.questions) || quizJson.questions.length !== 5) {
            console.log('Invalid quiz structure, retrying...');
            quizJson = null;
            retries++;
            continue;
          }
        }
      } catch (e) {
        console.error('Failed to parse quiz JSON:', e);
        retries++;
      }
    }

    if (!quizJson) {
      throw new Error('Failed to generate valid quiz after 3 attempts');
    }

    // Store quiz in database
    const { data: savedQuiz, error: saveError } = await supabase
      .from('quizzes')
      .insert({
        course_id: courseId,
        quiz_json: quizJson,
        difficulty
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save quiz:', saveError);
      throw new Error('Failed to save quiz');
    }

    console.log(`Quiz generated and saved: ${savedQuiz.id}`);

    return new Response(
      JSON.stringify({ ...quizJson, dbId: savedQuiz.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-quiz:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
