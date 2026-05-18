import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "./supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export async function createTestQuiz(userId: string) {
  const testQuiz = {
    creator_id: userId,
    title: "Test Sprint - General Knowledge",
    description: "A sample quiz to test the game mechanics and features.",
    questions: [
      {
        id: "1",
        text: "What is the capital of France?",
        options: ["London", "Berlin", "Paris", "Madrid"],
        correctOptionIndex: 2,
        points: 1000,
        timeLimit: 15
      },
      {
        id: "2",
        text: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correctOptionIndex: 1,
        points: 1000,
        timeLimit: 15
      },
      {
        id: "3",
        text: "What is the largest ocean on Earth?",
        options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
        correctOptionIndex: 3,
        points: 1000,
        timeLimit: 15
      },
      {
        id: "4",
        text: "Who wrote Romeo and Juliet?",
        options: ["Jane Austen", "William Shakespeare", "Charles Dickens", "Mark Twain"],
        correctOptionIndex: 1,
        points: 1000,
        timeLimit: 15
      },
      {
        id: "5",
        text: "What is the chemical symbol for Gold?",
        options: ["Go", "Gd", "Au", "Ag"],
        correctOptionIndex: 2,
        points: 1000,
        timeLimit: 15
      }
    ]
  };

  try {
    const { data, error } = await supabase.from('quizzes').insert(testQuiz).select();
    if (error) throw error;
    return data?.[0];
  } catch (err) {
    console.error("Failed to create test quiz:", err);
    return null;
  }
}
