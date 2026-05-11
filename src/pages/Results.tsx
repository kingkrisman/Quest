import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Trophy, Home, Award, Medal, Crown, ArrowRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const participantsChannel = supabase
      .channel(`participants:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` }, async (payload) => {
        const { data: ps } = await supabase.from('participants').select('*').eq('session_id', sessionId).order('score', { ascending: false });
        setParticipants(ps || []);
        setLoading(false);
      })
      .subscribe();

    const fetchSession = async () => {
      const { data: sessionData } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (sessionData) {
        const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', sessionData.quiz_id).single();
        if (quizData) {
          setQuiz(quizData);
        }
      }
    };

    supabase.from('participants').select('*').eq('session_id', sessionId).order('score', { ascending: false }).then(({ data }) => {
      setParticipants(data || []);
      setLoading(false);
    });

    fetchSession();

    return () => {
      supabase.removeChannel(participantsChannel);
    };
  }, [sessionId]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">Loading final scores...</div>;
  }

  const podium = participants.slice(0, 3);
  const others = participants.slice(3);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-16"
        >
          <Award className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h1 className="text-5xl font-black text-gray-900 tracking-tight">Game Over!</h1>
          <p className="text-gray-500 text-xl font-medium mt-2">{quiz?.title || "Quiz"} - Final Standings</p>
        </motion.div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-2 sm:gap-6 w-full mb-16 px-4">
          {/* 2nd Place */}
          {podium[1] && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center space-y-4 mb-4"
            >
              <img src={podium[1].photoURL} className="w-20 h-20 rounded-full border-4 border-gray-300 shadow-xl" />
              <div className="w-24 sm:w-32 h-40 bg-gray-200 rounded-t-3xl shadow-xl flex flex-col items-center justify-start py-6 text-gray-600">
                <span className="text-3xl font-black">2</span>
                <span className="text-xs font-black uppercase mt-1">Silver</span>
              </div>
              <p className="font-bold text-gray-700 text-center line-clamp-1">{podium[1].displayName}</p>
              <span className="font-black text-indigo-600">{podium[1].score}</span>
            </motion.div>
          )}

          {/* 1st Place */}
          {podium[0] && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="relative">
                <Crown className="w-12 h-12 text-yellow-400 absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce" />
                <img src={podium[0].photoURL} className="w-32 h-32 rounded-full border-4 border-yellow-400 shadow-2xl relative z-10" />
              </div>
              <div className="w-32 sm:w-44 h-56 bg-yellow-400 rounded-t-3xl shadow-2xl flex flex-col items-center justify-start py-8 text-yellow-900">
                <span className="text-5xl font-black">1</span>
                <span className="text-sm font-black uppercase mt-1">Winner</span>
              </div>
              <p className="font-black text-gray-900 text-xl text-center line-clamp-1">{podium[0].displayName}</p>
              <span className="font-black text-indigo-700 text-2xl">{podium[0].score}</span>
            </motion.div>
          )}

          {/* 3rd Place */}
          {podium[2] && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center space-y-4 mb-2"
            >
              <img src={podium[2].photoURL} className="w-16 h-16 rounded-full border-4 border-orange-400 shadow-xl" />
              <div className="w-24 sm:w-28 h-32 bg-orange-200 rounded-t-3xl shadow-xl flex flex-col items-center justify-start py-4 text-orange-700">
                <span className="text-2xl font-black">3</span>
                <span className="text-xs font-black uppercase mt-1">Bronze</span>
              </div>
              <p className="font-bold text-gray-700 text-center line-clamp-1">{podium[2].displayName}</p>
              <span className="font-black text-indigo-600">{podium[2].score}</span>
            </motion.div>
          )}
        </div>

        {/* Other Players */}
        {others.length > 0 && (
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-12">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 px-2">Final Standings</h3>
            <div className="space-y-4">
              {others.map((player, idx) => (
                <div key={player.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <span className="w-6 font-bold text-gray-400">{idx + 4}</span>
                  <img src={player.photoURL} className="w-10 h-10 rounded-xl" />
                  <span className="font-bold text-gray-900 flex-1">{player.displayName}</span>
                  <span className="font-black text-gray-900">{player.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-4 pb-20">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
            Play Again
          </Link>
          <Link 
            to="/" 
            className="flex items-center gap-2 px-8 py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-black transition-all hover:bg-gray-50 active:scale-95"
          >
            <Home className="w-5 h-5" />
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
