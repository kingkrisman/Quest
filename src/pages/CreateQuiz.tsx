import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, handleSupabaseError, OperationType } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Sparkles, Save, ArrowLeft, Plus, Trash2, HelpCircle, CheckCircle2, FileUp, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateQuizFromTopic, generateFlashcards } from "../lib/gemini";
import { cn } from "../lib/utils";

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
      alert("You must be logged in to save a quiz.");
      return;
    }
    if (!quizData.title || quizData.questions.some(q => !q.text || q.options.some(o => !o))) {
      alert("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      if (generationType === "quiz") {
        const { data, error } = await supabase.from('quizzes').insert({
          creator_id: user?.id,
          title: quizData.title,
          questions: quizData.questions,
        }).select();
        if (error) {
          console.error("Supabase error:", error);
          throw new Error(error.message || "Failed to save quiz");
        }
        alert("Quiz saved successfully!");
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.from('flashcard_sets').insert({
          creator_id: user?.id,
          title: flashcardData?.title,
          cards: flashcardData?.cards,
        }).select();
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
          className="p-2 -ml-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
            {generationType === "quiz" ? "Create New Quiz" : "Create Study Set"}
        </h1>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? "Saving..." : "Save Quiz"}
        </button>
      </header>

      <div className="space-y-8">
        {/* AI Generator Section */}
        <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm shadow-indigo-100/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">AI Assistant</h3>
            </div>
            <div className="flex bg-white p-1 rounded-xl border border-indigo-100">
               <button 
                onClick={() => setGenerationType("quiz")}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", generationType === "quiz" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-400 hover:text-indigo-600")}
               >
                 QUIZ
               </button>
               <button 
                onClick={() => setGenerationType("flashcards")}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", generationType === "flashcards" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-400 hover:text-indigo-600")}
               >
                 FLASHCARDS
               </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 px-1">Study Topic</label>
                <input
                  type="text"
                  placeholder="Enter a topic (e.g. World History, Javascript Basics...)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-300 font-medium"
                />
              </div>
              <div className="sm:w-40">
                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 px-1">Items Count</label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full px-4 py-4 bg-white border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-bold text-slate-700"
                >
                  {[5, 10, 20, 30, 50, 75, 100].map(n => (
                    <option key={n} value={n}>{n} {generationType === "quiz" ? "Questions" : "Cards"}</option>
                  ))}
                </select>
              </div>
              {generationType === "quiz" && (
                <div className="sm:w-40">
                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 px-1">Time Limit</label>
                  <select
                    value={globalTimeLimit}
                    onChange={(e) => setGlobalTimeLimit(Number(e.target.value))}
                    className="w-full px-4 py-4 bg-white border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-bold text-slate-700"
                  >
                    {[10, 20, 30, 45, 60, 90, 120].map(n => (
                      <option key={n} value={n}>{n} Seconds</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Source Documents (Optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label 
                  htmlFor="file-upload"
                  className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-200 rounded-3xl bg-white/50 hover:bg-white hover:border-indigo-400 transition-all cursor-pointer group"
                >
                  <input 
                    id="file-upload"
                    type="file" 
                    className="sr-only" 
                    multiple 
                    accept=".pdf,.txt" 
                    onChange={handleFileChange}
                  />
                  <FileUp className="w-8 h-8 text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
                  <span className="text-xs font-bold text-indigo-600">Upload PDF/Text</span>
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
                        className="flex items-center gap-3 p-3 bg-white border border-indigo-100 rounded-xl"
                      >
                        <FileText className="w-4 h-4 text-indigo-600" />
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

            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || (!topic && files.length === 0)}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
            >
              {aiGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ANALYZING SUBJECT MATTER...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  GENERATE {generationType.toUpperCase()} WITH AI
                </>
              )}
            </button>
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
                              : "bg-white text-slate-300 hover:text-indigo-600"
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
                        className="text-xs font-black bg-slate-50 border-none rounded-lg py-1.5 px-3 focus:ring-0 text-indigo-600 cursor-pointer"
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
                        className="text-xs font-black bg-slate-50 border-none rounded-lg py-1.5 px-3 focus:ring-0 text-indigo-600 cursor-pointer"
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
                className="w-full py-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-600 font-black transition-all flex items-center justify-center gap-3 group"
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
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Card #{idx + 1}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-50">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1 italic">Front</p>
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
