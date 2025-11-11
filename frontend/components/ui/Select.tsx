'use client';
import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectComp({ className = "", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-400 ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);


