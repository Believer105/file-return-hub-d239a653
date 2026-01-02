import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    const systemPrompt = `You generate quizzes based ONLY on provided context. Follow the tool schema exactly.\n\nRules:\n- Create exactly 5 questions.\n- Use a mix of 3 MCQs and 2 short answer questions.\n- All facts must be directly supported by the chunks. Do not invent facts.\n- Keep options plausible and drawn from the text.\n- ${difficultyPrompts[difficulty as keyof typeof difficultyPrompts] || difficultyPrompts.medium}\n- correctAnswer for MCQ is the index (0-3) of the correct option.\n- Generate a unique UUID for quizId.`;

    const userPrompt = `Context paragraphs:\n${contextParts}`;

    const body: any = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_quiz',
            description: 'Create a quiz with exactly 5 questions based on the context.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              required: ['quizId', 'questions'],
              properties: {
                quizId: { type: 'string' },
                questions: {
                  type: 'array',
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'type', 'question', 'sourceChunkIndex'],
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string', enum: ['mcq', 'short'] },
                      question: { type: 'string' },
                      options: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 4,
                        maxItems: 4,
                      },
                      correctAnswer: { type: 'integer', minimum: 0, maximum: 3 },
                      expectedAnswer: { type: 'string' },
                      sourceChunkIndex: { type: 'integer' },
                    },
                    allOf: [
                      {
                        if: { properties: { type: { const: 'mcq' } } },
                        then: { required: ['options', 'correctAnswer'] },
                      },
                      {
                        if: { properties: { type: { const: 'short' } } },
                        then: { required: ['expectedAnswer'] },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'create_quiz' } },
    };

    let retries = 0;
    let quizJson: any = null;

    while (retries < 3 && !quizJson) {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error('AI gateway error:', response.status, t);

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        throw new Error(`AI generation failed: ${t}`);
      }

      const data = await response.json();
      const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

      try {
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);

          if (parsed?.quizId && Array.isArray(parsed?.questions) && parsed.questions.length === 5) {
            quizJson = parsed;
            break;
          }
        }

        console.log('Invalid quiz tool output, retrying...');
        retries++;
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
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
