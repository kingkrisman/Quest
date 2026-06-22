import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, handleSupabaseError, OperationType } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Users, ArrowRight, Check, X, Loader2, Award, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { CustomLoader } from "../components/CustomLoader";

export function Game() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [myResponse, setMyResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rankingsCollapsed, setRankingsCollapsed] = useState(false);
  const [rankingsPosition, setRankingsPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileRankings, setShowMobileRankings] = useState(false);

  useEffect(() => {
    if (!sessionId || !user) return;

    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, async (payload) => {
        const data = payload.new as any;
        setSession(data);

        if (data?.status === "finished") {
          navigate(`/results/${sessionId}`);
          return;
        }

        if (!quiz || quiz.id !== data?.quiz_id) {
          const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', data?.quiz_id).single();
          if (quizData && quizData.questions && quizData.questions.length > 0) {
            setQuiz(quizData);
          }
        }

        setLoading(false);
      })
      .subscribe();

    const participantsChannel = supabase
      .channel(`participants:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` }, async (payload) => {
        const { data: ps } = await supabase.from('participants').select('*').eq('session_id', sessionId).order('score', { ascending: false });
        setParticipants(ps || []);
      })
      .subscribe();

    // Initial load
    supabase.from('sessions').select('*').eq('id', sessionId).single().then(async ({ data, error }) => {
      if (error) {
        navigate("/");
        return;
      }
      setSession(data);
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', data.quiz_id).single();
      if (quizData && quizData.questions && quizData.questions.length > 0) {
        setQuiz(quizData);
      }
      setLoading(false);
    });

    supabase.from('participants').select('*').eq('session_id', sessionId).order('score', { ascending: false }).then(({ data }) => {
      setParticipants(data || []);
    });

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [sessionId, user, navigate]);

  useEffect(() => {
    if (!sessionId || !user || !session) return;

    const responsesChannel = supabase
      .channel(`responses:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `session_id=eq.${sessionId}` }, async (payload) => {
        const { data: allResponses } = await supabase.from('responses').select('*').eq('session_id', sessionId);
        setResponses(allResponses || []);
        
        const myRes = allResponses?.find((r: any) => r.participant_id === user.id && r.question_index === session.current_question_index);
        setMyResponse(myRes || null);
      })
      .subscribe();

    // Initial load
    supabase.from('responses').select('*').eq('session_id', sessionId).then(({ data }) => {
      setResponses(data || []);
      const myRes = data?.find((r: any) => r.participant_id === user.id && r.question_index === session.current_question_index);
      setMyResponse(myRes || null);
    });

    return () => {
      supabase.removeChannel(responsesChannel);
    };
  }, [sessionId, user, session?.host_id, session?.current_question_index]);


  const handleSelectOption = async (optionIndex: number) => {
    if (!session || !quiz || myResponse) return;

    const question = quiz.questions[session.current_question_index];
    const isCorrect = optionIndex === question.correctOptionIndex;
    const pointsPossible = question.points || 1000;
    const finalPoints = isCorrect ? pointsPossible : 0;

    try {
      const { error: responseError } = await supabase.from('responses').insert({
        session_id: sessionId,
        participant_id: user?.id,
        question_index: session.current_question_index,
        answer_index: optionIndex,
        is_correct: isCorrect,
        points_earned: finalPoints,
      });
      if (responseError) throw responseError;

      if (finalPoints > 0) {
        const { data: current } = await supabase.from('participants').select('score').eq('user_id', user?.id).eq('session_id', sessionId).single();
        await supabase.from('participants').update({
          score: (current?.score || 0) + finalPoints,
          last_answer_correct: isCorrect
        }).eq('user_id', user?.id).eq('session_id', sessionId);
      } else {
        await supabase.from('participants').update({
          last_answer_correct: isCorrect
        }).eq('user_id', user?.id).eq('session_id', sessionId);
      }
    } catch (err) {
      handleSupabaseError(err, OperationType.WRITE, `responses`);
    }
  };

  const handleDragStart = (e: MouseEvent) => {
    setIsDragging(true);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setRankingsPosition(prev => ({
      x: prev.x + e.movementX,
      y: prev.y + e.movementY
    }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleNextQuestion = async () => {
    if (!session || !quiz) return;
    
    const isLast = session.current_question_index === quiz.questions.length - 1;
    
    try {
      if (isLast) {
        const { error } = await supabase.from('sessions').update({
          status: "finished"
        }).eq('id', sessionId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sessions').update({
          current_question_index: session.current_question_index + 1,
          question_start_time: new Date().toISOString(),
        }).eq('id', sessionId);
        if (error) throw error;
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !session || !quiz || !quiz.questions || quiz.questions.length === 0 || session.current_question_index < 0 || session.current_question_index >= quiz.questions.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]"
      >
        <CustomLoader />
      </motion.div>
    );
  }

  const isHost = session.host_id === user?.id;
  const currentQuestion = quiz.questions[session.current_question_index];
  const answeredCount = responses.filter(r => r.question_index === session.current_question_index).length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex flex-col">
      {/* Header Info */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-slate-200 py-4 px-4 sm:px-8 flex items-center justify-between sticky top-16 z-40 shadow-sm"
      >
        <motion.div className="flex items-center gap-6">
          <motion.div
            className="flex flex-col"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Iteration</span>
            <motion.span
              key={session.current_question_index}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-lg font-black text-slate-900 tabular-nums"
            >
              {session.current_question_index + 1} <span className="text-slate-300 font-bold mx-1">/</span> {quiz.questions.length}
            </motion.span>
          </motion.div>
          <div className="h-8 w-px bg-slate-100" />
          <motion.div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: "var(--color-accent)" }}>State</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900 uppercase">
                Reviewing Story
              </span>
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="flex items-center gap-6">
          <motion.div
            className="hidden lg:flex items-center gap-3 px-4 py-2 border border-slate-100 rounded-xl bg-slate-50"
            whileHover={{ scale: 1.05 }}
          >
             <div className="flex -space-x-2">
               {participants.slice(0, 3).map((p, i) => (
                 <motion.img
                   key={i}
                   src={p.photo_url || `https://ui-avatars.com/api/?name=${p.display_name}`}
                   whileHover={{ scale: 1.15, zIndex: 10 }}
                   className="w-6 h-6 rounded-full border-2 border-white ring-1 ring-slate-100 transition-all"
                   alt={p.display_name}
                 />
               ))}
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{answeredCount} Commits</span>
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full px-4 py-12">
        <div className="w-full max-w-4xl space-y-12">
          <motion.div
            key={currentQuestion.id}
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm" style={{ backgroundColor: "rgba(218, 119, 86, 0.1)", color: "var(--color-accent)", borderColor: "rgba(218, 119, 86, 0.2)" }}>
              <Sparkles className="w-3 h-3" />
              Featured User Story #{session.current_question_index + 1}
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
              {currentQuestion.text}
            </h1>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
            {currentQuestion.options.map((option: string, idx: number) => {
              const isSelected = myResponse?.answer_index === idx;
              const isCorrect = idx === currentQuestion.correctOptionIndex;
              const isWrongSelection = isSelected && !isCorrect;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={!!myResponse}
                  className={cn(
                    "relative group p-8 rounded-[2rem] text-left transition-all active:scale-[0.98] disabled:active:scale-100 min-h-[120px] flex items-center justify-between border-2",
                    isCorrect && isSelected && myResponse
                      ? "bg-emerald-50 border-emerald-300 text-slate-900"
                      : isWrongSelection
                      ? "bg-red-50 border-red-300 text-slate-900"
                      : isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-2xl"
                      : "bg-white border-slate-100 hover:border-amber-200/50 hover:shadow-xl transition-all",
                    myResponse && !isSelected && !isCorrect && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-6 flex-1">
                    <span className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl transition-colors",
                      isCorrect && isSelected && myResponse
                        ? "bg-emerald-200 text-emerald-700"
                        : isWrongSelection
                        ? "bg-red-200 text-red-700"
                        : isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                    )}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-xl font-bold tracking-tight">{option}</span>
                  </div>
                  {isCorrect && isSelected && myResponse && (
                    <div className="p-2 bg-emerald-200 rounded-xl">
                      <Check className="w-6 h-6 text-emerald-700" />
                    </div>
                  )}
                  {isWrongSelection && (
                    <div className="p-2 bg-red-200 rounded-xl">
                      <X className="w-6 h-6 text-red-700" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {myResponse && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center">
               <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-2xl shadow-lg" style={{ borderColor: "rgba(218, 119, 86, 0.2)", border: "1px solid rgba(218, 119, 86, 0.2)", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.1)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
                  <span className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Awaiting Next Question...</span>
               </div>
            </motion.div>
          )}

          {isHost && myResponse && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center">
              <button
                onClick={handleNextQuestion}
                className="py-4 px-8 text-white rounded-[2rem] font-black text-lg transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-4 group" style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 25px 50px -12px rgba(218, 119, 86, 0.3)" }}
              >
                {session.current_question_index === quiz.questions.length - 1 ? "FINALIZE SPRINT" : "NEXT STORY"}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Leaderboard Sidebar - Desktop Only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          position: "fixed",
          left: `calc(100% - ${rankingsPosition.x}px - 1.5rem - 18rem)`,
          top: `calc(${rankingsPosition.y}px + 1.5rem)`,
          cursor: isDragging ? "grabbing" : "grab"
        }}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        className={cn(
          "hidden lg:flex bg-white rounded-[3rem] border border-slate-200 shadow-lg flex-col transition-all",
          "w-96",
          rankingsCollapsed ? "p-4" : "p-4 h-auto max-h-96"
        )}
      >
        <div
          onMouseDown={handleDragStart}
          className="p-6 border-b border-slate-100 flex items-center justify-between select-none"
        >
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <Award className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
            Live Rankings
          </h3>
          <button
            onClick={() => setRankingsCollapsed(!rankingsCollapsed)}
            className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-2 transition-colors"
            aria-label={rankingsCollapsed ? "Expand rankings" : "Collapse rankings"}
          >
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time</span>
            <motion.div animate={{ rotate: rankingsCollapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {!rankingsCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="p-2 space-y-2 overflow-y-auto max-h-[300px] scrollbar-hide"
            >
              {participants.map((player, idx) => (
                <motion.div
                  key={player.id}
                  layout
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-3xl transition-all border",
                    idx === 0
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl"
                      : (player.user_id === user?.id ? "bg-gray-100 border-gray-200" : "bg-slate-50 border-transparent hover:border-slate-200")
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0",
                    idx === 0 ? "bg-white/20" : "bg-white text-slate-400"
                  )}>
                    {idx + 1}
                  </div>
                  <img
                    src={player.photo_url || `https://ui-avatars.com/api/?name=${player.display_name}`}
                    className="w-10 h-10 rounded-xl border-2 border-white ring-1 ring-slate-100"
                    alt={player.display_name}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold truncate", idx === 0 ? "text-white" : "text-slate-900")}>
                      {player.display_name}
                    </p>
                    {player.user_id === user?.id && (
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>You</span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-lg font-black font-mono leading-none", idx === 0 ? "text-white" : "text-slate-900")}>
                      {player.score.toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mobile Rankings Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setShowMobileRankings(true)}
        className="lg:hidden fixed bottom-4 right-4 p-4 bg-white rounded-full border border-slate-200 shadow-lg flex items-center justify-center z-40 hover:shadow-xl transition-shadow"
      >
        <Award className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
      </motion.button>

      {/* Mobile Rankings Bottom Sheet */}
      <AnimatePresence>
        {showMobileRankings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileRankings(false)}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
            />
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[3rem] border-t border-slate-200 shadow-2xl z-50 lg:hidden max-h-[80vh] flex flex-col"
            >
              {/* Handle Bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 rounded-full bg-slate-200" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <Award className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
                  Live Rankings
                </h3>
                <button
                  onClick={() => setShowMobileRankings(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close rankings"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Rankings List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {participants.map((player, idx) => (
                  <motion.div
                    key={player.id}
                    layout
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-3xl transition-all border",
                      idx === 0
                        ? "bg-slate-900 border-slate-900 text-white shadow-xl"
                        : (player.user_id === user?.id ? "bg-gray-100 border-gray-200" : "bg-slate-50 border-transparent hover:border-slate-200")
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0",
                      idx === 0 ? "bg-white/20" : "bg-white text-slate-400"
                    )}>
                      {idx + 1}
                    </div>
                    <img
                      src={player.photo_url || `https://ui-avatars.com/api/?name=${player.display_name}`}
                      className="w-10 h-10 rounded-xl border-2 border-white ring-1 ring-slate-100"
                      alt={player.display_name}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold truncate", idx === 0 ? "text-white" : "text-slate-900")}>
                        {player.display_name}
                      </p>
                      {player.user_id === user?.id && (
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>You</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-lg font-black font-mono leading-none", idx === 0 ? "text-white" : "text-slate-900")}>
                        {player.score.toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
