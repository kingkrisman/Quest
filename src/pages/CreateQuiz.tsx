import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, handleSupabaseError, OperationType } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Sparkles, Save, ArrowLeft, Plus, Trash2, HelpCircle, CheckCircle2, FileUp, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateQuizFromTopic, generateFlashcards } from "../lib/gemini";
import { cn } from "../lib/utils";
import { CustomLoader } from "../components/CustomLoader";

export function CreateQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<{ name: string, mimeType: string, data: string }[]>([]);
  const [globalTimeLimit, setGlobalTimeLimit] = useState(20);
  const [generationType, setGenerationType] = useState<"quiz" | "flashcards">("quiz");
  
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    questions: [
      { id: "1", text: "", options: ["", "", "", ""], correctOptionIndex: 0, points: 1000, timeLimit: 20 }
    ]
  });

  const [flashcardData, setFlashcardData] = useState<{ title: string, description: string, cards: { front: string, back: string }[] } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file.size > 10 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Max size is 10MB.`);
            continue;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const raw = event.target?.result as string;
            const base64 = raw.split(",")[1];
            setFiles(prev => [...prev, { name: file.name, mimeType: file.type, data: base64 }]);
        };
        reader.onerror = () => {
            console.error("File reading failed");
        };
        reader.readAsDataURL(file);
    }
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAiGenerate = async () => {
    if (!topic && files.length === 0) return;
    setAiGenerating(true);
    try {
      const topicAndContent = files.length > 0 ? files : topic;
      
      if (generationType === "quiz") {
        const generated = await generateQuizFromTopic(topicAndContent, numQuestions, globalTimeLimit);
        setQuizData({
          title: generated.title || "",
          description: generated.description || "",
          questions: generated.questions.map((q: any, i: number) => ({
            ...q,
            id: String(i + 1),
            points: q.points || 1000,
            timeLimit: q.timeLimit || globalTimeLimit
          }))
        });
        setFlashcardData(null);
      } else {
        const generated = await generateFlashcards(topicAndContent, numQuestions);
        setFlashcardData({
          title: generated.title || "",
          description: generated.description || "",
          cards: generated.cards || []
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate content. Please try again.");
    } finally {
      setAiGenerating(false);
    }
  };

  const addQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: String(Date.now()), text: "", options: ["", "", "", ""], correctOptionIndex: 0, points: 1000, timeLimit: 20 }
      ]
    }));
  };

  const removeQuestion = (id: string) => {
    if (quizData.questions.length === 1) return;
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
  };

  const updateQuestion = (id: string, updates: any) => {
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!user) {
      alert("You must sign in to save a quiz.");
      return;
    }
    if (!quizData.title || quizData.questions.some(q => !q.text || q.options.some(o => !o))) {
      alert("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      if (generationType === "quiz") {
        const payload: any = {
          creator_id: user.id,
          title: quizData.title,
          questions: quizData.questions,
        };
        if (quizData.description) {
          payload.description = quizData.description;
        }
        const { data, error } = await supabase.from('quizzes').insert(payload).select();
        if (error) {
          console.error("Supabase error:", error);
          throw new Error(error.message || "Failed to save quiz");
        }
        alert("Quiz saved successfully!");
        navigate("/dashboard");
      } else {
        if (!flashcardData?.title) {
          alert("Please give your flashcard set a title.");
          return;
        }
        if (!flashcardData?.cards || flashcardData.cards.length === 0) {
          alert("Please generate or create at least one flashcard.");
          return;
        }
        const payload: any = {
          creator_id: user.id,
          title: flashcardData.title,
          cards: flashcardData.cards,
        };
        if (flashcardData.description) {
          payload.description = flashcardData.description;
        }
        const { data, error } = await supabase.from('flashcard_sets').insert(payload).select();
        if (error) {
          console.error("Supabase error:", error);
          throw new Error(error.message || "Failed to save flashcard set");
        }
        alert("Flashcard set saved successfully!");
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Submit error:", err);
      alert(err instanceof Error ? err.message : "Failed to save quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
            {generationType === "quiz" ? "Create New Quiz" : "Create Study Set"}
        </h1>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50" style={{ backgroundColor: "var(--color-accent)" }}
        >
          <Save className="w-4 h-4" />
          {loading ? "Saving..." : "Save Quiz"}
        </button>
      </header>

      <div className="space-y-8">
        {/* AI Generator Section */}
        <div className="p-8 rounded-[2.5rem] border shadow-sm" style={{ backgroundColor: "rgba(218, 119, 86, 0.05)", borderColor: "rgba(218, 119, 86, 0.2)", boxShadow: "0 4px 6px -1px rgba(218, 119, 86, 0.1)" }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>AI Assistant</h3>
            </div>
            <div className="flex bg-white p-1 rounded-xl border" style={{ borderColor: "rgba(218, 119, 86, 0.2)" }}>
               <button
                onClick={() => setGenerationType("quiz")}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-white", generationType === "quiz" ? "shadow-md" : "text-slate-400 bg-white")}
                style={generationType === "quiz" ? { backgroundColor: "var(--color-accent)", boxShadow: "0 4px 6px -1px rgba(218, 119, 86, 0.2)" } : {}}
               >
                 QUIZ
               </button>
               <button
                onClick={() => setGenerationType("flashcards")}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-white", generationType === "flashcards" ? "shadow-md" : "text-slate-400 bg-white")}
                style={generationType === "flashcards" ? { backgroundColor: "var(--color-accent)", boxShadow: "0 4px 6px -1px rgba(218, 119, 86, 0.2)" } : {}}
               >
                 FLASHCARDS
               </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: "var(--color-accent)" }}>Study Topic</label>
                <input
                  type="text"
                  placeholder="Enter a topic (e.g. World History, Javascript Basics...)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-5 py-4 bg-white rounded-2xl focus:ring-2 focus:outline-none transition-all placeholder:text-slate-300 font-medium" style={{ borderColor: "rgba(218, 119, 86, 0.3)", border: "1px solid rgba(218, 119, 86, 0.3)", "--focus-ring": "var(--color-accent)" } as React.CSSProperties}
                />
              </div>
              <div className="sm:w-40">
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: "var(--color-accent)" }}>Items Count</label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full px-4 py-4 bg-white rounded-2xl focus:ring-2 focus:outline-none transition-all font-bold text-slate-700" style={{ borderColor: "rgba(218, 119, 86, 0.3)", border: "1px solid rgba(218, 119, 86, 0.3)" }}
                >
                  {[5, 10, 20, 30, 50, 75, 100].map(n => (
                    <option key={n} value={n}>{n} {generationType === "quiz" ? "Questions" : "Cards"}</option>
                  ))}
                </select>
              </div>
              {generationType === "quiz" && (
                <div className="sm:w-40">
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: "var(--color-accent)" }}>Time Limit</label>
                  <select
                    value={globalTimeLimit}
                    onChange={(e) => setGlobalTimeLimit(Number(e.target.value))}
                    className="w-full px-4 py-4 bg-white rounded-2xl focus:ring-2 focus:outline-none transition-all font-bold text-slate-700" style={{ borderColor: "rgba(218, 119, 86, 0.3)", border: "1px solid rgba(218, 119, 86, 0.3)" }}
                  >
                    {[10, 20, 30, 45, 60, 90, 120].map(n => (
                      <option key={n} value={n}>{n} Seconds</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase tracking-widest px-1" style={{ color: "var(--color-accent)" }}>Source Documents (Optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  htmlFor="file-upload"
                  className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-3xl bg-white/50 hover:bg-white transition-all cursor-pointer group" style={{ borderColor: "rgba(218, 119, 86, 0.3)" }}
                >
                  <input
                    id="file-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                  />
                  <FileUp className="w-8 h-8 group-hover:scale-110 transition-transform mb-2" style={{ color: "var(--color-accent)" }} />
                  <span className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>Upload PDF/Text</span>
                  <span className="text-[10px] text-slate-400 mt-1 uppercase">Max 10MB per file</span>
                </label>

                <div className="flex flex-col gap-2 overflow-y-auto max-h-[120px] scrollbar-hide py-1">
                  <AnimatePresence>
                    {files.map((file, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl" style={{ borderColor: "rgba(218, 119, 86, 0.2)", border: "1px solid rgba(218, 119, 86, 0.2)" }}
                      >
                        <FileText className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                        <span className="text-xs font-medium text-slate-600 truncate flex-1">{file.name}</span>
                        <button 
                          onClick={() => removeFile(i)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {files.length === 0 && (
                    <div className="h-full flex items-center justify-center border border-dashed border-indigo-100 rounded-2xl bg-slate-50/30">
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No documents attached</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <motion.button
              onClick={handleAiGenerate}
              disabled={aiGenerating || (!topic && files.length === 0)}
              whileHover={!aiGenerating && (topic || files.length > 0) ? { scale: 1.02 } : {}}
              whileTap={!aiGenerating && (topic || files.length > 0) ? { scale: 0.98 } : {}}
              className="w-full py-5 text-white rounded-2xl font-black text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
              style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 20px 25px -5px rgba(218, 119, 86, 0.2)" }}
            >
              {aiGenerating ? (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ANALYZING SUBJECT MATTER...
                  </motion.span>
                </motion.div>
              ) : (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="w-6 h-6" />
                  </motion.div>
                  GENERATE {generationType.toUpperCase()} WITH AI
                </motion.div>
              )}
            </motion.button>
          </div>
        </div>

        {/* Generated Content Preview */}
        {generationType === "quiz" ? (
          <form className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
              {/* Quiz Settings */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quiz Identity</label>
                <input
                  type="text"
                  value={quizData.title}
                  onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-xl font-bold"
                  placeholder="Name your quiz..."
                />
              </div>
              <div>
                <textarea
                  value={quizData.description}
                  onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-medium text-slate-500"
                  rows={2}
                  placeholder="What is this quiz about?"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Question Backlog</h3>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{quizData.questions.length} Items</span>
              </div>
              
              {quizData.questions.map((question, qIdx) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group"
                >
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    className="absolute top-6 right-6 p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  <div className="flex items-start gap-4 mb-8">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg shrink-0">
                      {qIdx + 1}
                    </div>
                    <input
                      type="text"
                      value={question.text}
                      onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                      className="flex-1 px-4 py-2 text-2xl font-black border-b-2 border-transparent focus:border-indigo-600 focus:outline-none bg-transparent transition-all tracking-tight leading-tight placeholder:text-slate-200"
                      placeholder="Ask a question..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {question.options.map((option, oIdx) => (
                      <div 
                        key={oIdx} 
                        className={cn(
                          "relative flex items-center p-2 rounded-2xl border-2 transition-all",
                          question.correctOptionIndex === oIdx 
                            ? "border-emerald-500 bg-emerald-50" 
                            : "border-slate-50 bg-slate-50 shadow-inner"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, { correctOptionIndex: oIdx })}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-xl mr-3 transition-all shrink-0",
                            question.correctOptionIndex === oIdx 
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" 
                              : "bg-white text-slate-300 hover:opacity-70"
                          )}
                        >
                          {question.correctOptionIndex === oIdx ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-4 h-4 border-2 border-current rounded-full" />}
                        </button>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...question.options];
                            newOptions[oIdx] = e.target.value;
                            updateQuestion(question.id, { options: newOptions });
                          }}
                          className="flex-1 bg-transparent py-2 pr-4 focus:outline-none font-bold text-slate-700"
                          placeholder={`${String.fromCharCode(65 + oIdx)} Option`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-8">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Velocity Points</span>
                      <select
                        value={question.points}
                        onChange={(e) => updateQuestion(question.id, { points: Number(e.target.value) })}
                        className="text-xs font-black bg-slate-50 border-none rounded-lg py-1.5 px-3 focus:ring-0 cursor-pointer" style={{ color: "var(--color-accent)" }}
                      >
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                        <option value={2000}>2000</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sprint Timer</span>
                      <select
                        value={question.timeLimit}
                        onChange={(e) => updateQuestion(question.id, { timeLimit: Number(e.target.value) })}
                        className="text-xs font-black bg-slate-50 border-none rounded-lg py-1.5 px-3 focus:ring-0 cursor-pointer" style={{ color: "var(--color-accent)" }}
                      >
                        <option value={10}>10s</option>
                        <option value={20}>20s</option>
                        <option value={30}>30s</option>
                        <option value={60}>60s</option>
                        <option value={90}>90s</option>
                        <option value={120}>120s</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              ))}

              <button
                type="button"
                onClick={addQuestion}
                className="w-full py-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400 font-black transition-all flex items-center justify-center gap-3 group hover:text-white" style={{ '--hover-border': 'var(--color-accent)', '--hover-bg': 'rgba(218, 119, 86, 0.05)' } as React.CSSProperties}
              >
                <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                ADD MANUAL STORY
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Set Identity</label>
                  <input
                    type="text"
                    value={flashcardData?.title || ""}
                    onChange={(e) => setFlashcardData(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-xl font-bold"
                    placeholder="Name your set..."
                  />
                </div>
                <div>
                  <textarea
                    value={flashcardData?.description || ""}
                    onChange={(e) => setFlashcardData(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-medium text-slate-500"
                    rows={2}
                    placeholder="What is this set about?"
                  />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {flashcardData?.cards.map((card, idx) => (
                <motion.div 
                   key={idx}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Card #{idx + 1}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl border" style={{ backgroundColor: "rgba(218, 119, 86, 0.05)", borderColor: "rgba(218, 119, 86, 0.1)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 italic" style={{ color: "var(--color-accent)" }}>Front</p>
                      <p className="font-bold text-slate-900">{card.front}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 italic">Back</p>
                      <p className="font-medium text-slate-600 line-clamp-3">{card.back}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
             {!flashcardData && (
                <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900">No cards generated yet</h3>
                  <p className="text-slate-400 mt-1 font-medium">Use the AI Assistant above to create a study set.</p>
                </div>
              )}
          </div>
        )
        }
      </div>
    </div>
  );
}
