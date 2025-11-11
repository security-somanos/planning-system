'use client';
import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-2.5 py-1.5 text-sm",
    md: "px-3.5 py-2 text-sm",
  }[size];
  const variants = {
    primary: "bg-black text-white hover:bg-zinc-800",
    secondary: "border border-zinc-300 hover:bg-zinc-100",
    ghost: "hover:bg-zinc-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...rest} />;
}


