import { afterEach, describe, expect, it, vi } from "vitest";
import { createReportWidget } from "./widget";

afterEach(() => {
  document.body.innerHTML = "";
});

function parts(widget: NonNullable<ReturnType<typeof createReportWidget>>) {
  const root = widget.element.shadowRoot!;
  return {
    root,
    button: root.querySelector<HTMLButtonElement>(".btn")!,
    panel: root.querySelector<HTMLElement>(".panel")!,
    textarea: root.querySelector<HTMLTextAreaElement>("textarea")!,
    send: root.querySelector<HTMLButtonElement>(".send")!,
    cancel: root.querySelector<HTMLButtonElement>(".cancel")!,
  };
}

describe("createReportWidget", () => {
  it("hides itself from the recording", () => {
    const widget = createReportWidget({ onSubmit: () => {} })!;
    expect(widget.element.className).toContain("rr-block");
  });

  it("opens and closes the panel", () => {
    const widget = createReportWidget({ onSubmit: () => {} })!;
    const { button, panel, cancel } = parts(widget);

    expect(panel.hidden).toBe(true);
    button.click();
    expect(panel.hidden).toBe(false);
    cancel.click();
    expect(panel.hidden).toBe(true);
  });

  it("submits the trimmed comment and thanks the visitor", () => {
    const onSubmit = vi.fn();
    const widget = createReportWidget({ onSubmit })!;
    const { button, panel, textarea, send } = parts(widget);

    button.click();
    textarea.value = "  the checkout crashed  ";
    send.click();

    expect(onSubmit).toHaveBeenCalledWith("the checkout crashed");
    expect(panel.textContent).toContain("Thanks");
    expect(textarea.value).toBe("");
  });

  it("keeps working when the submit handler throws", () => {
    const widget = createReportWidget({
      onSubmit: () => {
        throw new Error("transport exploded");
      },
    })!;
    const { button, send, panel } = parts(widget);

    button.click();
    expect(() => send.click()).not.toThrow();
    expect(panel.textContent).toContain("Thanks");
  });

  it("destroy removes the element", () => {
    const widget = createReportWidget({ onSubmit: () => {} })!;
    document.body.appendChild(widget.element);
    expect(document.body.contains(widget.element)).toBe(true);
    widget.destroy();
    expect(document.body.contains(widget.element)).toBe(false);
  });
});
