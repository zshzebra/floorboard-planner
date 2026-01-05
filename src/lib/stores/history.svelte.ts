import { HistoryManager, type HistoryState } from "../history/historyManager";
import type { ProjectConfig } from "../types/project";

class HistoryStore {
  private manager = new HistoryManager();

  canUndo = $state(false);
  canRedo = $state(false);
  currentDescription = $state("");

  private updateState() {
    this.canUndo = this.manager.canUndo();
    this.canRedo = this.manager.canRedo();
    const current = this.manager.getCurrent();
    this.currentDescription = current?.description ?? "";
  }

  setProject(projectId: string) {
    this.manager.setProject(projectId);
    this.updateState();
  }

  record(description: string, rowOffsets: number[], config?: Partial<ProjectConfig>) {
    this.manager.push(description, rowOffsets, config);
    this.updateState();
  }

  undo(): HistoryState | null {
    const state = this.manager.undo();
    this.updateState();
    return state;
  }

  redo(): HistoryState | null {
    const state = this.manager.redo();
    this.updateState();
    return state;
  }

  clear() {
    this.manager.clear();
    this.updateState();
  }

  getHistory(): HistoryState[] {
    return this.manager.getHistory();
  }
}

export const historyStore = new HistoryStore();
