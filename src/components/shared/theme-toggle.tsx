"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  const isDark = theme === "dark";
  const isSystem = theme === "system" || !theme;

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-premium press-feedback",
          !isDark && !isSystem ? "bg-saffron text-saffron-foreground" : "text-muted-foreground",
        )}
        aria-label="Mode terang"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-premium press-feedback",
          isDark ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
        aria-label="Mode gelap"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-premium press-feedback",
          isSystem ? "bg-muted text-foreground" : "text-muted-foreground",
        )}
        aria-label="Mode sistem"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
