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
 * This function calls a server-side API route to securely handle the OpenAI API call
 * @param conversation - Array of conversation messages with roles
 * @param questionBank - Array of questions that were sent to the interview
 * @returns Object containing arrays of question IDs that were asked and answered
 */
export async function analyzeQuestionStatus(
  conversation: ConversationMessage[],
  questionBank: Question[]
): Promise<QuestionAnalysisResult> {
  try {
    const response = await fetch('/api/analyze-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation,
        questionBank,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API error: ${response.status} ${response.statusText}. ${errorData.error || JSON.stringify(errorData)}`
      );
    }

    const result: QuestionAnalysisResult = await response.json();
    return result;
  } catch (error) {
    console.error('Error analyzing questions:', error);
    throw error;
  }
}

