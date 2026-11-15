// Light and dark mode: follows the device until the viewer picks one.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const read = () => { try { return localStorage.getItem("biome-theme"); } catch { return null; } };
const prefersDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

export function useTheme() {
  const [theme, setTheme] = useState(() => read() || (prefersDark() ? "dark" : "light"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const toggle = () => setTheme((t) => {
    const n = t === "dark" ? "light" : "dark";
    try { localStorage.setItem("biome-theme", n); } catch { /* storage blocked */ }
    return n;
  });
  return [theme, toggle];
}

export function ThemeToggle({ theme, toggle, className }) {
  const dark = theme === "dark";
  return (
    <Button type="button" size="icon" variant="ghost" onClick={toggle} className={cn("size-9 rounded-full", className)}
      aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

// the Biome logo, in its light and dark versions
export function Logo({ className, dark }) {
  if (dark) return <img src="logo-on-dark.png" alt="Biome" className={className} />;
  return (
    <>
      <img src="logo.png" alt="Biome" className={cn("dark:hidden", className)} />
      <img src="logo-on-dark.png" alt="Biome" className={cn("hidden dark:block", className)} />
    </>
  );
}
