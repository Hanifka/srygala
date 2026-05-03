// lib/useTypewriter.ts

import { useState, useEffect } from "react";

export function useTypewriter(
  words: string[],
  options?: {
    delay?:            number;
    typeSpeed?:        number;
    deleteSpeed?:      number;
    pauseAfterType?:   number;
    pauseAfterDelete?: number;
  }
) {
  const {
    delay            = 800,
    typeSpeed        = 100,
    deleteSpeed      = 60,
    pauseAfterType   = 2000,
    pauseAfterDelete = 500,
  } = options || {};

  const [displayed, setDisplayed] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase]         = useState<"wait" | "typing" | "pause" | "deleting">("wait");

  const currentWord = words[wordIndex % words.length];

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === "wait") {
      timer = setTimeout(() => setPhase("typing"), delay);

    } else if (phase === "typing") {
      if (displayed.length < currentWord.length) {
        timer = setTimeout(() => {
          setDisplayed(currentWord.slice(0, displayed.length + 1));
        }, typeSpeed);
      } else {
        timer = setTimeout(() => setPhase("pause"), pauseAfterType);
      }

    } else if (phase === "pause") {
      timer = setTimeout(() => setPhase("deleting"), 100);

    } else if (phase === "deleting") {
      if (displayed.length > 0) {
        timer = setTimeout(() => {
          setDisplayed((prev) => prev.slice(0, prev.length - 1));
        }, deleteSpeed);
      } else {
        // Word fully deleted — move to next word after pause
        timer = setTimeout(() => {
          setWordIndex((i) => i + 1);
          setPhase("typing");
        }, pauseAfterDelete);
      }
    }

    return () => clearTimeout(timer);
  }, [phase, displayed, currentWord, delay, typeSpeed, deleteSpeed, pauseAfterType, pauseAfterDelete]);

  const showCursor = phase === "typing" || phase === "deleting";

  return { displayed, showCursor };
}
