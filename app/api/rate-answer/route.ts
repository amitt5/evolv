import { NextRequest, NextResponse } from 'next/server';

interface ConversationMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

interface RatingResult {
  specificity: number;
  depth: number;
  behavioralEvidence: number;
  novelty: number;
  overallScore: number;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured. Please set OPENAI_API_KEY in your .env file.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      questionText,
      questionId,
      conversationSegment,
    }: {
      questionText: string;
      questionId: number;
      conversationSegment: ConversationMessage[];
    } = body;

    if (!questionText || !conversationSegment || !Array.isArray(conversationSegment)) {
      return NextResponse.json(
        { error: 'Invalid request. questionText and conversationSegment are required.' },
        { status: 400 }
      );
    }

    // Format conversation segment for the prompt
    const conversationFormatted = conversationSegment.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const prompt = `You are evaluating a behavioral interview answer. Rate the candidate's response on 4 key dimensions.

Question Asked: "${questionText}"

Conversation Segment (question and answer):
${JSON.stringify(conversationFormatted, null, 2)}

Rate the answer on these 4 parameters (each on a scale of 0-10):

1. **Specificity** (0-10): How specific and concrete is the answer? Does it provide clear details, numbers, names, dates, or specific examples rather than vague generalizations?

2. **Depth** (0-10): How deep and thorough is the answer? Does it go beyond surface-level responses and provide meaningful elaboration, context, and detail?

3. **Behavioral Evidence** (0-10): Does the answer follow the STAR method (Situation, Task, Action, Result)? Does it provide concrete behavioral examples that demonstrate the candidate's skills and experiences?

4. **Novelty** (0-10): How unique or insightful is the answer? Does it provide fresh perspectives, unexpected insights, or demonstrate creative thinking beyond typical responses?

5. **Overall Insight Score** (0-10): A holistic assessment of the overall quality and value of the answer, considering all factors above.

Return your evaluation as a JSON object with this exact structure:
{
  "specificity": <number 0-10>,
  "depth": <number 0-10>,
  "behavioralEvidence": <number 0-10>,
  "novelty": <number 0-10>,
  "overallScore": <number 0-10>
}

Be precise with your ratings. Use decimal values if needed (e.g., 7.5, 8.2). Return ONLY valid JSON, no additional text or explanation.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert behavioral interview evaluator. Always return valid JSON only with precise numerical ratings.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `OpenAI API error: ${response.status} ${response.statusText}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content in OpenAI response' }, { status: 500 });
    }

    // Parse the JSON response
    const result: RatingResult = JSON.parse(content);

    // Validate and normalize the response
    const ratingResult: RatingResult = {
      specificity: Math.max(0, Math.min(10, Number(result.specificity) || 0)),
      depth: Math.max(0, Math.min(10, Number(result.depth) || 0)),
      behavioralEvidence: Math.max(0, Math.min(10, Number(result.behavioralEvidence) || 0)),
      novelty: Math.max(0, Math.min(10, Number(result.novelty) || 0)),
      overallScore: Math.max(0, Math.min(10, Number(result.overallScore) || 0)),
    };

    return NextResponse.json(ratingResult);
  } catch (error: any) {
    console.error('Error rating answer:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

