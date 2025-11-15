"use client"
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useVapi, VapiMessage } from "@/hooks/useVapi"
import { processMessagesBatch } from "@/utils/messageProcessor"
import { Mic, MicOff, Phone, PhoneOff, AlertCircle, Play, Square } from "lucide-react"

interface HumanRespondent {
  id: string;
  name: string;
  age: number;
  gender: string;
  email: string;
  status: 'in_progress' | 'completed';
  project: {
    id: string;
    name: string;
    discussion_questions: string[];
    created_at: string;
  };
}

export default function InterviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const humanRespondentId = params.human_respondent_id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondentData, setRespondentData] = useState<HumanRespondent | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState({
    isUserSpeaking: false,
    isAiSpeaking: false,
    userLevel: 0,
    aiLevel: 0
  });

  // VAPI hook integration
  const {
    isCallActive,
    transcript: vapiTranscript,
    error: vapiError,
    isLoading: vapiLoading,
    startInterview,
    stopInterview,
    sendMessage: sendVapiMessage,
    clearError: clearVapiError,
    onCallEnd,
    exportMessageAnalysis,
    onRawMessage
  } = useVapi();

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

  // Combine text messages and VAPI transcript
  const allMessages = useMemo(() => {
    // Only log when there are significant changes
    if (messages.length > 0 || vapiTranscript.length > 0) {
      console.log(`Combining ${messages.length} text messages with ${vapiTranscript.length} VAPI messages`);
    }
    
    // Process database messages to combine consecutive messages from same speaker
    const processedDatabaseMessages = processMessagesBatch(messages);
    console.log(`Processed ${messages.length} database messages into ${processedDatabaseMessages.length} combined messages`);
    
    // Combine processed database messages with VAPI transcript
    const combined = [...processedDatabaseMessages, ...vapiTranscript];
    console.log('combined', combined);
    
    // Sort by created_at timestamp to maintain chronological order
    const sorted = combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return sorted;
  }, [messages, vapiTranscript]);

  // Track voice activity based on VAPI events
  useEffect(() => {
    // Tap raw VAPI message for debugging/logging the exact payload
    onRawMessage((raw) => {
      console.log('[VAPI raw message]', raw);
    });

    if (!isCallActive) {
      // Reset voice activity when call is not active
      setVoiceActivity({
        isUserSpeaking: false,
        isAiSpeaking: false,
        userLevel: 0,
        aiLevel: 0
      });
      return;
    }

    // Listen to VAPI transcript events to detect voice activity
    const handleVoiceActivity = () => {
      // Check recent messages to determine who is speaking
      const recentMessages = allMessages.slice(-3); // Last 3 messages
      const now = Date.now();
      const recentThreshold = 3000; // 3 seconds

      let isUserSpeaking = false;
      let isAiSpeaking = false;
      let userLevel = 0;
      let aiLevel = 0;

      recentMessages.forEach(message => {
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

      setVoiceActivity({
        isUserSpeaking,
        isAiSpeaking,
        userLevel,
        aiLevel
      });
    };

    // Update voice activity when messages change
    handleVoiceActivity();

    // Set up interval to update voice activity
    const interval = setInterval(handleVoiceActivity, 500);

    return () => clearInterval(interval);
  }, [isCallActive, allMessages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/public/human-conversations?human_respondent_id=${humanRespondentId}&project_id=${projectId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching messages: ${response.status}`);
      }
      
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const getAiResponse = async (isFirstMessage: boolean = false) => {
    setIsAiResponding(true);
    try {
      const response = await fetch('/api/public/ai-moderator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          human_respondent_id: humanRespondentId,
          is_first_message: isFirstMessage
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      await fetchMessages(); // Refresh messages to include AI response
    } catch (err) {
      console.error('Error getting AI response:', err);
      setError('Failed to get interviewer response. Please try again.');
    } finally {
      setIsAiResponding(false);
    }
  };

  const markInterviewAsComplete = async () => {
    try {
      const response = await fetch(`/api/public/human-respondents/${humanRespondentId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark interview as complete');
      }

      const data = await response.json();
      console.log('Interview marked as complete:', data);
      setIsInterviewCompleted(true);
      
      // Update the respondent data to reflect the new status
      if (respondentData) {
        setRespondentData({
          ...respondentData,
          status: 'completed'
        });
      }
    } catch (err) {
      console.error('Error marking interview as complete:', err);
      setError('Failed to mark interview as complete. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || isAiResponding) return;

    // If voice call is active, send via VAPI
    if (isCallActive) {
      try {
        await sendVapiMessage(newMessage.trim());
        setNewMessage('');
        return;
      } catch (err) {
        console.error('Error sending VAPI message:', err);
        setError('Failed to send voice message. Please try again.');
        return;
      }
    }

    // Otherwise, send via text (existing functionality)
    setIsSending(true);
    try {
      const response = await fetch('/api/public/human-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          human_respondent_id: humanRespondentId,
          message: newMessage.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      
      // Fetch updated messages after sending
      await fetchMessages();
      
      // Get AI response after sending message
      await getAiResponse();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Voice interview control functions
  const handleStartVoiceInterview = async () => {
    try {
      clearVapiError();
      
      // Get respondent name and discussion guide
      const respondentName = respondentData?.name || 'the respondent';
      const discussionGuide = respondentData?.project?.discussion_questions || [];
      
      console.log('Starting voice interview with:', {
        respondentName,
        discussionGuideCount: discussionGuide.length,
        discussionGuide: discussionGuide,
        projectId,
        humanRespondentId
      });
      
      // Validate that we have the necessary data
      if (!respondentData) {
        throw new Error('Respondent data not available');
      }
      
      if (!respondentData.project) {
        throw new Error('Project data not available');
      }
      
      await startInterview(respondentName, discussionGuide, projectId, humanRespondentId);
    } catch (err) {
      console.error('Failed to start voice interview:', err);
      setError('Failed to start voice interview. Please try again.');
    }
  };

  const handleStopVoiceInterview = async () => {
    try {
      await stopInterview();
    } catch (err) {
      console.error('Failed to stop voice interview:', err);
      setError('Failed to stop voice interview. Please try again.');
    }
  };

  // Voice activity simulation (replace with real VAPI voice detection)
  useEffect(() => {
    if (!isCallActive) {
      setVoiceActivity({
        isUserSpeaking: false,
        isAiSpeaking: false,
        userLevel: 0,
        aiLevel: 0
      });
      return;
    }

    // Simulate voice activity based on AI responding state
    const interval = setInterval(() => {
      setVoiceActivity(prev => {
        // Simulate AI speaking when AI is responding
        if (isAiResponding) {
          return {
            ...prev,
            isAiSpeaking: true,
            aiLevel: Math.random() * 0.8 + 0.2, // 0.2 to 1.0
            isUserSpeaking: false,
            userLevel: 0
          };
        }
        
        // Simulate user speaking occasionally
        if (Math.random() < 0.3) {
          return {
            ...prev,
            isUserSpeaking: true,
            userLevel: Math.random() * 0.9 + 0.1, // 0.1 to 1.0
            isAiSpeaking: false,
            aiLevel: 0
          };
        }
        
        // Silent state
        return {
          ...prev,
          isUserSpeaking: false,
          isAiSpeaking: false,
          userLevel: 0,
          aiLevel: 0
        };
      });
    }, 200); // Update every 200ms for smooth animation

    return () => clearInterval(interval);
  }, [isCallActive, isAiResponding]);

  // Set up callback to mark interview as complete when call ends
  useEffect(() => {
    onCallEnd(() => {
      console.log('Call ended, marking interview as complete');
      markInterviewAsComplete();
    });
  }, [onCallEnd, markInterviewAsComplete]);

  useEffect(() => {
    const fetchRespondentData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/public/human-respondents/${humanRespondentId}`);
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('humandata', data);
        if (data.error) {
          throw new Error(data.error);
        }

        // Verify this respondent belongs to this project
        if (data.project_id !== projectId) {
          throw new Error('Invalid project ID');
        }
        
        setRespondentData(data);
        setError(null);
        
        // Check if interview is already completed
        if (data.status === 'completed') {
          setIsInterviewCompleted(true);
        }
        
        // After loading respondent data, fetch messages (but don't auto-start interview)
        await fetchMessages();
      } catch (err: any) {
        console.error("Failed to fetch respondent data:", err);
        setError(err.message || "Failed to load interview data");
        setRespondentData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRespondentData();
  }, [projectId, humanRespondentId]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-[70vh]">Loading interview...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="text-xl font-semibold text-red-500">Error</div>
        <div className="text-gray-500">{error}</div>
      </div>
    );
  }

  if (!respondentData || !respondentData.project) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="text-xl font-semibold">Interview not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Error Display */}
      {(error || vapiError) && (
        <div className="container mx-auto p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {vapiError || error}
              {vapiError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearVapiError}
                  className="ml-2"
                >
                  Dismiss
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}



        {/* Interview completed layout */}
        {isInterviewCompleted ? (
          <div className="container mx-auto p-4 h-screen flex gap-4">
            {/* Left Section - Completion Message */}
            <div className="w-1/3 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Interview Complete!</h2>
                <p className="text-gray-600">
                  Thank you for participating in this interview. Your responses have been recorded and will be used for research purposes.
                </p>
              </div>
            </div>

            {/* Right Section - Summary */}
            <div className="w-2/3 bg-white border border-gray-200 rounded-lg p-8">
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-800">Interview Summary</h1>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Participant:</span>
                    <span className="font-medium">{respondentData?.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Project:</span>
                    <span className="font-medium">{respondentData?.project?.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Status:</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      Completed
                    </span>
                  </div>
                  
                  {/* <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Messages:</span>
                    <span className="font-medium">{allMessages.length}</span>
                  </div> */}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    This interview has been successfully completed. You can close this window or navigate away.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : allMessages.length === 0 && !isCallActive ? (
          <div className="container mx-auto p-4 h-screen flex gap-4">
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="fixed top-4 right-4 bg-yellow-100 p-2 text-xs">
                Debug: messages={allMessages.length}, isCallActive={isCallActive.toString()}
              </div>
            )}
            {/* Left Section - Placeholder */}
            {/* // uncomment me amit111 */}
            {/* <div className="w-1/3 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-lg">
                  We'll populate images, videos, and more in this space throughout the interview.
                </p>
                <p className="text-gray-500">
                  Stay tuned.
                </p>
              </div>
            </div> */}

            {/* Right Section - Interview Controls */}
            <div className="w-2/3 bg-white border border-gray-200 rounded-lg p-8">
              <div className="space-y-6">
                {/* Header with microphone icon */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Mic className="w-5 h-5 text-purple-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    Your interview is about to begin!
                  </h1>
                </div>

                {/* Instructions */}
                <div className="space-y-4 text-gray-600">
                  <p>
                    Click the "Start Interview" button to begin the interview. Make sure you are in a quiet, focused setting.
                  </p>
                  <p>
                    First you'll be asked to grant permission to use your microphone. Hit "allow" to continue.
                  </p>
                  <p>
                    Once the interview starts, an AI moderator will ask you questions and dynamically respond to your answers. You can stop the interview at any time by hitting the "stop interview" button.
                    
                    {/* You can interrupt the AI moderator at any time by hitting the "interrupt" button and if you need to take a break, just ask the AI moderator to pause the interview until you're ready to proceed. */}
                  </p>
                </div>

                {/* Buttons */}
                <div className="space-y-4">
                  <button
                    onClick={handleStartVoiceInterview}
                    disabled={vapiLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-4 text-lg font-semibold rounded-lg shadow-lg border-0 cursor-pointer"
                  >
                    {vapiLoading ? "Starting..." : "Start Interview"}
                  </button>
                  
                 
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Voice interview layout - always show when not in pre-interview state */
          <div className="container mx-auto p-4 h-screen flex gap-4">
            {/* Left Section - Media Content */}
            {/* // uncomment me amit111 */}
            {/* <div className="w-1/3 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-lg">
                  We'll populate images, videos, and more in this space throughout the interview.
                </p>
                <p className="text-gray-500">
                  Stay tuned.
                </p>
              </div>
            </div> */}

            {/* Right Section - Voice Activity Indicator */}
            <div className="w-2/3 bg-white border border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center space-y-8">
              {/* Voice Activity Bars - only show when call is active */}
              {isCallActive && (
                <div className="flex items-end space-x-2 h-20">
                  {getVoiceBarHeights().map((height, index) => {
                    const { isUserSpeaking, isAiSpeaking } = voiceActivity;
                    let barColor = 'bg-purple-600'; // Default color
                    
                    if (isUserSpeaking && !isAiSpeaking) {
                      barColor = 'bg-red-500'; // User speaking - red
                    } else if (isAiSpeaking && !isUserSpeaking) {
                      barColor = 'bg-purple-600'; // AI speaking - purple
                    } else if (isUserSpeaking && isAiSpeaking) {
                      barColor = 'bg-orange-500'; // Both speaking - orange
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

              {/* Control Button */}
              <div className="flex flex-col items-center space-y-2">
                {isCallActive ? (
                  <>
                    <button
                      onClick={handleStopVoiceInterview}
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: '#ef4444' }}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626'}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444'}
                    >
                      <Square className="w-6 h-6 text-white" />
                    </button>
                    <span className="text-sm text-gray-600">Hit to Stop</span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleStartVoiceInterview}
                      disabled={vapiLoading}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-4 text-lg font-semibold rounded-lg shadow-lg border-0 cursor-pointer"
                    >
                      {vapiLoading ? "Starting..." : "Start Interview"}
                    </button>
                    
                    {/* Manual complete button - only show if interview has messages but isn't completed */}
                    {allMessages.length > 0 && !isInterviewCompleted && (
                      <button
                        onClick={markInterviewAsComplete}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 text-sm font-medium rounded-lg shadow border-0 cursor-pointer"
                      >
                        Complete Interview
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
     
    </div>
  );
}
