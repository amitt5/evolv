'use client';

import type { Question } from '@/types';

interface QuestionListProps {
  questions: Question[];
}

export function QuestionList({ questions }: QuestionListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'retired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
    }
  };

  const formatScore = (score: number) => {
    return score > 0 ? (score / 100).toFixed(2) : '—';
  };

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700">
        <h2 className="text-xl font-bold text-foreground">Question Rankings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time effectiveness scores
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          {/* Table Header */}
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-foreground w-12">Rank</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground flex-1">Question</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-20">Last</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-20">Avg</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground w-24">Status</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {questions.map((question, index) => (
              <tr
                key={question.id}
                className="border-b border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <td className="px-4 py-3 font-bold text-foreground">{index + 1}</td>
                <td className="px-4 py-3 text-foreground line-clamp-2">{question.text}</td>
                <td className="px-4 py-3 text-center text-foreground font-mono">
                  {formatScore(question.lastScore)}
                </td>
                <td className="px-4 py-3 text-center text-foreground font-mono font-semibold">
                  {formatScore(question.score)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      question.status
                    )}`}
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
      <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-800 text-xs text-muted-foreground">
        <p>Questions are retired when effectiveness drops below 30%</p>
      </div>
    </div>
  );
}
