import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpPopover } from "@/components/ui/HelpPopover";

describe("HelpPopover", () => {
  it("renders a ? trigger button with accessible label", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    const trigger = screen.getByRole("button", { name: /help/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("?");
  });

  it("does not show content until the trigger is clicked", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("shows content when the trigger is clicked", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Some help content")).toBeInTheDocument();
  });

  it("toggles closed when the trigger is clicked a second time", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    const trigger = screen.getByRole("button", { name: /help/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <HelpPopover>Some help content</HelpPopover>
        <button>Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Some help content")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<HelpPopover>Some help content</HelpPopover>);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Some help content")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Some help content")).toBeNull();
  });

  it("uses a custom ariaLabel when provided", () => {
    render(<HelpPopover ariaLabel="More about models">Content</HelpPopover>);
    expect(
      screen.getByRole("button", { name: "More about models" }),
    ).toBeInTheDocument();
  });
});
