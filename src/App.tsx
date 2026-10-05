import { Suspense, lazy, useEffect, useRef, type ComponentType } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MotionConfig, motion } from "motion/react";
import { AuthProvider } from "./contexts/AuthContext";
import { IMMERSIVE, Masthead, TabBar } from "./components/Navbar";
import { I } from "./components/icons";
import { Toaster, toast } from "./components/Toaster";
import { levelInfo, onAchievement, onStorageError, useStore } from "./lib/store";
import { celebrate, feedback } from "./lib/feedback";
import { easeOut } from "./lib/motion";
import { PageSpinner } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";

// Home ships in the main bundle; every other page loads on first visit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = <K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const Dashboard = page(() => import("./pages/Dashboard"), "Dashboard");
const CreateQuiz = page(() => import("./pages/CreateQuiz"), "CreateQuiz");
const DeckDetail = page(() => import("./pages/DeckDetail"), "DeckDetail");
const Flashcards = page(() => import("./pages/Flashcards"), "Flashcards");
const Learn = page(() => import("./pages/Learn"), "Learn");
const Match = page(() => import("./pages/Match"), "Match");
const Focus = page(() => import("./pages/Focus"), "Focus");
const Achievements = page(() => import("./pages/Achievements"), "Achievements");
const Profile = page(() => import("./pages/Profile"), "Profile");
const Lobby = page(() => import("./pages/Lobby"), "Lobby");
const Game = page(() => import("./pages/Game"), "Game");
const Results = page(() => import("./pages/Results"), "Results");
const Import = page(() => import("./pages/Import"), "Import");
const Exam = page(() => import("./pages/Exam"), "Exam");
const NotFound = page(() => import("./pages/NotFound"), "NotFound");

function Celebrations() {
  const { xp } = useStore();
  const level = levelInfo(xp).level;
  const prevLevel = useRef(level);

  useEffect(() => {
    if (level > prevLevel.current) {
      feedback("levelUp");
      celebrate();
      toast.reward(`Level ${level}`, { description: "You're getting sharper every session.", icon: I.rocket });
    }
    prevLevel.current = level;
  }, [level]);

  useEffect(
    () =>
      onAchievement((a) => {
        feedback("complete");
        toast.reward(`Award earned: ${a.name}`, { description: a.description, icon: I[a.icon] });
      }),
    []
  );
  useEffect(() => {
    let warned = false;
    return onStorageError(() => {
      if (warned) return;
      warned = true;
      toast.error("Couldn't save your latest progress", { description: "This device's storage is full or blocked. Download a backup in Settings, then delete decks you no longer need.", duration: 10000 });
    });
  }, []);

  useEffect(() => {
    const offline = () => toast.info("You're offline", { description: "Studying still works. Live games need a connection." });
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, []);
  return null;
}

function Shell() {
  const location = useLocation();
  const immersive = IMMERSIVE.test(location.pathname);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      {!immersive && <Masthead />}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-200 focus:inline-flex focus:items-center focus:h-10 focus:px-4 focus:rounded-full focus:bg-accent focus:text-white font-semibold">
        Skip to content
      </a>
      <main id="main" tabIndex={-1} className={immersive ? "outline-none" : "outline-none pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0"}>
        {/* New page fades in immediately. No exit animation and no wait, so navigation never feels delayed. */}
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: easeOut }}>
          <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageSpinner />}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/library" element={<Dashboard />} />
              <Route path="/dashboard" element={<Navigate to="/library" replace />} />
              <Route path="/create" element={<CreateQuiz />} />
              <Route path="/edit/:deckId" element={<CreateQuiz />} />
              <Route path="/deck/:deckId" element={<DeckDetail />} />
              <Route path="/study/:deckId/cards" element={<Flashcards />} />
              <Route path="/study/:deckId/learn" element={<Learn />} />
              <Route path="/study/:deckId/test" element={<Learn timed />} />
              <Route path="/study/:deckId/match" element={<Match />} />
              <Route path="/study/:deckId/exam" element={<Exam />} />
              <Route path="/import" element={<Import />} />
              <Route path="/scan" element={<Navigate to="/import" replace />} />
              <Route path="/review" element={<Flashcards />} />
              <Route path="/focus" element={<Focus />} />
              <Route path="/stats" element={<Achievements />} />
              <Route path="/achievements" element={<Navigate to="/stats" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/lobby/:sessionId" element={<Lobby />} />
              <Route path="/game/:sessionId" element={<Game />} />
              <Route path="/results/:sessionId" element={<Results />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </motion.div>
      </main>
      {!immersive && <TabBar />}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <Shell />
          <Toaster />
          <Celebrations />
        </AuthProvider>
      </MotionConfig>
    </Router>
  );
}
