import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, LayoutGrid, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { CustomLoader } from "../components/CustomLoader";

export function Flashcards() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [flashcardSet, setFlashcardSet] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSet = async () => {
      if (!setId) return;
      try {
        const { data, error } = await supabase.from('flashcard_sets').select('*').eq('id', setId).single();
        if (error) throw error;
        if (data) {
          setFlashcardSet(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSet();
  }, [setId]);

  if (loading) return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center min-h-screen"
    >
      <CustomLoader />
    </motion.div>
  );
  if (!flashcardSet || !flashcardSet.cards || flashcardSet.cards.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 mb-2">Empty Study Set</h1>
            <p className="text-slate-500">This set has no cards to display.</p>
        </div>
        <button 
                onClick={() => navigate("/dashboard")} 
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all"
            >
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
        </button>
    </div>
  );

  const currentCard = flashcardSet.cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcardSet.cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcardSet.cards.length) % flashcardSet.cards.length);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-12">
            <button 
                onClick={() => navigate("/dashboard")} 
                className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Self-Study Module</span>
            </div>
        </header>

        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3 italic">{flashcardSet.title}</h1>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">{flashcardSet.description}</p>
        </div>

        {/* Card Stage */}
        <div className="relative h-[450px] w-full perspective-1000">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full w-full cursor-pointer"
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    <motion.div
                        initial={false}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                        style={{ transformStyle: "preserve-3d" }}
                        className="relative w-full h-full"
                    >
                        {/* Front */}
                        <div 
                            className="absolute inset-0 backface-hidden bg-white rounded-[3rem] p-12 border-2 border-slate-100 shadow-2xl flex flex-col items-center justify-center text-center shadow-indigo-100/30"
                        >
                            <span className="absolute top-10 left-10 text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Concept {currentIndex + 1}</span>
                            <h2 className="text-4xl font-black text-slate-900 leading-tight tracking-tight italic">
                                {currentCard.front}
                            </h2>
                            <p className="absolute bottom-10 text-slate-300 font-bold text-[10px] uppercase tracking-widest animate-pulse">Click to Reveal Answer</p>
                        </div>

                        {/* Back */}
                        <div 
                            className="absolute inset-0 backface-hidden bg-indigo-600 rounded-[3rem] p-12 text-white flex flex-col items-center justify-center text-center shadow-2xl shadow-indigo-200"
                            style={{ transform: "rotateY(180deg)" }}
                        >
                            <span className="absolute top-10 left-10 text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em]">Definition</span>
                            <div className="max-w-lg">
                                <p className="text-2xl font-bold leading-relaxed">
                                    {currentCard.back}
                                </p>
                            </div>
                            <p className="absolute bottom-10 text-indigo-300 font-bold text-[10px] uppercase tracking-widest">Click to See Concept</p>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="mt-12 flex flex-col items-center gap-8">
            <div className="flex items-center gap-6">
                <button
                   onClick={handlePrev}
                   className="w-16 h-16 rounded-3xl bg-white border border-slate-100 text-slate-400 transition-all active:scale-90 flex items-center justify-center shadow-lg shadow-slate-100 group hover:text-white" style={{ borderColor: "var(--color-accent)", "--hover-text": "white" } as React.CSSProperties}
                >
                    <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className="px-8 py-4 bg-slate-900 rounded-[2rem] text-white flex items-center gap-4">
                    <span className="text-2xl font-black">{currentIndex + 1}</span>
                    <div className="w-px h-6 bg-slate-800" />
                    <span className="text-xl font-black text-slate-500">{flashcardSet.cards.length}</span>
                </div>

                <button
                   onClick={handleNext}
                   className="w-16 h-16 rounded-3xl bg-white border border-slate-100 text-slate-400 transition-all active:scale-90 flex items-center justify-center shadow-lg shadow-slate-100 group hover:text-white" style={{ borderColor: "var(--color-accent)" } as React.CSSProperties}
                >
                    <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            <button 
                onClick={() => setCurrentIndex(0)}
                className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
            >
                <RotateCcw className="w-3 h-3" />
                Reset Study Session
            </button>
        </div>
      </div>
    </div>
  );
}
