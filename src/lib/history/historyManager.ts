import type { ProjectConfig } from "../types/project";

export interface HistoryState {
  timestamp: number;
  description: string;
  rowOffsets: number[];
  config?: Partial<ProjectConfig>;
  category?: "manual" | "solver";
}

const HISTORY_KEY_PREFIX = "floorboard_history_";

export class HistoryManager {
  private states: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 50;
  private projectId: string = "";

  setProject(projectId: string) {
    if (this.projectId !== projectId) {
      this.projectId = projectId;
      this.load();
    }
  }

  push(description: string, rowOffsets: number[], config?: Partial<ProjectConfig>, category?: "manual" | "solver"): void {
    if (this.currentIndex < this.states.length - 1) {
      this.states = this.states.slice(0, this.currentIndex + 1);
    }

    const state: HistoryState = {
      timestamp: Date.now(),
      description,
      rowOffsets: [...rowOffsets],
      config,
      category,
    };

    this.states.push(state);

    if (this.states.length > this.maxSize) {
      this.states.shift();
    } else {
      this.currentIndex++;
    }

    this.persist();
  }

  undo(): HistoryState | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    this.persist();
    return this.states[this.currentIndex];
  }

  redo(): HistoryState | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    this.persist();
    return this.states[this.currentIndex];
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.states.length - 1;
  }

  undoSkipCategory(category: string): HistoryState | null {
    while (this.canUndo()) {
      this.currentIndex--;
      const state = this.states[this.currentIndex];
      if (state.category !== category) {
        this.persist();
        return state;
      }
    }
    this.persist();
    return this.states[this.currentIndex] ?? null;
  }

  redoSkipCategory(category: string): HistoryState | null {
    while (this.canRedo()) {
      this.currentIndex++;
      const state = this.states[this.currentIndex];
      if (state.category !== category) {
        this.persist();
        return state;
      }
    }
    this.persist();
    return this.states[this.currentIndex] ?? null;
  }

  getCurrent(): HistoryState | null {
    return this.states[this.currentIndex] ?? null;
  }

  getHistory(): HistoryState[] {
    return [...this.states];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  clear(): void {
    this.states = [];
    this.currentIndex = -1;
    if (this.projectId) {
      localStorage.removeItem(HISTORY_KEY_PREFIX + this.projectId);
    }
  }

  private persist(): void {
    if (!this.projectId) return;
    const data = JSON.stringify({
      states: this.states,
      currentIndex: this.currentIndex,
    });
    localStorage.setItem(HISTORY_KEY_PREFIX + this.projectId, data);
  }

  private load(): void {
    if (!this.projectId) {
      this.states = [];
      this.currentIndex = -1;
      return;
    }

    const data = localStorage.getItem(HISTORY_KEY_PREFIX + this.projectId);
    if (!data) {
      this.states = [];
      this.currentIndex = -1;
      return;
    }

    try {
      const parsed = JSON.parse(data);
      this.states = parsed.states ?? [];
      this.currentIndex = parsed.currentIndex ?? -1;
    } catch {
      this.states = [];
      this.currentIndex = -1;
    }
  }
}
