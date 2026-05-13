import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { LogIn, LogOut, User } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (authMode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split("@")[0]
            }
          }
        });
        if (error) {
          console.error("Signup error:", error);
          throw error;
        }
        setEmail("");
        setPassword("");
        setShowAuthModal(false);
        alert("Account created! You can now sign in.");
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          console.error("Sign in error:", error);
          throw error;
        }
        setEmail("");
        setPassword("");
        setShowAuthModal(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      console.error("Auth error:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        throw error;
      }
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError("");

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      });
      if (error) throw error;
      setShowProfileModal(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:rotate-6 transition-transform shadow-lg shadow-indigo-100">
            <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45"></div>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            QuizPulse<span className="text-indigo-600">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Live Sync
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-sm font-semibold text-slate-900">{user.displayName}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Active Player</span>
                  </div>
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-100 cursor-pointer hover:ring-indigo-300 transition-all"
                    alt="User"
                    onClick={() => setShowProfileModal(true)}
                  />
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {authMode === "login" ? "Sign In" : "Create Account"}
            </h2>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:bg-slate-400"
              >
                {loading ? "Loading..." : authMode === "login" ? "Sign In" : "Sign Up"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-600 text-sm">
                {authMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setError("");
                  }}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  {authMode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>

            <button
              onClick={() => {
                setShowAuthModal(false);
                setError("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User className="w-6 h-6" />
              Edit Profile
            </h2>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>

              <div className="text-sm text-slate-500">
                <p><strong>Email:</strong> {user?.email}</p>
              </div>

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                  {profileError}
                </div>
              )}

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:bg-slate-400"
              >
                {profileLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>

            <button
              onClick={() => {
                setShowProfileModal(false);
                setProfileError("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}
    </nav>
  );
}
