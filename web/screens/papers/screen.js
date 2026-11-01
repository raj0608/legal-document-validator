// "My papers": what happens when a paper is added or removed, and the buttons that start the explanation and the chat.
import { $ } from "/web/shared/lib/dom.js";
import { registerSlot } from "/web/shared/ui/document-slot.js";
import { refreshStepControls } from "/web/shared/layout/router.js";
import { autoDatesFromPapers, renderFound } from "/web/screens/papers/components/found-in-paper.js";
import { abortChat, resetChat, ask } from "/web/screens/papers/components/chat.js";
import { explain } from "/web/screens/papers/components/explanation.js";

export function registerPapersSlot() {
  registerSlot("papers", {
    onLoad() {
      resetChat(); autoDatesFromPapers(); renderFound(); refreshStepControls();
      $("papersNext1").focus(); // the next thing to do, and it scrolls into view on a phone
    },
    onRemove() { resetChat(); refreshStepControls(); }
  });
}

export function initPapers() {
  $("explainBtn").addEventListener("click", explain);
  $("askBtn").addEventListener("click", () => ask($("askInput").value));
  $("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($("askInput").value); } });
  $("stopBtn").addEventListener("click", abortChat);
}
