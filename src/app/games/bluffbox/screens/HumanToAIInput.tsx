"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface HumanToAIInputProps {
  aiName: string;
  onSubmit: (text: string) => void;
}

export default function HumanToAIInput({ aiName, onSubmit }: HumanToAIInputProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!text.trim()) return;
    setSubmitting(true);
    onSubmit(text.trim());
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h2 className="text-center text-lg font-bold text-white">
        What did you tell {aiName}?
      </h2>
      <p className="max-w-xs text-center text-sm text-white/40">
        Type what you told them — truth or lie — and they&apos;ll try to figure it out.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="I told them..."
        rows={3}
        className="w-full max-w-sm resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40"
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
        className="w-full max-w-sm rounded-xl bg-amber-500 py-4 text-lg font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : "Submit"}
      </button>
    </div>
  );
}
