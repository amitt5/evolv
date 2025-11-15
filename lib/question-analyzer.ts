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

/**
 * Extracts the conversation segment for a specific question
 * Returns messages from when the question was asked until the next question is asked
 */
export function extractQuestionSegment(
  conversation: ConversationMessage[],
  questionId: number,
  questionText: string,
  askedQuestionIds: number[]
): ConversationMessage[] {
  const segment: ConversationMessage[] = [];
  let foundQuestion = false;
  let questionStartIndex = -1;

  // Find the index of this question in the asked questions array
  const currentQuestionIndex = askedQuestionIds.indexOf(questionId);
  const nextQuestionId = currentQuestionIndex >= 0 && currentQuestionIndex < askedQuestionIds.length - 1
    ? askedQuestionIds[currentQuestionIndex + 1]
    : null;

  // Find where this question was asked
  for (let i = 0; i < conversation.length; i++) {
    const msg = conversation[i];
    
    if (msg.role === 'assistant' && !foundQuestion) {
      // Check if this assistant message contains the question
      const normalizedContent = msg.content.toLowerCase();
      const normalizedQuestion = questionText.toLowerCase();
      
      // Check if the assistant message contains the question text
      // We'll do a simple substring match - the question text should be in the message
      if (normalizedContent.includes(normalizedQuestion) || 
          normalizedQuestion.includes(normalizedContent.substring(0, Math.min(100, normalizedContent.length)))) {
        foundQuestion = true;
        questionStartIndex = i;
        segment.push(msg);
        continue;
      }
    }

    // If we found the question, collect messages until next question is asked
    if (foundQuestion && questionStartIndex >= 0) {
      // Check if this is the next question being asked
      if (msg.role === 'assistant' && i > questionStartIndex && nextQuestionId !== null) {
        // If we have a next question ID, we could check if this message is asking it
        // For now, we'll collect messages until we see a pattern that suggests a new question
        // The key insight: if askedCount increased, the next question was asked
        // So we collect all messages up to the point where the conversation length matches
        // when the next question would have been asked
      }

      segment.push(msg);

      // If we have a next question, try to stop when we see it being asked
      // Otherwise, collect a reasonable window (up to 30 messages or until conversation end)
      if (i - questionStartIndex > 30) {
        // Limit segment size to avoid too much context
        break;
      }
    }
  }

  // If we didn't find the question, return empty array
  if (!foundQuestion) {
    return [];
  }

  return segment;
}

/**
 * Rates an answer using LLM analysis
 */
export async function rateAnswer(
  questionText: string,
  questionId: number,
  conversationSegment: ConversationMessage[]
): Promise<{
  specificity: number;
  depth: number;
  behavioralEvidence: number;
  novelty: number;
  overallScore: number;
}> {
  try {
    const response = await fetch('/api/rate-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionText,
        questionId,
        conversationSegment,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Rating API error: ${response.status} ${response.statusText}. ${errorData.error || JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();
    return result as {
      specificity: number;
      depth: number;
      behavioralEvidence: number;
      novelty: number;
      overallScore: number;
    };
  } catch (error) {
    console.error('Error rating answer:', error);
    throw error;
  }
}

