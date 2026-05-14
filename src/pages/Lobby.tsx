import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, handleSupabaseError, OperationType } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Users, Play, Copy, Check, LogOut, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export function Lobby() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!sessionId || !user) return;

    const joinSession = async () => {
      try {
        await supabase.from('participants').upsert({
          session_id: sessionId,
          user_id: user.id,
          display_name: user.displayName,
          photo_url: user.photoURL,
          score: 0,
          last_answer_correct: false,
        });
      } catch (err) {
        handleSupabaseError(err, OperationType.WRITE, `participants`);
      }
    };

    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        const data = payload.new as any;
        setSession({ id: data?.id, ...data });
        if (data?.status === "in-progress") {
          navigate(`/game/${sessionId}`);
        }
        setLoading(false);
      })
      .subscribe();

    const participantsChannel = supabase
      .channel(`participants:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` }, async (payload) => {
        const { data: ps } = await supabase.from('participants').select('*').eq('session_id', sessionId);
        setParticipants(ps || []);

        if (user && ps && !ps.find((p: any) => p.user_id === user.id)) {
          joinSession();
        }
      })
      .subscribe();

    // Initial load
    supabase.from('sessions').select('*').eq('id', sessionId).single().then(({ data, error }) => {
      if (error) {
        navigate("/");
        return;
      }
      setSession(data);
      setLoading(false);
    });

    supabase.from('participants').select('*').eq('session_id', sessionId).then(({ data }) => {
      setParticipants(data || []);
      if (user && data && !data.find((p: any) => p.user_id === user.id)) {
        joinSession();
      }
    });

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [sessionId, user, navigate]);

  const handleStart = async () => {
    if (!sessionId || !session) return;
    setStarting(true);
    try {
      const { error } = await supabase.from('sessions').update({
        status: "in-progress",
        current_question_index: 0,
        question_start_time: new Date().toISOString(),
      }).eq('id', sessionId);
      if (error) throw error;
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `sessions`);
      setStarting(false);
    }
  };

  const copyPin = () => {
    if (session?.pin) {
      navigator.clipboard.writeText(session.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--color-accent)" }} />
        <p className="mt-4 text-gray-500 font-medium">Entering lobby...</p>
      </div>
    );
  }

  const isHost = session?.hostId === user?.uid;

  return (
    <div className="min-h-[calc(100vh-64px)] relative overflow-hidden flex flex-col items-center justify-center p-4" style={{ backgroundColor: "var(--color-accent)" }}>
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute top-1/2 -right-48 w-[500px] h-[500px] rounded-full bg-white blur-3xl opacity-50" />
      </div>

      <div className="max-w-4xl w-full relative z-10 flex flex-col items-center">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-white/80 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <Users className="w-3 h-3" />
            {participants.length} Players joined
          </div>
          <h1 className="text-white text-3xl font-black mb-2 tracking-tight">Interactive Quiz Lobby</h1>
          <p className="text-lg font-medium opacity-80" style={{ color: "rgba(255, 255, 255, 0.8)" }}>Share the PIN to invite your friends!</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
          {/* PIN Card */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-6"
          >
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Game PIN</span>
            <div 
              onClick={copyPin}
              className="group relative cursor-pointer active:scale-95 transition-transform"
            >
              <h2 className="text-7xl font-black text-gray-900 tracking-[0.1em]">{session?.pin}</h2>
              <div className="absolute -right-12 top-1/2 -translate-y-1/2 p-2 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-gray-400" />}
              </div>
            </div>
            
            {isHost ? (
              <button
                onClick={handleStart}
                disabled={participants.length === 0 || starting}
                className="w-full py-5 text-white rounded-2xl font-black text-xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50" style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 20px 25px -5px rgba(218, 119, 86, 0.2)" }}
              >
                {starting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Play className="w-6 h-6 fill-current" />
                )}
                {starting ? "INITIALIZING..." : "START GAME"}
              </button>
            ) : (
              <div className="text-center p-4 rounded-2xl w-full border-2" style={{ backgroundColor: "rgba(218, 119, 86, 0.1)", borderColor: "rgba(218, 119, 86, 0.2)" }}>
                <p className="font-black text-lg animate-pulse" style={{ color: "var(--color-accent)" }}>WAITING FOR HOST TO START...</p>
                <p className="text-sm mt-1" style={{ color: "var(--color-accent)" }}>Get ready to shine!</p>
              </div>
            )}
          </motion.div>

          {/* Players List Card */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 flex flex-col"
          >
            <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
              Participants
              <span className="px-2 py-0.5 bg-white/20 rounded text-sm">{participants.length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2 scrollbar-hide">
              <AnimatePresence>
                {participants.map((player) => (
                  <motion.div
                    key={player.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5"
                  >
                    <img 
                      src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}`} 
                      className="w-10 h-10 rounded-xl"
                      alt={player.displayName}
                    />
                    <span className="text-white font-bold">{player.displayName}</span>
                    {player.uid === user?.uid && <span className="ml-auto text-[10px] font-bold bg-white/10 px-2 py-1 rounded" style={{ color: "rgba(255, 255, 255, 0.7)" }}>YOU</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {participants.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: "rgba(218, 119, 86, 0.3)" }}>
                  <Users className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-bold">No one here yet...</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
