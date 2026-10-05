import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { liveErrorMessage } from "../lib/live";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, Button, PageSpinner } from "../components/ui";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { feedback } from "../lib/feedback";
import { spring, springBouncy } from "../lib/motion";

interface Participant {
  id: string;
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  score: number;
}

export function Lobby() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<{ id: string; pin: string; host_id: string; status: string; quiz_id: string } | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const loadParticipants = async () => {
      const { data } = await supabase.from("participants").select("*").eq("session_id", sessionId).order("created_at");
      if (!cancelled) setParticipants((data as Participant[]) || []);
      return (data as Participant[]) || [];
    };

    const join = async () => {
      const { error } = await supabase
        .from("participants")
        .upsert({ session_id: sessionId, user_id: user.id, display_name: user.name, photo_url: user.avatar, score: 0, last_answer_correct: false }, { onConflict: "session_id,user_id" });
      if (error) toast.error("Couldn't join the game", { description: liveErrorMessage(error) });
    };

    (async () => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (cancelled) return;
      if (error || !data) {
        toast.error("That game no longer exists");
        navigate("/");
        return;
      }
      if (data.status === "in-progress") return navigate(`/game/${sessionId}`, { replace: true });
      if (data.status === "finished") return navigate(`/results/${sessionId}`, { replace: true });
      setSession(data);
      supabase
        .from("quizzes")
        .select("title")
        .eq("id", data.quiz_id)
        .single()
        .then(({ data: q }) => !cancelled && setQuizTitle(q?.title ?? ""));
      const ps = await loadParticipants();
      if (!ps.some((p) => p.user_id === user.id)) {
        await join();
        loadParticipants();
      }
    })();

    const channel = supabase
      .channel(`lobby:${sessionId}:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, (payload) => {
        const data = payload.new as typeof session;
        if (data?.status === "in-progress") navigate(`/game/${sessionId}`);
        else if (data) setSession(data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` }, () => {
        feedback("tap");
        loadParticipants();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user.id]);

  const start = async () => {
    if (!sessionId) return;
    setStarting(true);
    const { error } = await supabase.from("sessions").update({ status: "in-progress", current_question_index: 0, question_start_time: new Date().toISOString() }).eq("id", sessionId);
    if (error) {
      toast.error("Couldn't start the game", { description: liveErrorMessage(error) });
      setStarting(false);
    }
  };

  const copyInvite = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(`Join my KÀWÉ game with PIN ${session.pin} at ${window.location.origin}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  if (!session) return <PageSpinner />;
  const isHost = session.host_id === user.id;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-12 text-center">
      <h1 className="t-large text-ink">{quizTitle || "Live Game"}</h1>
      <p className="inline-flex items-center gap-2 t-subhead text-ink-2 mt-2">
        <span className="w-2 h-2 rounded-full bg-green animate-pulse" aria-hidden />
        Lobby open. Players join from the Today screen with this PIN.
      </p>

      <div className="card rounded-[4px] mt-8 p-6 sm:p-8">
        <div className="flex justify-center gap-1.5 sm:gap-2.5">
          {session.pin.split("").map((d, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.05 + i * 0.04 }}
              className={`w-11 h-16 sm:w-16 sm:h-22 rounded-[4px] bg-fill grid place-items-center text-[40px] sm:text-[56px] font-semibold tracking-[-0.02em] tabular-nums text-ink ${i === 2 ? "mr-2 sm:mr-4" : ""}`}
            >
              {d}
            </motion.span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-2.5 mt-7">
          <Button variant="gray" icon={copied ? I.check : I.copy} onClick={copyInvite}>
            {copied ? "Copied" : "Copy Invite"}
          </Button>
          {isHost ? (
            <Button icon={I.play} onClick={start} loading={starting} disabled={participants.length === 0}>
              Start Game
            </Button>
          ) : (
            <span className="h-11 px-5 rounded-full bg-fill t-subhead font-medium text-ink-2 inline-flex items-center justify-center">Waiting for the host…</span>
          )}
        </div>
      </div>

      <div className="mt-8 text-left">
        <p className="flex items-center gap-1.5 t-footnote font-medium text-ink-2 px-1 mb-3">
          <I.users className="w-4 h-4" /> {participants.length} {participants.length === 1 ? "player" : "players"}
        </p>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {participants.map((p) => (
              <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={springBouncy} className="flex items-center gap-2 pl-1 pr-3.5 h-10 rounded-full card">
                <Avatar name={p.display_name || "Player"} value={p.photo_url} size={32} />
                <span className="t-subhead font-medium text-ink">{p.display_name || "Player"}</span>
                {p.user_id === user.id && <span className="t-caption font-semibold text-accent">You</span>}
                {p.user_id === session.host_id && <span className="t-caption font-semibold text-ink-2">Host</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
