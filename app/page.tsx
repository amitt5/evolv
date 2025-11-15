'use client';

import { useState, useEffect, useRef } from 'react';
import { QuestionList } from '@/components/question-list';
import { CallPanel } from '@/components/call-panel';
import type { Question, RatingMetrics } from '@/types';
import { INITIAL_QUESTIONS } from '@/lib/data';
import Vapi from '@vapi-ai/web';

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
    });

    vapi.on('message', (message: any) => {
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
      if (vapiRef.current) {
        vapiRef.current.stop();
        vapiRef.current = null;
      }
    };
  }, []);

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
          specificity: Math.random() * 10,
          depth: Math.random() * 10,
          behavioralEvidence: Math.random() * 10,
          novelty: Math.random() * 10,
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
                const scoreBoost = metrics.overallScore;
                return {
                  ...q,
                  lastScore: q.score,
                  score: Math.min(100, q.score + scoreBoost),
                };
              }
              return q;
            })
            .sort((a, b) => b.score - a.score);

          const lowestScore = updated.length > 0 ? updated[updated.length - 1].score : 100;
          if (lowestScore < 30) {
            return updated.map((q) =>
              q.score === lowestScore && q.status === 'ACTIVE'
                ? { ...q, status: 'RETIRED' }
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

    // Start Vapi call
    try {
      vapiRef.current.start(assistantId);
      setVapiError(null);
      // Optionally start simulation alongside the call
      // setIsSimulating(true);
    } catch (error: any) {
      console.error('Error starting Vapi call:', error);
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
                <h1 className="text-3xl font-bold text-foreground mb-2">Interview Ranker</h1>
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
        />
      )}

      {/* Right Panel: Questions List - Always Visible */}
      <QuestionList questions={questions} />
    </div>
  );
}
