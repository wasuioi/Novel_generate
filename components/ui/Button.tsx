"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

const styles: Record<Variant, string> = {
  primary:   "bg-emerald-600 hover:bg-emerald-500 text-white",
  secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
  danger:    "bg-red-600 hover:bg-red-500 text-white",
  ghost:     "bg-transparent hover:bg-zinc-800 text-zinc-200",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className = "", ...rest }, ref) => (
    <button
      ref={ref}
      className={`px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
