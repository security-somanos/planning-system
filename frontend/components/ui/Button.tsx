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
    secondary: "border border-solid text-[#bba26a] hover:opacity-80",
    ghost: "hover:bg-zinc-100",
    danger: "border border-solid text-[#920712] hover:opacity-80",
  }[variant];
  
  // Get background and border colors for danger and secondary variants
  const style = variant === "danger" 
    ? { 
        backgroundColor: "rgba(146, 7, 18, 0.08)", 
        borderColor: "#920712",
        borderWidth: "1px",
        borderStyle: "solid"
      }
    : variant === "secondary"
    ? { 
        backgroundColor: "rgba(187, 162, 106, 0.08)", 
        borderColor: "#bba26a",
        borderWidth: "1px",
        borderStyle: "solid"
      }
    : {};
  return <button className={`${base} ${sizes} ${variants} ${className}`} style={style} {...rest} />;
}


