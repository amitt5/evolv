'use client';

import type { Question } from '@/types';

interface QuestionListProps {
  questions: Question[];
}

export function QuestionList({ questions }: QuestionListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-950/30 text-green-400 border-green-900/50';
      case 'retired':
        return 'bg-red-950/30 text-red-400 border-red-900/50';
      case 'new':
        return 'bg-blue-950/30 text-blue-400 border-blue-900/50';
      default:
        return 'bg-muted/30 text-muted-foreground border-border/50';
    }
  };

  const formatScore = (score: number) => {
    return score > 0 ? (score / 100).toFixed(2) : '—';
  };

  return (
    <div className="flex-1 bg-background border-l border-border/50 flex flex-col">
      {/* Header */}
      <div className="p-8 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Interview brain</h2>
        <p className="text-sm text-muted-foreground mt-2 font-light">
          Real-time effectiveness scores
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          {/* Table Header */}
          <thead className="sticky top-0 bg-card/80 backdrop-blur-sm border-b border-border/50 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-foreground w-12">Rank</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground flex-1">Question</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-20">Last</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-20">Diff</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-20">Avg</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-24">Status</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {questions.map((question, index) => (
              <tr
                key={question.id}
                className="border-b border-border/30 hover:bg-muted/20 transition-colors duration-200"
              >
                <td className="px-4 py-3 font-bold text-foreground">{index + 1}</td>
                <td className="px-4 py-3 text-foreground line-clamp-2">{question.text}</td>
                <td className="px-4 py-3 text-center text-foreground font-mono">
                  {formatScore(question.lastScore)}
                </td>
                <td className="px-4 py-3 text-center text-foreground font-mono">
                  {(() => {
                    const diff = (question.score - question.lastScore) / 100;
                    const formatted = diff.toFixed(2);
                    return diff > 0 ? `+${formatted}` : formatted;
                  })()}
                </td>
                <td className="px-4 py-3 text-center text-foreground font-mono font-semibold">
                  {formatScore(question.score)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(
                      question.status
                    )} border border-current/20`}
                  >
                    {question.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-6 border-t border-border/50 bg-card/30 backdrop-blur-sm text-xs text-muted-foreground">
        <p className="font-light">Questions are retired when effectiveness drops below 30%</p>
      </div>
    </div>
  );
}
