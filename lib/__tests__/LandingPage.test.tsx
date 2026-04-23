import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingPage } from "@/components/LandingPage";

describe("LandingPage", () => {
  it("renders the site title", () => {
    render(<LandingPage onStart={() => {}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Novel_generate/ }),
    ).toBeInTheDocument();
  });

  it("renders the three content sections", () => {
    render(<LandingPage onStart={() => {}} />);
    expect(screen.getByText(/เว็บนี้ทำอะไร/)).toBeInTheDocument();
    expect(screen.getByText(/เกี่ยวกับ AI/)).toBeInTheDocument();
    expect(screen.getByText(/วิธีใช้แบบย่อ/)).toBeInTheDocument();
  });

  it("shows 'เริ่มเขียนนิยาย' CTA by default (first visit)", () => {
    render(<LandingPage onStart={() => {}} />);
    expect(
      screen.getByRole("button", { name: /เริ่มเขียนนิยาย/ }),
    ).toBeInTheDocument();
  });

  it("shows 'กลับไปเขียน' CTA when returning=true", () => {
    render(<LandingPage onStart={() => {}} returning />);
    expect(
      screen.getByRole("button", { name: /กลับไปเขียน/ }),
    ).toBeInTheDocument();
  });

  it("calls onStart when CTA is clicked", () => {
    const onStart = vi.fn();
    render(<LandingPage onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /เริ่มเขียนนิยาย/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
