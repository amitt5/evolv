'use client';

import { useEffect, useState } from 'react';
import type { Question, RatingMetrics } from '@/types';

interface CallPanelProps {
  questionId: number | null;
  currentQuestion: Question | undefined;
  lastQuestion: Question | undefined;
  ratingMetrics: RatingMetrics | null;
  showRating: boolean;
}

export function CallPanel({ questionId, currentQuestion, lastQuestion, ratingMetrics, showRating }: CallPanelProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [questionId]);

  const RatingBar = ({ label, score }: { label: string; score: number }) => {
    const percentage = (score / 10) * 100;
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{score.toFixed(1)}</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 border-r border-border bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex flex-col p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Interview Ranker</h1>
        <p className="text-muted-foreground mt-2">Live question ranking simulation</p>
      </div>

      {/* Content - Two Sections */}
      <div className="flex-1 flex flex-col gap-8">
        {/* Respondent Info */}
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
              <span className="text-2xl font-bold text-white">A</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">RESPONDENT</p>
              <p className="text-lg font-semibold text-foreground">Alex Johnson</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-8 overflow-y-auto">
          {/* Top Section: Current Question */}
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Current Question
            </p>
            {currentQuestion ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-border shadow-sm">
                <p className="text-lg font-medium text-foreground leading-relaxed">
                  {currentQuestion.question}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Listening for response...
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Simulation complete</p>
                <p className="text-sm text-muted-foreground mt-2">
                  All questions have been ranked
                </p>
              </div>
            )}
          </div>

          {/* Bottom Section: Question Just Answered with Ratings */}
          <div className="flex-1 border-t border-border pt-8">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Question Just Answered
            </p>
            {ratingMetrics && lastQuestion ? (
              <div className="space-y-6">
                <p className="text-base font-medium text-foreground leading-relaxed">
                  "{lastQuestion.question}"
                </p>

                {/* Rating Metrics */}
                <div className="space-y-4">
                  <RatingBar label="├─ Specificity" score={ratingMetrics.specificity} />
                  <RatingBar label="├─ Depth" score={ratingMetrics.depth} />
                  <RatingBar label="├─ Behavioral Evidence" score={ratingMetrics.behavioralEvidence} />
                  <RatingBar label="└─ Novelty" score={ratingMetrics.novelty} />
                </div>

                {/* Overall Score */}
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Overall Insight Score</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {ratingMetrics.overallScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Waiting for first response rating...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">CALL STATUS</p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {questionId ? (showRating ? 'Rating Response' : 'Question Asked') : 'Completed'}
          </p>
        </div>
      </div>
    </div>
  );
}
