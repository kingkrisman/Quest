import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Medal, Zap } from "lucide-react";
import { motion } from "motion/react";
import { CustomLoader } from "../components/CustomLoader";

interface LeaderboardEntry {
  user_id: string;
  user_email: string;
  user_name: string;
  total_score: number;
  quizzes_completed: number;
  rank: number;
}

export function Leaderboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"all" | "week" | "month">("all");

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Get quiz scores
      const { data: scores } = await supabase
        .from("quiz_scores")
        .select("user_id, score, created_at")
        .order("score", { ascending: false });

      // Aggregate scores by user
      const userScores: { [key: string]: { total: number; quizzes: number; email: string; name: string } } = {};

      scores?.forEach((score: any) => {
        if (!userScores[score.user_id]) {
          userScores[score.user_id] = { total: 0, quizzes: 0, email: "", name: "" };
        }
        userScores[score.user_id].total += score.score;
        userScores[score.user_id].quizzes += 1;
      });

      // Fetch user details
      const leaderboardData: LeaderboardEntry[] = [];
      for (const [userId, data] of Object.entries(userScores)) {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        leaderboardData.push({
          user_id: userId,
          user_email: userData?.user?.email || "Unknown",
          user_name: userData?.user?.user_metadata?.displayName || userData?.user?.email?.split("@")[0] || "User",
          total_score: data.total,
          quizzes_completed: data.quizzes,
          rank: 0,
        });
      }

      // Sort and assign ranks
      leaderboardData.sort((a, b) => b.total_score - a.total_score);
      leaderboardData.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setLeaderboard(leaderboardData);

      // Set user's rank
      if (user) {
        const userEntry = leaderboardData.find((entry) => entry.user_id === user.id);
        setUserRank(userEntry || null);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view leaderboard</h2>
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
          <Trophy className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Leaderboard</h1>
        </div>
        <p className="text-slate-500 font-medium">See how you rank against other students</p>
      </motion.header>

      {/* Timeframe Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-slate-100 w-fit"
      >
        {(["all", "week", "month"] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              timeframe === tf
                ? "text-white shadow-lg"
                : "text-slate-400 hover:text-slate-600"
            }`}
            style={timeframe === tf ? { backgroundColor: "var(--color-accent)" } : {}}
          >
            {tf === "all" ? "All Time" : tf === "week" ? "This Week" : "This Month"}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <CustomLoader />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-2xl font-black text-slate-900">Top Performers</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {leaderboard.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p>No scores yet. Complete a quiz to appear on the leaderboard!</p>
                </div>
              ) : (
                leaderboard.slice(0, 10).map((entry, index) => {
                  const isCurrentUser = user?.id === entry.user_id;
                  const getMedalIcon = () => {
                    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-500" />;
                    if (index === 1) return <Medal className="w-6 h-6 text-gray-400" />;
                    if (index === 2) return <Medal className="w-6 h-6 text-orange-600" />;
                    return null;
                  };

                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-6 flex items-center justify-between ${
                        isCurrentUser ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-white" style={{ backgroundColor: "var(--color-accent)" }}>
                          {getMedalIcon() ? (
                            getMedalIcon()
                          ) : (
                            <span className="text-lg">{entry.rank}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{entry.user_name}</h3>
                          <p className="text-sm text-slate-500">{entry.quizzes_completed} quizzes completed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black" style={{ color: "var(--color-accent)" }}>
                          {entry.total_score}
                        </div>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Points</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* User's Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
                <h3 className="text-lg font-black text-slate-900">Your Rank</h3>
              </div>

              {userRank ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1">Position</p>
                    <p className="text-5xl font-black" style={{ color: "var(--color-accent)" }}>
                      #{userRank.rank}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1">Total Points</p>
                    <p className="text-4xl font-black text-slate-900">{userRank.total_score}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1">Quizzes</p>
                    <p className="text-3xl font-black text-slate-900">{userRank.quizzes_completed}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">Complete a quiz to appear on the leaderboard!</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
