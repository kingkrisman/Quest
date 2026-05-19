import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { CreateQuiz } from "./pages/CreateQuiz";
import { Lobby } from "./pages/Lobby";
import { Game } from "./pages/Game";
import { Results } from "./pages/Results";
import { Flashcards } from "./pages/Flashcards";
import { Profile } from "./pages/Profile";
import { Achievements } from "./pages/Achievements";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-gray-50 selection:text-slate-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/dashboard" 
            element={user ? <Dashboard /> : <Navigate to="/" />} 
          />
          <Route 
            path="/create" 
            element={user ? <CreateQuiz /> : <Navigate to="/" />} 
          />
          <Route 
            path="/lobby/:sessionId" 
            element={user ? <Lobby /> : <Navigate to="/" />} 
          />
          <Route 
            path="/game/:sessionId" 
            element={user ? <Game /> : <Navigate to="/" />} 
          />
          <Route 
            path="/results/:sessionId" 
            element={user ? <Results /> : <Navigate to="/" />} 
          />
          <Route
            path="/flashcards/:setId"
            element={user ? <Flashcards /> : <Navigate to="/" />}
          />
          <Route
            path="/profile"
            element={user ? <Profile /> : <Navigate to="/" />}
          />
          <Route
            path="/achievements"
            element={user ? <Achievements /> : <Navigate to="/" />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
