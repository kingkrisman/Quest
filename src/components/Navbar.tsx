import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { LogOut } from "lucide-react";
import { motion } from "motion/react";
import { useState, FormEvent } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<"email" | "password">("email");
  const [passwordInput, setPasswordInput] = useState("");

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: err } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
      });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      setShowAuthModal(false);
      setEmailInput("");
      setPasswordInput("");
      setAuthStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!emailInput.trim()) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);
    setAuthStep("password");
    setLoading(false);
  };

  const handlePasswordAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (err) {
        if (err.message.includes("Invalid login credentials")) {
          // User doesn't exist, do signup instead
          const { error: signupErr } = await supabase.auth.signUp({
            email: emailInput,
            password: passwordInput,
          });
          if (signupErr) {
            setError(signupErr.message);
            setLoading(false);
            return;
          }
        } else {
          setError(err.message);
          setLoading(false);
          return;
        }
      }

      setShowAuthModal(false);
      setEmailInput("");
      setPasswordInput("");
      setAuthStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group min-w-0">
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ backgroundColor: "#DA7756", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.2)" }}
            whileHover={{ rotate: 6, scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4L6 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M6 10L16 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 14L18 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="18" cy="14" r="2.5" fill="white" />
            </svg>
          </motion.div>
          <motion.span
            className="text-base sm:text-xl font-bold tracking-tight text-slate-900 truncate"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            KÀWÉ
          </motion.span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Live Sync
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:opacity-70 transition-opacity flex-shrink-0"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200">
                  <div className="flex-col items-end hidden sm:flex">
                    <span className="text-sm font-semibold text-slate-900 truncate">{user.user_metadata?.displayName || user.email?.split("@")[0]}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Active Player</span>
                  </div>
                  <Link
                    to="/profile"
                    className="transition-all flex-shrink-0 hover:scale-110"
                  >
                    <img
                      src={user.user_metadata?.photoURL || `https://ui-avatars.com/api/?name=${user.email}`}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-100"
                      alt="User"
                    />
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-1 sm:p-2 text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <motion.button
                onClick={() => {
                  setShowAuthModal(true);
                  setAuthStep("email");
                  setError("");
                  setEmailInput("");
                  setPasswordInput("");
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 sm:px-5 py-2 text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl shadow-lg flex-shrink-0 whitespace-nowrap transition-all"
                style={{ backgroundColor: "#DA7756", boxShadow: "0 10px 15px -3px rgba(218, 119, 86, 0.2)" }}
              >
                Sign In
              </motion.button>
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
            {authStep === "email" ? (
              <>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Sign In</h2>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                      {error}
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                    style={{ backgroundColor: "#DA7756" }}
                  >
                    Continue
                  </motion.button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Enter Password</h2>
                <p className="text-slate-600 text-sm mb-6">{emailInput}</p>
                <form onSubmit={handlePasswordAuth} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter password or create new account"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">If you don't have an account, enter a password to create one</p>
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                      {error}
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                    style={{ backgroundColor: "#DA7756" }}
                  >
                    {loading ? "Authenticating..." : "Sign In"}
                  </motion.button>
                </form>

                <button
                  onClick={() => {
                    setAuthStep("email");
                    setPasswordInput("");
                    setError("");
                  }}
                  className="mt-4 w-full py-2 text-slate-600 text-sm hover:text-slate-900 transition-colors"
                >
                  Back to Email
                </button>
              </>
            )}

            <button
              onClick={() => {
                setShowAuthModal(false);
                setError("");
                setAuthStep("email");
                setEmailInput("");
                setPasswordInput("");
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
