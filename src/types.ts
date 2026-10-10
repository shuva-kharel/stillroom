import type { Practice, StudyData } from "./study";
import type { Preferences } from "./preferences";
export type Mode =
  "focus" | "short" | "long" | "stopwatch" | "countdown" | "practice";
export type Theme = "midnight" | "paper" | "rain";
export interface Subject {
  id: string;
  name: string;
  color: string;
}
export interface Task {
  id: string;
  title: string;
  subjectId: string;
  estimate: number;
  done: boolean;
  completedAt?: number;
}
export interface Segment {
  start: number;
  end: number;
}
export interface Session {
  id: string;
  subjectId: string;
  subjectName: string;
  intention: string;
  mode: "focus" | "stopwatch" | "countdown" | "practice";
  duration: number;
  endedAt: number;
  completed: boolean;
  segments: Segment[];
  taskId?: string;
  practice?: Practice;
}
export interface Timer {
  id: string;
  mode: Mode;
  duration: number;
  elapsed: number;
  runningSince: number | null;
  segments: Segment[];
  subjectId: string;
  intention: string;
  cycle: number;
  countStudy: boolean;
  taskId?: string;
  practice?: Practice;
  laps: { id: string; elapsed: number; label: string }[];
}
export interface Settings {
  focus: number;
  short: number;
  long: number;
  frequency: number;
  autoStart: boolean;
  sound: boolean;
  notifications: boolean;
  alertVolume: number;
  theme: Theme;
  countdown: number;
  countStudy: boolean;
}
export interface PlanItem {
  id: string;
  title: string;
  done: boolean;
}
export interface Store {
  version: 3;
  study: StudyData;
  preferences: Preferences;
  settings: Settings;
  subjects: Subject[];
  tasks: Task[];
  notes: Record<string, string>;
  history: Session[];
  timer: Timer;
  plan: PlanItem[];
  exam: { name: string; date: string };
  notice: string;
}
