import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface Lesson {
  date: string;
  project: string;
  type: "positive" | "negative";
  lesson: string;
  confidence: number;
  domain: string;
}

const LESSONS_PATH = join(homedir(), ".agents/state/lessons.jsonl");
const CONFIDENCE_THRESHOLD = 0.8;
const STALE_DAYS = 90;

function loadLessons(): Lesson[] {
  if (!existsSync(LESSONS_PATH)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);

  return readFileSync(LESSONS_PATH, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line) as Lesson)
    .filter(l => l.confidence >= CONFIDENCE_THRESHOLD)
    .filter(l => new Date(l.date) > cutoff);
}

function formatLessons(lessons: Lesson[]): string {
  if (lessons.length === 0) return "";

  const positive = lessons.filter(l => l.type === "positive");
  const negative = lessons.filter(l => l.type === "negative");

  const lines: string[] = ["## Session Memory (lessons from prior sessions)\n"];

  if (negative.length > 0) {
    lines.push("**Avoid:**");
    negative.forEach(l => lines.push(`- [${l.domain}] ${l.lesson}`));
  }
  if (positive.length > 0) {
    lines.push("\n**Repeat:**");
    positive.forEach(l => lines.push(`- [${l.domain}] ${l.lesson}`));
  }

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    const lessons = loadLessons();
    if (lessons.length === 0) return {};

    const injection = formatLessons(lessons);
    return {
      systemPrompt: event.systemPrompt + "\n\n" + injection,
    };
  });
}
