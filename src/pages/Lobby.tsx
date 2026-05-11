import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, setDoc, updateDoc, serverTimestamp, query } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
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

    // Join the session if not already joined
    const joinSession = async () => {
      if (!user) return;
      try {
        const participantRef = doc(db, `sessions/${sessionId}/participants`, user.uid);
        await setDoc(participantRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          score: 0,
          lastAnswerCorrect: false,
          joinedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sessions/${sessionId}/participants`);
      }
    };

    const unsubSession = onSnapshot(doc(db, "sessions", sessionId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSession({ id: doc.id, ...data });
        if (data.status === "in-progress") {
          navigate(`/game/${sessionId}`);
        }
      } else {
        navigate("/");
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
    });

    const unsubParticipants = onSnapshot(collection(db, `sessions/${sessionId}/participants`), (snapshot) => {
      const ps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setParticipants(ps);
      
      // Auto-join if not in the list and joining isn't already handled
      if (user && !ps.find((p: any) => p.id === user.uid)) {
        joinSession();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}/participants`);
    });

    return () => {
      unsubSession();
      unsubParticipants();
    };
  }, [sessionId, user, navigate]);

  const handleStart = async () => {
    if (!sessionId || !session) return;
    setStarting(true);
    try {
      await updateDoc(doc(db, "sessions", sessionId), {
        status: "in-progress",
        currentQuestionIndex: 0,
        questionStartTime: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sessions/${sessionId}`);
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
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="mt-4 text-gray-500 font-medium">Entering lobby...</p>
      </div>
    );
  }

  const isHost = session?.hostId === user?.uid;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-indigo-600 relative overflow-hidden flex flex-col items-center justify-center p-4">
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
          <p className="text-indigo-100 text-lg font-medium opacity-80">Share the PIN to invite your friends!</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
          {/* PIN Card */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-6"
          >
            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Game PIN</span>
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
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {starting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Play className="w-6 h-6 fill-current" />
                )}
                {starting ? "INITIALIZING..." : "START GAME"}
              </button>
            ) : (
              <div className="text-center p-4 bg-indigo-50 rounded-2xl w-full border-2 border-indigo-100/50">
                <p className="text-indigo-600 font-black text-lg animate-pulse">WAITING FOR HOST TO START...</p>
                <p className="text-indigo-400 text-sm mt-1">Get ready to shine!</p>
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
                    {player.uid === user?.uid && <span className="ml-auto text-[10px] font-bold text-indigo-200 bg-white/10 px-2 py-1 rounded">YOU</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {participants.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-indigo-200/50">
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
