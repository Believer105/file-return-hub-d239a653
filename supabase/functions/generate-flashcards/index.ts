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

    const { courseId } = await req.json();

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
      .select('text')
      .eq('course_id', courseId)
      .order('chunk_index')
      .limit(15);

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No content found for this course');
    }

    console.log(`Generating flashcards for course ${courseId}`);

    const allText = chunks.map(c => c.text).join('\n\n');

    const systemPrompt = `Create flashcards strictly from the provided document text. Use the tool schema exactly.\n\nRules:\n- Generate 10 to 15 flashcards.\n- Focus on key terms, definitions, important concepts, dates, and formulas.\n- Keep front concise; back clear and complete but not too long.\n- Do not add information not found in the document.`;

    const userPrompt = `Document:\n${allText}`;

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
            name: 'create_flashcards',
            description: 'Generate 10-15 flashcards from the document.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              required: ['flashcards'],
              properties: {
                flashcards: {
                  type: 'array',
                  minItems: 10,
                  maxItems: 15,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['front', 'back'],
                    properties: {
                      front: { type: 'string' },
                      back: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'create_flashcards' } },
    };

    let retries = 0;
    let flashcardsData: any = null;

    while (retries < 3 && !flashcardsData) {
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

          if (Array.isArray(parsed?.flashcards) && parsed.flashcards.length >= 10 && parsed.flashcards.length <= 15) {
            flashcardsData = parsed;
            break;
          }
        }

        console.log('Invalid flashcards tool output, retrying...');
        retries++;
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
        retries++;
      }
    }

    if (!flashcardsData) {
      throw new Error('Failed to generate valid flashcards after 3 attempts');
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
