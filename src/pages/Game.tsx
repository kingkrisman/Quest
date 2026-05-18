import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, handleSupabaseError, OperationType } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Clock, Users, ArrowRight, Check, X, Loader2, Award, Sparkles } from "lucide-react";
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
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          if (quizData) {
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
      if (quizData) {
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
      if (timerRef.current) clearInterval(timerRef.current);
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

  useEffect(() => {
    if (session?.status === "in-progress" && quiz && session.current_question_index >= 0) {
      const q = quiz.questions[session.current_question_index];
      const startTime = new Date(session.question_start_time).getTime();
      const timeLimit = q?.timeLimit || 20;
      const expiry = startTime + (timeLimit * 1000);
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.ceil((expiry - now) / 1000));
        setTimeLeft(diff);
        
        if (diff === 0) {
          setShowResults(true);
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setShowResults(false);
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.current_question_index, session?.question_start_time, quiz]);

  const handleSelectOption = async (optionIndex: number) => {
    if (!session || !quiz || showResults || myResponse) return;

    const question = quiz.questions[session.current_question_index];
    const isCorrect = optionIndex === question.correctOptionIndex;
    const pointsPossible = question.points || 1000;
    
    const timeTaken = quiz.questions[session.current_question_index].timeLimit - timeLeft;
    const timeBonus = Math.max(0, Math.floor(pointsPossible * (1 - (timeTaken / question.timeLimit) * 0.5)));
    const finalPoints = isCorrect ? timeBonus : 0;

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

  if (loading || !session || !quiz) {
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
                {showResults ? "Commit Stage" : "Reviewing Story"}
              </span>
              <motion.div
                className={cn("w-1.5 h-1.5 rounded-full", showResults ? "bg-rose-500" : "bg-indigo-500")}
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="flex items-center gap-6">
          <motion.div
            className={cn(
              "flex items-center gap-4 px-6 py-3 rounded-2xl border-2 font-mono transition-all",
              timeLeft <= 5
                ? "bg-rose-50 border-rose-200 text-rose-600 scale-110 shadow-lg shadow-rose-100"
                : "bg-white border-slate-100 text-slate-900"
            )}
            animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <motion.div
              animate={timeLeft <= 5 ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Clock className="w-5 h-5" />
            </motion.div>
            <span className="text-2xl font-black tabular-nums">{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span>
          </motion.div>
          <motion.div
            className="hidden lg:flex items-center gap-3 px-4 py-2 border border-slate-100 rounded-xl bg-slate-50"
            whileHover={{ scale: 1.05 }}
          >
             <div className="flex -space-x-2">
               {participants.slice(0, 3).map((p, i) => (
                 <motion.img
                   key={i}
                   src={p.photo_url}
                   whileHover={{ scale: 1.15, zIndex: 10 }}
                   className="w-6 h-6 rounded-full border-2 border-white ring-1 ring-slate-100 transition-all"
                 />
               ))}
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{answeredCount} Commits</span>
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full px-4 py-12">
        {!showResults ? (
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
              {currentQuestion.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={!!myResponse}
                  className={cn(
                    "relative group p-8 rounded-[2rem] text-left transition-all active:scale-[0.98] disabled:active:scale-100 min-h-[120px] flex items-center justify-between border-2",
                    myResponse?.answer_index === idx
                      ? "bg-slate-900 border-slate-900 text-white shadow-2xl"
                      : "bg-white border-slate-100 hover:border-amber-200/50 hover:shadow-xl transition-all",
                    !!myResponse && myResponse.answer_index !== idx && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-6 flex-1">
                    <span className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl transition-colors",
                      myResponse?.answer_index === idx ? "bg-white/20 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                    )}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-xl font-bold tracking-tight">{option}</span>
                  </div>
                  {myResponse?.answer_index === idx && <div className="p-2 bg-white/20 rounded-xl"><Check className="w-6 h-6 text-white" /></div>}
                </button>
              ))}
            </div>

            {myResponse && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center">
                 <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-2xl shadow-lg" style={{ borderColor: "rgba(218, 119, 86, 0.2)", border: "1px solid rgba(218, 119, 86, 0.2)", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.1)" }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
                    <span className="text-sm font-black uppercase tracking-widest animate-pulse" style={{ color: "var(--color-accent)" }}>Commit Pending Review...</span>
                 </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Answer Result Display */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="lg:col-span-7 bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col border border-slate-100"
            >
              <div className={cn(
                "p-12 pb-16 flex flex-col items-center justify-center text-center relative overflow-hidden",
                myResponse?.is_correct ? "bg-emerald-50/50" : "bg-rose-50/50"
              )}>
                {/* Background pulse for correct/incorrect */}
                <div className={cn("absolute w-64 h-64 blur-[100px] rounded-full -top-32 -right-32 opacity-20", myResponse?.is_correct ? "bg-emerald-500" : "bg-rose-500")} />
                
                {myResponse?.is_correct ? (
                  <>
                    <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl border relative z-10" style={{ boxShadow: "0 25px 50px -12px rgba(218, 119, 86, 0.3)", borderColor: "rgba(218, 119, 86, 0.3)" }}>
                      <Check className="w-14 h-14" style={{ color: "var(--color-accent)" }} />
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 mb-2 tracking-tight leading-none">Sprint Success</h2>
                    <p className="text-2xl font-black font-mono tracking-tighter" style={{ color: "var(--color-accent)" }}>+{myResponse.points_earned} VELOCITY</p>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl border relative z-10" style={{ boxShadow: "0 25px 50px -12px rgba(220, 38, 38, 0.3)", borderColor: "rgba(220, 38, 38, 0.3)" }}>
                      <X className="w-14 h-14 text-rose-600" />
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 mb-2 tracking-tight leading-none">Build Failure</h2>
                    <p className="text-xl font-bold text-rose-500/80 tracking-tight">Review technical documentation and retry.</p>
                  </>
                )}
              </div>
              
              <div className="p-12 pt-10 flex-1 flex flex-col">
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Correct Specification</h4>
                   <div className="p-8 bg-slate-900 rounded-3xl flex items-center gap-6 shadow-2xl" style={{ borderColor: "var(--color-accent)", border: "2px solid var(--color-accent)" }}>
                     <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                        {String.fromCharCode(65 + currentQuestion.correctOptionIndex)}
                     </div>
                     <p className="text-2xl font-bold text-white tracking-tight leading-tight">{currentQuestion.options[currentQuestion.correctOptionIndex]}</p>
                   </div>
                </div>

                {isHost && (
                  <div className="mt-12">
                    <button
                      onClick={handleNextQuestion}
                      className="w-full py-6 text-white rounded-[2rem] font-black text-xl transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-4 group" style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 25px 50px -12px rgba(218, 119, 86, 0.3)" }}
                    >
                      {session.current_question_index === quiz.questions.length - 1 ? "FINALIZE SPRINT" : "NEXT STORY"}
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Leaderboard Sidebar */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="lg:col-span-5 bg-white rounded-[3rem] p-4 border border-slate-200 shadow-sm flex flex-col h-full"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <Award className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
                  Live Rankings
                </h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time</span>
                </div>
              </div>

              <div className="p-2 space-y-2 overflow-y-auto max-h-[500px] scrollbar-hide">
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
          </div>
        )}
      </div>
    </div>
  );
}
