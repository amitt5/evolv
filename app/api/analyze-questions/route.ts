import { NextRequest, NextResponse } from 'next/server';

interface ConversationMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

interface Question {
  id: number | string;
  text: string;
  strength?: string;
}

interface QuestionAnalysisResult {
  askedQuestions: number[];
  answeredQuestions: number[];
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
    const { conversation, questionBank }: { conversation: ConversationMessage[]; questionBank: Question[] } = body;

    if (!conversation || !Array.isArray(conversation) || !questionBank || !Array.isArray(questionBank)) {
      return NextResponse.json(
        { error: 'Invalid request. Both conversation and questionBank are required.' },
        { status: 400 }
      );
    }

    // Format question bank for the prompt
    const questionBankFormatted = questionBank.map((q) => ({
      id: String(q.id),
      text: q.text,
    }));

    // Format conversation for the prompt
    const conversationFormatted = conversation.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const prompt = `You are analyzing a behavioral interview conversation to track which questions have been asked and fully answered.

Question Bank (the questions available to ask):
${JSON.stringify(questionBankFormatted, null, 2)}

Conversation History:
${JSON.stringify(conversationFormatted, null, 2)}

Your task:
1. Identify which questions from the question bank have been ASKED by the assistant (role: 'assistant')
2. Identify which of those asked questions have been FULLY ANSWERED by the user (role: 'user')

A question is considered "fully answered" if:
- The user provided a substantive response (not just "yes", "no", "ok", etc.)
- The response addresses the question with meaningful content
- The conversation shows a complete question-answer exchange

Return your analysis as a JSON object with this exact structure:
{
  "askedQuestions": [array of question IDs as numbers that were asked],
  "answeredQuestions": [array of question IDs as numbers that were fully answered]
}

Only include question IDs that match the IDs in the question bank. Return empty arrays if no questions match.
Return ONLY valid JSON, no additional text or explanation.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using a cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes interview conversations. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        response_format: { type: 'json_object' }, // Force JSON response
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
      return NextResponse.json(
        { error: 'No content in OpenAI response' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    const result: QuestionAnalysisResult = JSON.parse(content);

    // Validate and normalize the response
    const analysisResult: QuestionAnalysisResult = {
      askedQuestions: Array.isArray(result.askedQuestions)
        ? result.askedQuestions.map((id) => Number(id)).filter((id) => !isNaN(id))
        : [],
      answeredQuestions: Array.isArray(result.answeredQuestions)
        ? result.answeredQuestions.map((id) => Number(id)).filter((id) => !isNaN(id))
        : [],
    };

    return NextResponse.json(analysisResult);
  } catch (error: any) {
    console.error('Error analyzing questions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

