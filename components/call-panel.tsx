'use client';

import { useEffect, useState, useRef } from 'react';
import type { Question, RatingMetrics } from '@/types';

interface CallPanelProps {
  questionId: number | null;
  currentQuestion: Question | undefined;
  lastQuestion: Question | undefined;
  ratingMetrics: RatingMetrics | null;
  showRating: boolean;
  onEndCall?: () => void;
  isConnected?: boolean;
  askedQuestions?: Set<number>;
  answeredQuestions?: Set<number>;
  ratingInProgress?: Set<number>;
  questions?: Question[];
  vapiTranscript?: Array<{
    created_at: string;
    sender_type?: string;
    metadata?: { isVoice?: boolean };
  }>;
  isCallActive?: boolean;
}

export function CallPanel({
  questionId,
  currentQuestion,
  lastQuestion,
  ratingMetrics,
  showRating,
  onEndCall,
  isConnected,
  askedQuestions = new Set(),
  answeredQuestions = new Set(),
  ratingInProgress = new Set(),
  questions = [],
  vapiTranscript = [],
  isCallActive = false,
}: CallPanelProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState({
    isUserSpeaking: false,
    isAiSpeaking: false,
    userLevel: 0,
    aiLevel: 0
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevVoiceActivityRef = useRef(voiceActivity);
  const vapiTranscriptRef = useRef(vapiTranscript);

  // Sync refs with latest values
  useEffect(() => {
    prevVoiceActivityRef.current = voiceActivity;
  }, [voiceActivity]);

  useEffect(() => {
    vapiTranscriptRef.current = vapiTranscript;
  }, [vapiTranscript]);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [questionId]);

  // Calculate voice activity bar heights based on real voice activity
  const getVoiceBarHeights = () => {
    const { isUserSpeaking, isAiSpeaking, userLevel, aiLevel } = voiceActivity;
    
    if (!isUserSpeaking && !isAiSpeaking) {
      // Silent state - all bars low
      return [20, 25, 30, 25, 20];
    }
    
    if (isUserSpeaking && isAiSpeaking) {
      // Both speaking - mixed pattern
      const userIntensity = Math.min(userLevel * 0.8, 1);
      const aiIntensity = Math.min(aiLevel * 0.6, 1);
      return [
        30 + (userIntensity * 40),
        40 + (aiIntensity * 35),
        50 + (Math.max(userIntensity, aiIntensity) * 40),
        40 + (aiIntensity * 35),
        30 + (userIntensity * 40)
      ];
    }
    
    if (isUserSpeaking) {
      // User speaking - higher activity
      const intensity = Math.min(userLevel * 0.9, 1);
      return [
        40 + (intensity * 40),
        50 + (intensity * 35),
        60 + (intensity * 35),
        50 + (intensity * 35),
        40 + (intensity * 40)
      ];
    }
    
    if (isAiSpeaking) {
      // AI speaking - moderate activity
      const intensity = Math.min(aiLevel * 0.7, 1);
      return [
        25 + (intensity * 35),
        35 + (intensity * 30),
        45 + (intensity * 30),
        35 + (intensity * 30),
        25 + (intensity * 35)
      ];
    }
    
    return [20, 25, 30, 25, 20];
  };

  // Track voice activity based on VAPI events
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isCallActive && !isConnected) {
      // Reset voice activity when call is not active
      setVoiceActivity(prev => {
        if (prev.isUserSpeaking || prev.isAiSpeaking || prev.userLevel > 0 || prev.aiLevel > 0) {
          return {
            isUserSpeaking: false,
            isAiSpeaking: false,
            userLevel: 0,
            aiLevel: 0
          };
        }
        return prev;
      });
      return;
    }

    // Listen to VAPI transcript events to detect voice activity
    const handleVoiceActivity = () => {
      // Check recent messages to determine who is speaking
      const recentMessages = vapiTranscriptRef.current.slice(-3); // Last 3 messages
      const now = Date.now();
      const recentThreshold = 3000; // 3 seconds

      let isUserSpeaking = false;
      let isAiSpeaking = false;
      let userLevel = 0;
      let aiLevel = 0;

      recentMessages.forEach((message: any) => {
        const messageTime = new Date(message.created_at).getTime();
        const isRecent = (now - messageTime) < recentThreshold;
        
        if (isRecent && message.metadata?.isVoice) {
          if (message.sender_type === 'respondent') {
            isUserSpeaking = true;
            userLevel = Math.min(0.8 + Math.random() * 0.2, 1); // Simulate voice level
          } else if (message.sender_type === 'moderator') {
            isAiSpeaking = true;
            aiLevel = Math.min(0.6 + Math.random() * 0.3, 1); // Simulate voice level
          }
        }
      });

      // Only update if values actually changed
      const newVoiceActivity = {
        isUserSpeaking,
        isAiSpeaking,
        userLevel,
        aiLevel
      };

      const prev = prevVoiceActivityRef.current;
      if (
        prev.isUserSpeaking !== newVoiceActivity.isUserSpeaking ||
        prev.isAiSpeaking !== newVoiceActivity.isAiSpeaking ||
        Math.abs(prev.userLevel - newVoiceActivity.userLevel) > 0.1 ||
        Math.abs(prev.aiLevel - newVoiceActivity.aiLevel) > 0.1
      ) {
        prevVoiceActivityRef.current = newVoiceActivity;
        setVoiceActivity(newVoiceActivity);
      }
    };

    // Update voice activity when messages change
    handleVoiceActivity();

    // Set up interval to update voice activity
    intervalRef.current = setInterval(handleVoiceActivity, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCallActive, isConnected]); // Remove vapiTranscript from dependencies, use ref instead

  const RatingBar = ({ label, score }: { label: string; score: number }) => {
    // Score is now on a 0-100 scale, so percentage = score
    const percentage = Math.min(100, Math.max(0, score));
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

        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          {/* Question Status Section */}

          
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-border shadow-sm">
          {/* Voice Activity Indicator */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Voice Activity
            </p>
            
            {/* Voice Activity Bars - only show when call is active */}
            {(isCallActive || isConnected) && (
              <div className="flex items-end justify-center space-x-2 h-20 mb-4">
                {getVoiceBarHeights().map((height, index) => {
                  const { isUserSpeaking, isAiSpeaking } = voiceActivity;
                  let barColor = 'bg-purple-600 dark:bg-purple-500'; // Default color
                  
                  if (isUserSpeaking && !isAiSpeaking) {
                    barColor = 'bg-red-500 dark:bg-red-400'; // User speaking - red
                  } else if (isAiSpeaking && !isUserSpeaking) {
                    barColor = 'bg-purple-600 dark:bg-purple-500'; // AI speaking - purple
                  } else if (isUserSpeaking && isAiSpeaking) {
                    barColor = 'bg-orange-500 dark:bg-orange-400'; // Both speaking - orange
                  }
                  
                  return (
                    <div 
                      key={index}
                      className={`w-3 ${barColor} rounded-full transition-all duration-300 ease-in-out`}
                      style={{ 
                        height: `${height}%`
                      }}
                    ></div>
                  );
                })}
              </div>
            )}

            {/* Voice Activity Status */}
            {(isCallActive || isConnected) && (
              <div className="text-center mb-4">
                {voiceActivity.isUserSpeaking && !voiceActivity.isAiSpeaking && (
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    User Speaking
                  </p>
                )}
                {voiceActivity.isAiSpeaking && !voiceActivity.isUserSpeaking && (
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    AI Moderator Speaking
                  </p>
                )}
                {voiceActivity.isUserSpeaking && voiceActivity.isAiSpeaking && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                    Both Speaking
                  </p>
                )}
                {!voiceActivity.isUserSpeaking && !voiceActivity.isAiSpeaking && (
                  <p className="text-sm text-muted-foreground">
                    Listening...
                  </p>
                )}
              </div>
            )}
            
            {/* Asked Questions */}
            {/* <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Asked Questions</span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {askedQuestions.size}
                </span>
              </div>
              {askedQuestions.size > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {Array.from(askedQuestions)
                    .map((id) => {
                      const question = questions.find((q) => q.id === id);
                      const isAnswered = answeredQuestions.has(id);
                      const isAnalyzing = ratingInProgress.has(id);
                      return (
                        <div
                          key={id}
                          className="flex items-start gap-2 text-sm p-2 rounded bg-slate-50 dark:bg-slate-700/50"
                        >
                          <span className="flex-shrink-0 mt-0.5">
                            {isAnalyzing ? (
                              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            ) : isAnswered ? (
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                            ) : (
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground truncate">
                              {question ? question.text : `Question ${id}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isAnalyzing
                                ? 'Analyzing answer...'
                                : isAnswered
                                  ? 'Answered'
                                  : 'Waiting for answer'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No questions asked yet</p>
              )}
            </div> */}

            {/* Answered Questions */}
            {/* <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Answered Questions</span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {answeredQuestions.size}
                </span>
              </div>
              {answeredQuestions.size > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {Array.from(answeredQuestions)
                    .map((id) => {
                      const question = questions.find((q) => q.id === id);
                      const isAnalyzing = ratingInProgress.has(id);
                      return (
                        <div
                          key={id}
                          className="flex items-start gap-2 text-sm p-2 rounded bg-green-50 dark:bg-green-900/20"
                        >
                          <span className="flex-shrink-0 mt-0.5">
                            {isAnalyzing ? (
                              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            ) : (
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground truncate">
                              {question ? question.text : `Question ${id}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isAnalyzing ? 'Analyzing...' : 'Analysis complete'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No questions answered yet</p>
              )}
            </div> */}
          </div>

          {/* Current Question Section */}
          {/* <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Current Question
            </p>
            {currentQuestion ? (
              <div>
                <p className="text-lg font-medium text-foreground leading-relaxed">
                  {currentQuestion.text}
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
            ) : askedQuestions.size > 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Waiting for next question...</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Interview starting...</p>
              </div>
            )}
          </div> */}

          {/* Analysis Results Section */}
          {showRating && ratingMetrics && lastQuestion && (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-border shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Latest Analysis Result
              </p>
              <div className="space-y-6">
                <p className="text-base font-medium text-foreground leading-relaxed">
                  "{lastQuestion.text}"
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
            </div>
          )}

          {/* Analysis In Progress Indicator */}
          {ratingInProgress.size > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Analyzing {ratingInProgress.size} answer{ratingInProgress.size > 1 ? 's' : ''}...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Status */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="text-center space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">CALL STATUS</p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {isConnected ? (questionId ? (showRating ? 'Rating Response' : 'Question Asked') : 'Connected') : 'Disconnected'}
            </p>
          </div>
          {onEndCall && (
            <button
              onClick={onEndCall}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
            >
              End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
