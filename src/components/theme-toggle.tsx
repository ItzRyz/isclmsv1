"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
const LABEL: Record<(typeof ORDER)[number], string> = {
  light: "Terang",
  dark: "Gelap",
  system: "Sistem",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = (
    ORDER.includes(theme as (typeof ORDER)[number]) ? theme : "system"
  ) as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "light";

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`Tema: ${LABEL[current]}. Klik untuk ${LABEL[next]}`}
      title={`Tema: ${LABEL[current]}`}
      onClick={() => setTheme(next)}
    >
      {current === "light" ? (
        <Sun className="h-4 w-4" />
      ) : current === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </Button>
  );
}
