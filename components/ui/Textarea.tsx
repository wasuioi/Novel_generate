"use client";
import { TextareaHTMLAttributes, forwardRef } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ className = "", ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-y ${className}`}
      {...rest}
    />
  ),
);
Textarea.displayName = "Textarea";
