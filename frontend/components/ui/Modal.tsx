'use client';
import { ReactNode } from "react";
import { Button } from "./Button";

export function Modal(props: {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { title, open, onClose, children, footer } = props;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-medium">{title}</div>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}


