import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Play, Clock, BookOpen, ChevronRight, LayoutGrid, List, Zap } from "lucide-react";
import { motion } from "motion/react";
import { cn, formatDate, generatePin } from "../lib/utils";

export function Dashboard() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"quizzes" | "flashcards">("quizzes");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [quizData, flashData] = await Promise.all([
          supabase.from('quizzes').select('*').eq('creator_id', user.id),
          supabase.from('flashcard_sets').select('*').eq('creator_id', user.id),
        ]);

        setQuizzes(quizData.data || []);
        setFlashcardSets(flashData.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleHost = async (quizId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          quiz_id: quizId,
          host_id: user.id,
          pin: generatePin(),
          status: "lobby",
          current_question_index: -1,
        })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/lobby/${data.id}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <h2 className="text-2xl font-bold mb-4">Please sign in to continue</h2>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "var(--color-accent)" }}>
            <LayoutGrid className="w-3 h-3" />
            System Control Center
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Project Backlog</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your interactive system assessments.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm grow sm:max-w-xs">
            <button
                onClick={() => setActiveTab("quizzes")}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all text-white",
                    activeTab === "quizzes" ? "shadow-lg" : "text-slate-400 bg-white"
                )}
                style={activeTab === "quizzes" ? { backgroundColor: "var(--color-accent)", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.2)" } : {}}
            >
                <Zap className="w-4 h-4" />
                QUIZZES
            </button>
            <button
                onClick={() => setActiveTab("flashcards")}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all",
                    activeTab === "flashcards" ? "text-white shadow-lg" : "text-slate-400 hover:opacity-70"
                )}
                style={activeTab === "flashcards" ? { backgroundColor: "var(--color-accent)", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.2)" } : {}}
            >
                <BookOpen className="w-4 h-4" />
                STUDY SETS
            </button>
        </div>
        <Link
          to="/create"
          className="inline-flex items-center justify-center gap-3 px-8 py-3.5 text-white rounded-2xl font-black shadow-xl transition-all active:scale-95 sm:w-auto w-full" style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 20px 25px -5px rgba(218, 119, 86, 0.2)" }}
        >
          <Plus className="w-5 h-5" />
          NEW SPRINT
        </Link>
      </header>

      {/* Quick Stats Overlay */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Assets</p>
          <h3 className="text-3xl font-black text-slate-900">{quizzes.length + flashcardSets.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
          <div className="flex items-center gap-2">
            <h3 className="text-3xl font-black text-emerald-600 uppercase tracking-tight">Optimal</h3>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Capacity</p>
          <h3 className="text-3xl font-black" style={{ color: "var(--color-accent)" }}>UNLIMITED</h3>
        </div>
      </div>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-white border border-slate-100 rounded-3xl animate-pulse" />
            ))
          ) : activeTab === "quizzes" ? (
             quizzes.length === 0 ? (
                <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Zap className="w-10 h-10 text-slate-200" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">No quiz sprints initialized</h3>
                  <p className="text-slate-500 mt-2 font-medium">Initialize your first quiz sprint to begin.</p>
                  <Link 
                    to="/create" 
                    className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all active:scale-95"
                  >
                    CREATE BOARD <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              ) : (
                quizzes.map((quiz, i) => (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="group relative flex flex-col bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 transition-all p-2"
                  >
                    <div className="p-8 pb-4 flex-1">
                      <div className="flex items-center justify-between mb-8">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: "rgba(218, 119, 86, 0.1)" }}>
                          <Zap className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <List className="w-3 h-3" />
                          {quiz.questions?.length || 0} Stories
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 transition-colors line-clamp-1 tracking-tight group-hover:opacity-75">{quiz.title}</h3>
                      <p className="text-sm text-slate-500 mt-3 line-clamp-2 font-medium leading-relaxed">{quiz.description}</p>
                    </div>
                    
                    <div className="px-8 py-6">
                      <button
                        onClick={() => handleHost(quiz.id)}
                        className="w-full inline-flex items-center justify-center gap-3 py-5 bg-slate-50 text-slate-900 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] group-hover:shadow-lg hover:text-white" style={{ '--hover-bg': 'var(--color-accent)' } as React.CSSProperties}
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Deploy Live
                      </button>
                      <div className="mt-6 flex items-center justify-between px-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        <span>Repository sync active</span>
                        <span>{quiz.createdAt ? formatDate(quiz.createdAt.toDate()) : "Latest"}</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )
          ) : (
            flashcardSets.length === 0 ? (
                <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-10 h-10 text-slate-200" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Study database is empty</h3>
                  <p className="text-slate-500 mt-2 font-medium">Generate your first study set using documents or topics.</p>
                  <Link 
                    to="/create" 
                    className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all active:scale-95"
                  >
                    START STUDYING <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              ) : (
                flashcardSets.map((set, i) => (
                  <motion.div
                    key={set.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="group relative flex flex-col bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all p-2" style={{ '--hover-shadow': 'rgba(218, 119, 86, 0.15)' } as React.CSSProperties}
                  >
                    <div className="p-8 pb-4 flex-1">
                      <div className="flex items-center justify-between mb-8">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <BookOpen className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <LayoutGrid className="w-3 h-3" />
                          {set.cards?.length || 0} Cards
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 transition-colors line-clamp-1 tracking-tight group-hover:opacity-75">{set.title}</h3>
                      <p className="text-sm text-slate-500 mt-3 line-clamp-2 font-medium leading-relaxed">{set.description}</p>
                    </div>
                    
                    <div className="px-8 py-6">
                      <button
                        onClick={() => navigate(`/flashcards/${set.id}`)}
                        className="w-full inline-flex items-center justify-center gap-3 py-5 bg-slate-50 text-slate-900 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all active:scale-[0.98] group-hover:shadow-lg group-hover:shadow-emerald-100"
                      >
                        <BookOpen className="w-5 h-5 fill-current" />
                        Study Cards
                      </button>
                      <div className="mt-6 flex items-center justify-between px-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        <span>Flashcard Module</span>
                        <span>{set.createdAt ? formatDate(set.createdAt.toDate()) : "Latest"}</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )
          )}
        </div>
      </section>
    </div>
  );
}
