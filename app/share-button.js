"use client";
import { useState } from "react";

// Share is the growth loop: a win posted to a group chat is worth more than any
// ad. Uses the OS sheet on phones, clipboard elsewhere, and always shows the
// same honest line rather than a brag that outruns the record.
export default function ShareButton({ text, path, small }) {
  const [done, setDone] = useState("");

  async function go(e) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    const payload = `${text}\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "TipLab", text, url });
        return;
      }
    } catch {
      /* user dismissed the sheet — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(payload);
      setDone("Copied");
      setTimeout(() => setDone(""), 1800);
    } catch {
      setDone("Copy failed");
      setTimeout(() => setDone(""), 1800);
    }
  }

  return (
    <button className={"share" + (small ? " small" : "")} onClick={go} title="Share this">
      {done || "↗ Share"}
    </button>
  );
}
