import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, handleSupabaseError, OperationType } from "../lib/supabase";
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
      const { data, error: err } = await supabase
        .from('sessions')
        .select('id')
        .eq('pin', pin)
        .eq('status', 'lobby')
        .single();

      if (err || !data) {
        setError("Quiz not found or already started.");
        setLoading(false);
        return;
      }

      navigate(`/lobby/${data.id}`);
    } catch (err) {
      handleSupabaseError(err, OperationType.LIST, "sessions");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center px-4 py-8 sm:py-12 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Decorative gradient */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none"
        style={{ backgroundColor: "rgba(218, 119, 86, 0.1)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />

      <div className="relative z-10 mx-auto w-full max-w-md text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotateZ: -10 }}
          animate={{ scale: 1, opacity: 1, rotateZ: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          whileHover={{ scale: 1.05, rotateZ: 5 }}
          className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl shadow-2xl mb-6 sm:mb-8 cursor-pointer"
          style={{ backgroundColor: "#DA7756", boxShadow: "0 25px 50px -12px rgba(218, 119, 86, 0.3)" }}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-white rounded-md rotate-45"></div>
        </motion.div>
        <motion.h2
          className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Master the <motion.span
            className="inline-block"
            style={{ color: "#DA7756" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >Sprint.</motion.span>
        </motion.h2>
        <motion.p
          className="mt-3 sm:mt-4 text-slate-500 text-base sm:text-lg font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Join the next live system assessment.
        </motion.p>
      </div>

      <motion.div
        className="mt-8 sm:mt-10 mx-auto w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <motion.div
          className="bg-white py-8 px-6 sm:py-10 sm:px-10 shadow-xl shadow-slate-200 rounded-3xl sm:rounded-[2.5rem] border border-slate-100"
          whileHover={{ boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
        >
          <form onSubmit={handleJoin} className="space-y-6">
            <motion.div
              className="space-y-2 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <label htmlFor="pin" className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Entry Pin Required</label>
              <div className="relative">
                <motion.input
                  id="pin"
                  name="pin"
                  type="text"
                  maxLength={6}
                  required
                  placeholder="000 000"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="block w-full px-3 py-4 sm:px-4 sm:py-6 text-3xl sm:text-5xl text-center font-black tracking-[0.2em] text-slate-900 border-none bg-slate-50 rounded-2xl sm:rounded-3xl focus:outline-none transition-all placeholder:text-slate-200 font-mono"
                  style={{ boxShadow: pin.length === 6 ? `0 0 0 4px rgba(218, 119, 86, 0.1)` : "none" }}
                  whileFocus={{ scale: 1.02 }}
                />
              </div>
              {error && <motion.p
                className="mt-3 text-xs font-bold text-rose-500"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >{error}</motion.p>}
            </motion.div>

            <motion.button
              type="submit"
              disabled={loading || pin.length !== 6}
              whileHover={pin.length === 6 ? { scale: 1.02 } : {}}
              whileTap={pin.length === 6 ? { scale: 0.98 } : {}}
              className={cn(
                "w-full flex justify-center py-4 sm:py-5 px-4 border border-transparent rounded-xl sm:rounded-2xl text-base sm:text-xl font-black text-white transition-all",
                loading || pin.length !== 6
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                  : "text-white shadow-lg"
              )}
              style={loading || pin.length !== 6 ? {} : { backgroundColor: "#DA7756", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.3)" }}
            >
              {loading ? "AUTHENTICATING..." : "JOIN SPRINT"}
            </motion.button>
          </form>

          <motion.div className="mt-8 sm:mt-12">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-[9px] sm:text-[10px]">
                <span className="px-3 bg-white text-slate-400 font-black uppercase tracking-widest">Administrative access</span>
              </div>
            </div>

            <motion.div
              className="mt-6 sm:mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <motion.button
                onClick={() => navigate("/dashboard")}
                whileHover={{ scale: 1.02, backgroundColor: "rgba(218, 119, 86, 0.05)" }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 py-3 sm:py-4 px-4 rounded-xl sm:rounded-2xl border transition-all"
                style={{ borderColor: "#DA7756", color: "#DA7756" }}
              >
                Create Board
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-10 sm:mt-16 grid grid-cols-3 gap-3 sm:gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="text-center group cursor-default"
            whileHover={{ scale: 1.05 }}
          >
            <h4 className="text-xl sm:text-2xl font-black text-slate-900">42</h4>
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest group-hover:tracking-[0.2em] transition-all" style={{ color: "#DA7756" }}>Sprints</p>
          </motion.div>
          <motion.div
            className="text-center group cursor-default border-x border-slate-200"
            whileHover={{ scale: 1.05 }}
          >
            <h4 className="text-xl sm:text-2xl font-black text-slate-900">8.4k</h4>
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest group-hover:tracking-[0.2em] transition-all" style={{ color: "#DA7756" }}>Users</p>
          </motion.div>
          <motion.div
            className="text-center group cursor-default"
            whileHover={{ scale: 1.05 }}
          >
            <h4 className="text-xl sm:text-2xl font-black text-slate-900">99%</h4>
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest group-hover:tracking-[0.2em] transition-all" style={{ color: "#DA7756" }}>Uptime</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
