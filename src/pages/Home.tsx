import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Search, PlusCircle, Play, Globe, Trophy, Users, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export function Home() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleJoin = async (e: any) => {
    e.preventDefault();
    if (pin.length !== 6) return;
    
    setLoading(true);
    setError("");
    
    try {
      const q = query(collection(db, "sessions"), where("pin", "==", pin), where("status", "==", "lobby"));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError("Quiz not found or already started.");
        setLoading(false);
        return;
      }
      
      const sessionId = snapshot.docs[0].id;
      navigate(`/lobby/${sessionId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "sessions/query");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-200/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 shadow-2xl shadow-indigo-200 mb-8"
        >
          <div className="w-10 h-10 border-4 border-white rounded-md rotate-45"></div>
        </motion.div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">Master the <span className="text-indigo-600">Sprint.</span></h2>
        <p className="mt-4 text-slate-500 text-lg font-medium">Join the next live system assessment.</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-10 px-6 sm:px-10 shadow-xl shadow-slate-200 rounded-[2.5rem] border border-slate-100">
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-1 text-center">
              <label htmlFor="pin" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Pin Required</label>
              <div className="relative">
                <input
                  id="pin"
                  name="pin"
                  type="text"
                  maxLength={6}
                  required
                  placeholder="000 000"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="block w-full px-4 py-6 text-5xl text-center font-black tracking-[0.2em] text-slate-900 border-none bg-slate-50 rounded-3xl focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-200 font-mono"
                />
              </div>
              {error && <p className="mt-4 text-xs font-bold text-rose-500">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || pin.length !== 6}
              className={cn(
                "w-full flex justify-center py-5 px-4 border border-transparent rounded-2xl shadow-lg shadow-indigo-100 text-xl font-black text-white transition-all active:scale-[0.98]",
                loading || pin.length !== 6 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                  : "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {loading ? "AUTHENTICATING..." : "JOIN SPRINT"}
            </button>
          </form>

          <div className="mt-12">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-3 bg-white text-slate-400 font-black uppercase tracking-widest">Administrative access</span>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-900 font-bold transition-all active:scale-[0.98]"
              >
                Create Board
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-4">
          <div className="text-center group cursor-default">
            <h4 className="text-2xl font-black text-slate-900">42</h4>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest group-hover:tracking-[0.2em] transition-all">Sprints</p>
          </div>
          <div className="text-center group cursor-default border-x border-slate-200">
            <h4 className="text-2xl font-black text-slate-900">8.4k</h4>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest group-hover:tracking-[0.2em] transition-all">Users</p>
          </div>
          <div className="text-center group cursor-default">
            <h4 className="text-2xl font-black text-slate-900">99%</h4>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest group-hover:tracking-[0.2em] transition-all">Uptime</p>
          </div>
        </div>
      </div>
    </div>
  );
}
