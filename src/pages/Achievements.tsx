import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Award, Zap, TrendingUp, Flame, Brain, BookOpen, CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import { CustomLoader } from "../components/CustomLoader";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  condition: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export function Achievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ quizzesCompleted: 0, perfectScores: 0, streak: 0 });

  useEffect(() => {
    if (user) {
      fetchAchievements();
    }
  }, [user]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      // Fetch user stats
      const { data: scores } = await supabase
        .from("quiz_scores")
        .select("score, max_score, created_at")
        .eq("user_id", user?.id);

      const quizzesCompleted = scores?.length || 0;
      const perfectScores = scores?.filter((s: any) => s.score === s.max_score).length || 0;

      setStats({
        quizzesCompleted,
        perfectScores,
        streak: 0, // Calculate actual streak from dates
      });

      // Define achievements
      const achList: Achievement[] = [
        {
          id: "first-quiz",
          name: "Getting Started",
          description: "Complete your first quiz",
          icon: <BookOpen className="w-8 h-8" />,
          condition: "Complete 1 quiz",
          unlocked: quizzesCompleted >= 1,
          progress: Math.min(quizzesCompleted, 1),
          maxProgress: 1,
        },
        {
          id: "quiz-master",
          name: "Quiz Master",
          description: "Complete 10 quizzes",
          icon: <Brain className="w-8 h-8" />,
          condition: "Complete 10 quizzes",
          unlocked: quizzesCompleted >= 10,
          progress: Math.min(quizzesCompleted, 10),
          maxProgress: 10,
        },
        {
          id: "perfect-score",
          name: "Perfect Score",
          description: "Score 100% on a quiz",
          icon: <CheckCircle className="w-8 h-8" />,
          condition: "Get 100% on 1 quiz",
          unlocked: perfectScores >= 1,
          progress: Math.min(perfectScores, 1),
          maxProgress: 1,
        },
        {
          id: "perfectionist",
          name: "Perfectionist",
          description: "Score 100% on 5 quizzes",
          icon: <Zap className="w-8 h-8" />,
          condition: "Get 100% on 5 quizzes",
          unlocked: perfectScores >= 5,
          progress: Math.min(perfectScores, 5),
          maxProgress: 5,
        },
        {
          id: "on-fire",
          name: "On Fire",
          description: "Complete 5 quizzes in one day",
          icon: <Flame className="w-8 h-8" />,
          condition: "Complete 5 quizzes in 1 day",
          unlocked: false,
          progress: 0,
          maxProgress: 5,
        },
        {
          id: "dedicated-student",
          name: "Dedicated Student",
          description: "Complete 50 quizzes total",
          icon: <TrendingUp className="w-8 h-8" />,
          condition: "Complete 50 quizzes",
          unlocked: quizzesCompleted >= 50,
          progress: Math.min(quizzesCompleted, 50),
          maxProgress: 50,
        },
      ];

      setAchievements(achList);
    } catch (err) {
      console.error("Error fetching achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view achievements</h2>
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Achievements</h1>
        </div>
        <p className="text-slate-500 font-medium">Unlock badges by reaching milestones</p>
      </motion.header>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12"
      >
        {[
          { label: "Badges Unlocked", value: unlockedCount, total: achievements.length },
          { label: "Quizzes Completed", value: stats.quizzesCompleted, total: null },
          { label: "Perfect Scores", value: stats.perfectScores, total: null },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black text-slate-900">{stat.value}</h3>
              {stat.total && <p className="text-xl text-slate-400">/ {stat.total}</p>}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Achievements Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <CustomLoader />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border-2 p-6 transition-all ${
                achievement.unlocked
                  ? "bg-white border-amber-200 shadow-lg"
                  : "bg-slate-50 border-slate-200 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: achievement.unlocked ? "rgba(218, 119, 86, 0.1)" : "rgba(0, 0, 0, 0.05)",
                    color: achievement.unlocked ? "var(--color-accent)" : "#94a3b8",
                  }}
                >
                  {achievement.icon}
                </div>
                {achievement.unlocked && (
                  <CheckCircle className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
                )}
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-1">{achievement.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{achievement.description}</p>

              {achievement.maxProgress && achievement.maxProgress > 0 && (
                <div className="space-y-2">
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full"
                      style={{ backgroundColor: "var(--color-accent)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${((achievement.progress || 0) / achievement.maxProgress) * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 font-bold">
                    {achievement.progress} / {achievement.maxProgress}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
