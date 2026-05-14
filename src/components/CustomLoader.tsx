import { motion } from "motion/react";

export function CustomLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-12 h-12">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute inset-0 border-4 border-transparent rounded-full"
          style={{ borderTopColor: "#DA7756", borderRightColor: "#DA7756" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Inner rotating ring (opposite direction) */}
        <motion.div
          className="absolute inset-2 border-3 border-transparent rounded-full"
          style={{ borderBottomColor: "#DA7756", borderLeftColor: "#DA7756" }}
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Center dot pulse */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-2 h-2 bg-amber-500 rounded-full"
          style={{ x: "-50%", y: "-50%" }}
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <motion.p
        className="text-xs font-bold text-slate-400 uppercase tracking-widest"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Loading...
      </motion.p>
    </div>
  );
}
