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

/**
 * Analyzes a conversation to determine which questions have been asked and fully answered
 * @param conversation - Array of conversation messages with roles
 * @param questionBank - Array of questions that were sent to the interview
 * @returns Object containing arrays of question IDs that were asked and answered
 */
export async function analyzeQuestionStatus(
  conversation: ConversationMessage[],
  questionBank: Question[]
): Promise<QuestionAnalysisResult> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Please set NEXT_PUBLIC_OPENAI_API_KEY in your .env file.');
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

  try {
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
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse the JSON response
    const result: QuestionAnalysisResult = JSON.parse(content);

    // Validate and normalize the response
    return {
      askedQuestions: Array.isArray(result.askedQuestions)
        ? result.askedQuestions.map((id) => Number(id)).filter((id) => !isNaN(id))
        : [],
      answeredQuestions: Array.isArray(result.answeredQuestions)
        ? result.answeredQuestions.map((id) => Number(id)).filter((id) => !isNaN(id))
        : [],
    };
  } catch (error) {
    console.error('Error analyzing questions with OpenAI:', error);
    throw error;
  }
}

