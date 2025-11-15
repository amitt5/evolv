'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QuestionList } from '@/components/question-list';
import { CallPanel } from '@/components/call-panel';
import type { Question, RatingMetrics } from '@/types';
import { INITIAL_QUESTIONS } from '@/lib/data';
import Vapi from '@vapi-ai/web';
import { analyzeQuestionStatus, extractQuestionSegment, rateAnswer } from '@/lib/question-analyzer';

export default function Page() {
  const [callStarted, setCallStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [lastQuestionId, setLastQuestionId] = useState<number | null>(null);
  const [ratingMetrics, setRatingMetrics] = useState<RatingMetrics | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [vapiError, setVapiError] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<Set<number>>(new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [ratingInProgress, setRatingInProgress] = useState<Set<number>>(new Set());
  const ratingInProgressRef = useRef<Set<number>>(new Set());
  const lastProcessedLengthRef = useRef<number>(0);
  const conversationProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const questionsRef = useRef<Question[]>(questions);
  const previousAnsweredQuestionsRef = useRef<Set<number>>(new Set());
  const conversationHistoryRef = useRef<any[]>([]);

  // Keep questions ref in sync with state
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Keep ratingInProgress ref in sync with state
  useEffect(() => {
    ratingInProgressRef.current = ratingInProgress;
  }, [ratingInProgress]);

  // Process conversation updates with LLM analysis
  const processConversationUpdate = useCallback(async (conversation: any[]) => {
    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return;
    }

    // Only process if conversation has new messages
    if (conversation.length <= lastProcessedLengthRef.current) {
      return;
    }

    // Clear any pending timeout
    if (conversationProcessingTimeoutRef.current) {
      clearTimeout(conversationProcessingTimeoutRef.current);
    }

    // Debounce: wait 2 seconds after last update before processing
    conversationProcessingTimeoutRef.current = setTimeout(async () => {
      try {
        // Get current question bank from ref (always latest)
        const activeQuestions = questionsRef.current.filter((q) => q.status === 'active');
        
        if (activeQuestions.length === 0) {
          console.log('No active questions to analyze');
          return;
        }

        // Format question bank for analysis
        const questionBank = activeQuestions.map((q) => ({
          id: q.id,
          text: q.text,
          strength: q.strength,
        }));

        console.log('🔍 Analyzing conversation with LLM...');
        console.log('Conversation length:', conversation.length);
        console.log('Question bank:', questionBank);

        // Store conversation history for segment extraction
        conversationHistoryRef.current = conversation;

        // Call LLM to analyze
        const result = await analyzeQuestionStatus(conversation, questionBank);

        // Log LLM response
        console.log('✅ LLM Analysis Result:', {
          askedQuestions: result.askedQuestions,
          answeredQuestions: result.answeredQuestions,
          askedCount: result.askedQuestions.length,
          answeredCount: result.answeredQuestions.length,
        });

        // Detect newly answered questions
        const currentAnsweredSet = new Set(result.answeredQuestions);
        const previousAnsweredSet = previousAnsweredQuestionsRef.current;
        const newlyAnsweredQuestions = result.answeredQuestions.filter(
          (id) => !previousAnsweredSet.has(id)
        );

        // Update state
        setAskedQuestions(new Set(result.askedQuestions));
        setAnsweredQuestions(currentAnsweredSet);
        previousAnsweredQuestionsRef.current = currentAnsweredSet;

        // Update last processed length
        lastProcessedLengthRef.current = conversation.length;

        // Log which specific questions were asked/answered
        if (result.askedQuestions.length > 0) {
          const askedQuestionTexts = result.askedQuestions
            .map((id) => {
              const q = activeQuestions.find((q) => q.id === id);
              return q ? `ID ${id}: "${q.text}"` : `ID ${id}`;
            })
            .join(', ');
          console.log('📋 Asked Questions:', askedQuestionTexts);
        }

        if (result.answeredQuestions.length > 0) {
          const answeredQuestionTexts = result.answeredQuestions
            .map((id) => {
              const q = activeQuestions.find((q) => q.id === id);
              return q ? `ID ${id}: "${q.text}"` : `ID ${id}`;
            })
            .join(', ');
          console.log('✅ Fully Answered Questions:', answeredQuestionTexts);
        }

        // Rate newly answered questions
        if (newlyAnsweredQuestions.length > 0) {
          console.log('🎯 Newly answered questions detected:', newlyAnsweredQuestions);
          
          // Rate each newly answered question
          for (const questionId of newlyAnsweredQuestions) {
            // Skip if already rating this question
            if (ratingInProgressRef.current.has(questionId)) {
              continue;
            }

            const question = activeQuestions.find((q) => q.id === questionId);
            if (!question) {
              console.warn(`Question ${questionId} not found in active questions`);
              continue;
            }

            // Mark as in progress
            ratingInProgressRef.current.add(questionId);
            setRatingInProgress(new Set(ratingInProgressRef.current));

            // Extract conversation segment for this question
            const segment = extractQuestionSegment(
              conversation,
              questionId,
              question.text,
              result.askedQuestions
            );

            if (segment.length === 0) {
              console.warn(`Could not extract conversation segment for question ${questionId}`);
              ratingInProgressRef.current.delete(questionId);
              setRatingInProgress(new Set(ratingInProgressRef.current));
              continue;
            }

            console.log(`📊 Rating question ${questionId}: "${question.text}"`);
            console.log(`   Segment length: ${segment.length} messages`);

            // Rate the answer
            rateAnswer(question.text, questionId, segment)
              .then((metrics: RatingMetrics) => {
                console.log(`⭐ Rating for question ${questionId}:`, {
                  specificity: metrics.specificity,
                  depth: metrics.depth,
                  behavioralEvidence: metrics.behavioralEvidence,
                  novelty: metrics.novelty,
                  overallScore: metrics.overallScore,
                });

                // Update question state with ratings using weighted average
                setQuestions((prev) => {
                  const updated = prev
                    .map((q) => {
                      if (q.id === questionId) {
                        const newRating = metrics.overallScore;
                        const currentRatingCount = q.ratingCount || 0;
                        const currentScore = q.score;
                        
                        // Calculate weighted average: (ratingCount * currentScore + newRating) / (ratingCount + 1)
                        const newScore = currentRatingCount === 0
                          ? newRating // First rating
                          : (currentRatingCount * currentScore + newRating) / (currentRatingCount + 1);
                        
                        return {
                          ...q,
                          lastScore: q.score,
                          score: Math.min(100, Math.max(0, newScore)), // Cap between 0-100
                          ratingCount: currentRatingCount + 1,
                        };
                      }
                      return q;
                    })
                    .sort((a, b) => b.score - a.score);

                  // Check for retirement
                  const lowestScore = updated.length > 0 ? updated[updated.length - 1].score : 100;
                  if (lowestScore < 30) {
                    return updated.map((q) =>
                      q.score === lowestScore && q.status === 'active'
                        ? { ...q, status: 'retired' }
                        : q
                    );
                  }

                  return updated;
                });

                // Update UI to show rating for this question
                setLastQuestionId(questionId);
                setRatingMetrics(metrics);
                setShowRating(true);
                setCurrentQuestionId(null); // Clear current question since it's now answered

                // Remove from in-progress
                ratingInProgressRef.current.delete(questionId);
                setRatingInProgress(new Set(ratingInProgressRef.current));
              })
              .catch((error) => {
                console.error(`❌ Error rating question ${questionId}:`, error);
                ratingInProgressRef.current.delete(questionId);
                setRatingInProgress(new Set(ratingInProgressRef.current));
              });
          }
        }
      } catch (error) {
        console.error('❌ Error processing conversation update:', error);
        // Don't throw - just log the error so it doesn't break the app
      }
    }, 500); // 2 second debounce
  }, []);

  // Initialize Vapi
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!apiKey || !assistantId) {
      setVapiError('Vapi API Key or Assistant ID not configured. Please set NEXT_PUBLIC_VAPI_API_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID in your .env.local file.');
      return;
    }

    // Initialize Vapi instance
    const vapi = new Vapi(apiKey);
    vapiRef.current = vapi;

    // Set up event listeners
    vapi.on('call-start', () => {
      console.log('Vapi call started');
      setIsConnected(true);
      setCallStarted(true);
    });

    vapi.on('call-end', () => {
      console.log('Vapi call ended');
      setIsConnected(false);
      setCallStarted(false);
      setIsSimulating(false);
      // Clear any pending conversation processing
      if (conversationProcessingTimeoutRef.current) {
        clearTimeout(conversationProcessingTimeoutRef.current);
        conversationProcessingTimeoutRef.current = null;
      }
      // Reset tracking
      lastProcessedLengthRef.current = 0;
      previousAnsweredQuestionsRef.current = new Set();
      ratingInProgressRef.current.clear();
      setRatingInProgress(new Set());
    });

    vapi.on('message', (message: any) => {
      if (message.type === 'conversation-update') {
        console.log('Conversation update:', message.conversation);
        // Process conversation to track asked/answered questions
        if (message.conversation && Array.isArray(message.conversation)) {
          processConversationUpdate(message.conversation);
        }
      }
      console.log('Message:', message.type, message);
      if (message.type === 'transcript') {
        console.log(`${message.role}: ${message.transcript}`);
        // You can process transcripts here if needed
      }
    });

    vapi.on('speech-start', () => {
      console.log('Assistant started speaking');
    });

    vapi.on('speech-end', () => {
      console.log('Assistant stopped speaking');
    });

    vapi.on('error', (error: any) => {
      console.error('Vapi error:', error);
      setVapiError(error.message || 'An error occurred with Vapi');
    });

    // Cleanup on unmount
    return () => {
      if (conversationProcessingTimeoutRef.current) {
        clearTimeout(conversationProcessingTimeoutRef.current);
        conversationProcessingTimeoutRef.current = null;
      }
      if (vapiRef.current) {
        vapiRef.current.stop();
        vapiRef.current = null;
      }
    };
  }, [processConversationUpdate]);

  // Simulation logic (can run alongside or instead of Vapi)
  useEffect(() => {
    if (!isSimulating || !callStarted) return;

    let questionIndex = 0;

    const runSimulation = async () => {
      while (questionIndex < INITIAL_QUESTIONS.length) {
        const currentQuestion = INITIAL_QUESTIONS[questionIndex];

        setCurrentQuestionId(currentQuestion.id);
        setShowRating(false);
        setRatingMetrics(null);

        // Wait 2 seconds for respondent to answer
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const metrics: RatingMetrics = {
          specificity: Math.random() * 100,
          depth: Math.random() * 100,
          behavioralEvidence: Math.random() * 100,
          novelty: Math.random() * 100,
          overallScore: 0,
        };
        metrics.overallScore = (metrics.specificity + metrics.depth + metrics.behavioralEvidence + metrics.novelty) / 4;

        setLastQuestionId(currentQuestion.id);
        setRatingMetrics(metrics);
        setShowRating(true);

        setQuestions((prev) => {
          const updated = prev
            .map((q) => {
              if (q.id === currentQuestion.id) {
                const newRating = metrics.overallScore;
                const currentRatingCount = q.ratingCount || 0;
                const currentScore = q.score;
                
                // Calculate weighted average: (ratingCount * currentScore + newRating) / (ratingCount + 1)
                const newScore = currentRatingCount === 0
                  ? newRating // First rating
                  : (currentRatingCount * currentScore + newRating) / (currentRatingCount + 1);
                
                return {
                  ...q,
                  lastScore: q.score,
                  score: Math.min(100, Math.max(0, newScore)), // Cap between 0-100
                  ratingCount: currentRatingCount + 1,
                };
              }
              return q;
            })
            .sort((a, b) => b.score - a.score);

          const lowestScore = updated.length > 0 ? updated[updated.length - 1].score : 100;
          if (lowestScore < 30) {
            return updated.map((q) =>
              q.score === lowestScore && q.status === 'active'
                ? { ...q, status: 'retired' }
                : q
            );
          }

          return updated;
        });

        questionIndex++;

        // Wait 2 seconds before next question
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      setIsSimulating(false);
      setCurrentQuestionId(null);
      setShowRating(false);
      setRatingMetrics(null);
    };

    runSimulation();
  }, [isSimulating, callStarted]);

  const handleStartCall = () => {
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!apiKey || !assistantId) {
      setVapiError('Vapi API Key or Assistant ID not configured. Please set NEXT_PUBLIC_VAPI_API_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID in your .env.local file.');
      return;
    }

    if (!vapiRef.current) {
      setVapiError('Vapi not initialized. Please refresh the page.');
      return;
    }

    // Get current questions state - ensure we're using the latest state
    const activeQuestions = questions.filter((q) => q.status === 'active');
    
    // Validate that we have questions to send
    if (activeQuestions.length === 0) {
      setVapiError('No active questions available. Please ensure questions are marked as active.');
      console.error('No active questions found. All questions:', questions);
      return;
    }

    // Debug: Log the questions state before mapping
    console.log('=== VAPI CALL START - Questions Debug ===');
    console.log('Total questions in state:', questions.length);
    console.log('Active questions count:', activeQuestions.length);
    console.log('Questions state before mapping:', questions);
    console.log('Active questions before mapping:', activeQuestions);

    // Format questions for Vapi question_bank variable
    // The prompt expects a JSON array with id (string) and text (string)
    const questionBank = activeQuestions
      .map((q) => {
        // Validate question has required fields
        if (!q.id || !q.text || q.text.trim() === '') {
          console.warn('Skipping invalid question:', q);
          return null;
        }
        
        // Explicitly construct the object to ensure all properties are included
        const mapped: { id: string; text: string; strength?: string } = {
          id: String(q.id),
          text: q.text.trim(), // Ensure text is always included and trimmed
        };
        if (q.strength) {
          mapped.strength = q.strength;
        }
        console.log('Mapping question:', { id: q.id, text: q.text }, 'to:', mapped);
        return mapped;
      })
      .filter((q): q is { id: string; text: string; strength?: string } => q !== null);

    // Final validation
    if (questionBank.length === 0) {
      setVapiError('No valid questions to send. Please check your questions have valid text.');
      console.error('No valid questions after mapping. Original questions:', activeQuestions);
      return;
    }

    // Generate a unique cache-busting timestamp to prevent VAPI from using cached questions
    const cacheBuster = Date.now();
    const questionBankWithTimestamp = {
      questions: questionBank,
      timestamp: cacheBuster,
      version: '1.0',
    };

    // Log the questions being sent to Vapi
    // console.log('=== Sending to VAPI ===');
    // console.log('Question bank array:', questionBank);
    // console.log('Question bank count:', questionBank.length);
    // console.log('Question bank JSON string:', JSON.stringify(questionBank));
    // console.log('Cache buster timestamp:', cacheBuster);
    // console.log('Full payload:', JSON.stringify(questionBankWithTimestamp));

    // Start Vapi call with question_bank variable
    // The prompt expects question_bank as a JSON array string
    // We're passing both the question array and a cache-busting timestamp
    try {
      vapiRef.current.start(assistantId, {
        variableValues: {
          // Pass the questions array as JSON string (primary format)
          question_bank: JSON.stringify(questionBank),
          // Add cache buster to force refresh and prevent using cached questions
          cache_buster: String(cacheBuster),
          // Also pass timestamp for additional cache prevention
          timestamp: String(cacheBuster),
        },
      });
      setVapiError(null);
      console.log('✅ VAPI call started successfully with', questionBank.length, 'questions');
      // Optionally start simulation alongside the call
      // setIsSimulating(true);
    } catch (error: any) {
      console.error('❌ Error starting Vapi call:', error);
      setVapiError(error.message || 'Failed to start call');
    }
  };

  const handleEndCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
    setCallStarted(false);
    setIsSimulating(false);
    setIsConnected(false);
  };

  const currentQuestion = questions.find((q) => q.id === currentQuestionId);
  const lastQuestion = questions.find((q) => q.id === lastQuestionId);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel: Call Display with Rating */}
      {!callStarted ? (
        <div className="flex-1 border-r border-border bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex flex-col p-8">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center space-y-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Self evolving interview agent</h1>
                <p className="text-muted-foreground">Live question ranking simulation</p>
              </div>
              {vapiError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{vapiError}</p>
                </div>
              )}
              <button
                onClick={handleStartCall}
                disabled={!!vapiError}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-lg"
              >
                Start Call
              </button>
            </div>
          </div>
        </div>
      ) : (
        <CallPanel
          questionId={currentQuestionId}
          currentQuestion={currentQuestion}
          lastQuestion={lastQuestion}
          ratingMetrics={ratingMetrics}
          showRating={showRating}
          onEndCall={handleEndCall}
          isConnected={isConnected}
          askedQuestions={askedQuestions}
          answeredQuestions={answeredQuestions}
          ratingInProgress={ratingInProgress}
          questions={questions}
        />
      )}

      {/* Right Panel: Questions List - Always Visible */}
      <QuestionList questions={questions} />
    </div>
  );
}
