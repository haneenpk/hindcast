export interface ReportWidget {
  element: HTMLElement;
  destroy(): void;
}

// The whole widget lives in a shadow root: host-page CSS can't restyle
// it, and its styles can't leak out. The host element carries rrweb's
// block class so the recording never contains the widget itself — or
// the comment being typed into it.
const TEMPLATE = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .btn {
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
    background: #16161a; color: #f4f4f5;
    border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 999px;
    padding: 9px 15px; font-size: 13px; font-weight: 500; line-height: 1;
    cursor: pointer; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  }
  .btn:hover { background: #1f1f24; }
  .panel {
    position: fixed; right: 16px; bottom: 60px; z-index: 2147483001;
    width: 280px; background: #16161a; color: #f4f4f5;
    border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 10px;
    padding: 14px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  }
  .title { font-size: 13px; font-weight: 600; margin: 0 0 2px; }
  .note { font-size: 11.5px; color: #9a9aa3; margin: 0 0 10px; }
  textarea {
    width: 100%; height: 72px; resize: none;
    background: #0d0d0f; color: #f4f4f5;
    border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 6px;
    padding: 8px; font-size: 13px;
  }
  textarea:focus { outline: 1px solid rgba(255, 255, 255, 0.3); }
  .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  .cancel {
    background: none; border: none; color: #9a9aa3;
    font-size: 12.5px; cursor: pointer; padding: 7px 8px;
  }
  .cancel:hover { color: #f4f4f5; }
  .send {
    background: #f4f4f5; color: #111; border: none; border-radius: 6px;
    padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  }
  .send:hover { opacity: 0.9; }
  .thanks { font-size: 13px; margin: 4px 0; }
  [hidden] { display: none; }
</style>
<button type="button" class="btn" part="button">Report a bug</button>
<div class="panel" hidden>
  <p class="title">Report a bug</p>
  <p class="note">The session so far is attached automatically.</p>
  <textarea placeholder="What went wrong? (optional)"></textarea>
  <div class="row">
    <button type="button" class="cancel">Cancel</button>
    <button type="button" class="send">Send report</button>
  </div>
</div>
`;

export function createReportWidget(options: {
  onSubmit(comment: string): void;
}): ReportWidget | null {
  try {
    const host = document.createElement("div");
    host.className = "rr-block";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = TEMPLATE;

    const button = root.querySelector<HTMLButtonElement>(".btn")!;
    const panel = root.querySelector<HTMLElement>(".panel")!;
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea")!;
    const cancel = root.querySelector<HTMLButtonElement>(".cancel")!;
    const send = root.querySelector<HTMLButtonElement>(".send")!;

    let thanksTimer: ReturnType<typeof setTimeout> | null = null;

    const close = (): void => {
      panel.hidden = true;
    };

    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) textarea.focus();
    });
    cancel.addEventListener("click", close);
    send.addEventListener("click", () => {
      try {
        options.onSubmit(textarea.value.trim());
      } catch {
        /* reporting must never break the page it reports on */
      }
      textarea.value = "";
      const form = [...panel.children].filter(
        (child) => child.tagName !== "STYLE",
      );
      for (const child of form) (child as HTMLElement).hidden = true;
      const thanks = document.createElement("p");
      thanks.className = "thanks";
      thanks.textContent = "Thanks — the team got it.";
      panel.appendChild(thanks);
      thanksTimer = setTimeout(() => {
        thanks.remove();
        for (const child of form) (child as HTMLElement).hidden = false;
        close();
      }, 1800);
    });

    return {
      element: host,
      destroy() {
        if (thanksTimer) clearTimeout(thanksTimer);
        host.remove();
      },
    };
  } catch {
    return null;
  }
}
