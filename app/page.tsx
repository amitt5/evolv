'use client';

import { useState, useEffect } from 'react';
import { QuestionList } from '@/components/question-list';
import { CallPanel } from '@/components/call-panel';
import type { Question, RatingMetrics } from '@/types';
import { INITIAL_QUESTIONS } from '@/lib/data';

export default function Page() {
  const [callStarted, setCallStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [lastQuestionId, setLastQuestionId] = useState<number | null>(null);
  const [ratingMetrics, setRatingMetrics] = useState<RatingMetrics | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

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

          const lowestScore = updated[updated.length > 0 ? updated[updated.length - 1].score : 100];
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
    setCallStarted(true);
    setIsSimulating(true);
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
              <button
                onClick={handleStartCall}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-lg"
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
        />
      )}

      {/* Right Panel: Questions List - Always Visible */}
      <QuestionList questions={questions} />
    </div>
  );
}
