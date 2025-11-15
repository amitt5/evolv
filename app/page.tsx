'use client';

import { useState, useEffect } from 'react';
import { QuestionList } from '@/components/question-list';
import { CallPanel } from '@/components/call-panel';
import type { Question, RatingMetrics } from '@/types';
import { INITIAL_QUESTIONS } from '@/lib/data';

export default function Page() {
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [lastQuestionId, setLastQuestionId] = useState<number | null>(null);
  const [ratingMetrics, setRatingMetrics] = useState<RatingMetrics | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);

  useEffect(() => {
    if (!isSimulating) return;

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

          const lowestScore = updated[updated.length - 1].score;
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
  }, [isSimulating]);

  const currentQuestion = questions.find((q) => q.id === currentQuestionId);
  const lastQuestion = questions.find((q) => q.id === lastQuestionId);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel: Call Display with Rating */}
      <CallPanel
        questionId={currentQuestionId}
        currentQuestion={currentQuestion}
        lastQuestion={lastQuestion}
        ratingMetrics={ratingMetrics}
        showRating={showRating}
      />

      {/* Right Panel: Questions List */}
      <QuestionList questions={questions} />
    </div>
  );
}
