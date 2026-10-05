import { supabase } from "./supabase";
import { toLiveQuestions } from "./deck";
import { generatePin } from "./utils";
import type { Deck } from "./store";

/** Publish a local deck to the live tables and open a lobby for it. Returns the new session id. */
export async function hostDeck(deck: Deck, hostId: string): Promise<string> {
  if (deck.items.length < 1) throw new Error("Add at least one question before hosting.");
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({ creator_id: hostId, title: deck.title, description: deck.description || null, questions: toLiveQuestions(deck) })
    .select("id")
    .single();
  if (quizError) throw quizError;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ quiz_id: quiz.id, host_id: hostId, pin: generatePin(), status: "lobby", current_question_index: -1 })
    .select("id")
    .single();
  if (sessionError) throw sessionError;
  return session.id;
}

export function liveErrorMessage(err: unknown) {
  const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
  if (/row-level security|permission|violates|foreign key/i.test(msg)) {
    return "The live-game server rejected this guest. Live games need the database to allow guest players.";
  }
  if (/fetch|network/i.test(msg)) return "Couldn't reach the game server. Check your connection.";
  return msg;
}
