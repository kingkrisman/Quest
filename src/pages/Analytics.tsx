import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { BarChart3, TrendingUp, Calendar, Target } from "lucide-react";
import { motion } from "motion/react";
import { CustomLoader } from "../components/CustomLoader";

interface QuizScore {
  quiz_id: string;
  quiz_title: string;
  score: number;
  max_score: number;
  created_at: string;
}

interface AnalyticsData {
  totalQuizzes: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalPoints: number;
  scoresByDay: { day: string; count: number }[];
  recentScores: QuizScore[];
}

export function Analytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: scores } = await supabase
        .from("quiz_scores")
        .select("quiz_id, quiz_title, score, max_score, created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (!scores || scores.length === 0) {
        setAnalytics({
          totalQuizzes: 0,
          averageScore: 0,
          bestScore: 0,
          worstScore: 0,
          totalPoints: 0,
          scoresByDay: [],
          recentScores: [],
        });
        setLoading(false);
        return;
      }

      const totalPoints = scores.reduce((sum: number, s: any) => sum + s.score, 0);
      const bestScore = Math.max(...scores.map((s: any) => s.score));
      const worstScore = Math.min(...scores.map((s: any) => s.score));
      const averageScore = Math.round(totalPoints / scores.length);

      // Calculate scores by day (last 7 days)
      const last7Days: { [key: string]: number } = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayKey = date.toLocaleDateString("en-US", { weekday: "short" });
        last7Days[dayKey] = 0;
      }

      scores.forEach((score: any) => {
        const scoreDate = new Date(score.created_at);
        const dayKey = scoreDate.toLocaleDateString("en-US", { weekday: "short" });
        if (dayKey in last7Days) {
          last7Days[dayKey]++;
        }
      });

      const scoresByDay = Object.entries(last7Days).map(([day, count]) => ({
        day,
        count,
      }));

      setAnalytics({
        totalQuizzes: scores.length,
        averageScore,
        bestScore,
        worstScore,
        totalPoints,
        scoresByDay,
        recentScores: scores.slice(0, 10),
      });
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view analytics</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <CustomLoader />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <h2 className="text-2xl font-bold mb-4">No data yet</h2>
        <p className="text-slate-500">Complete some quizzes to see your analytics</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Your Progress</h1>
        </div>
        <p className="text-slate-500 font-medium">Track your performance and learning journey</p>
      </motion.header>

      {/* Main Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
      >
        {[
          { label: "Total Quizzes", value: analytics.totalQuizzes, icon: Target },
          { label: "Average Score", value: `${analytics.averageScore}%`, icon: TrendingUp },
          { label: "Best Score", value: `${analytics.bestScore}`, icon: BarChart3 },
          { label: "Total Points", value: analytics.totalPoints, icon: Calendar },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <Icon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              </div>
              <h3 className="text-4xl font-black text-slate-900">{stat.value}</h3>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Activity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-12"
      >
        <h2 className="text-2xl font-black text-slate-900 mb-8">Activity (Last 7 Days)</h2>

        <div className="flex items-end justify-between h-64 gap-4">
          {analytics.scoresByDay.map((day, index) => {
            const maxCount = Math.max(...analytics.scoresByDay.map((d) => d.count), 1);
            const height = (day.count / maxCount) * 100;

            return (
              <motion.div
                key={index}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="flex-1 bg-gradient-to-t rounded-lg shadow-sm group relative cursor-default"
                style={{
                  backgroundImage: `linear-gradient(to top, var(--color-accent), rgba(218, 119, 86, 0.5))`,
                  minHeight: "20px",
                }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm font-bold text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {day.count}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-between mt-8 text-xs font-bold text-slate-500 uppercase tracking-widest">
          {analytics.scoresByDay.map((day, index) => (
            <span key={index}>{day.day}</span>
          ))}
        </div>
      </motion.div>

      {/* Recent Quizzes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100">
          <h2 className="text-2xl font-black text-slate-900">Recent Quizzes</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {analytics.recentScores.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p>No quizzes taken yet</p>
            </div>
          ) : (
            analytics.recentScores.map((score, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <h3 className="font-bold text-slate-900">{score.quiz_title}</h3>
                  <p className="text-sm text-slate-500">
                    {new Date(score.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black" style={{ color: "var(--color-accent)" }}>
                    {Math.round((score.score / score.max_score) * 100)}%
                  </div>
                  <p className="text-xs text-slate-400">
                    {score.score} / {score.max_score}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
