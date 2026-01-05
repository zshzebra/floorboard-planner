import { type ProjectConfig, createProject, getRoomBounds } from "../types/project";
import { ProjectStorage } from "../storage/projectStorage";
import { historyStore } from "./history.svelte";

class ProjectStore {
  config = $state<ProjectConfig>(createProject());
  isDirty = $state(false);

  roomDimensions = $derived(getRoomBounds(this.config.roomPolygon));
  boardDimensions = $derived({
    width: this.config.plankWidth,
    height: this.config.plankFullLength,
  });
  numRows = $derived(Math.ceil(this.roomDimensions.width / this.config.plankWidth));

  constructor() {
    this.loadLastProject();
  }

  private loadLastProject() {
    const lastId = ProjectStorage.getCurrentProjectId();
    if (lastId) {
      const saved = ProjectStorage.loadProject(lastId);
      if (saved) {
        this.config = saved;
        historyStore.setProject(saved.id);
        return;
      }
    }
    this.config = createProject();
    historyStore.setProject(this.config.id);
    historyStore.record("Initial layout", this.config.rowOffsets);
  }

  save() {
    ProjectStorage.saveProject(this.config);
    ProjectStorage.setCurrentProject(this.config.id);
    this.isDirty = false;
  }

  load(id: string) {
    const project = ProjectStorage.loadProject(id);
    if (project) {
      this.config = project;
      ProjectStorage.setCurrentProject(id);
      historyStore.setProject(id);
      this.isDirty = false;
    }
  }

  newProject() {
    this.config = createProject();
    historyStore.setProject(this.config.id);
    historyStore.record("New project", this.config.rowOffsets);
    this.isDirty = true;
  }

  updateConfig(updates: Partial<ProjectConfig>, recordHistory = true) {
    this.config = { ...this.config, ...updates, modified: Date.now() };
    this.isDirty = true;
    if (recordHistory) {
      historyStore.record("Settings changed", this.config.rowOffsets, updates);
    }
  }

  setRowOffset(index: number, offset: number, recordHistory = false) {
    const offsets = [...this.config.rowOffsets];
    while (offsets.length <= index) offsets.push(0);
    offsets[index] = offset;
    this.config = { ...this.config, rowOffsets: offsets, modified: Date.now() };
    this.isDirty = true;
    if (recordHistory) {
      historyStore.record(`Adjusted row ${index + 1}`, offsets);
    }
  }

  recordRowDrag(index: number) {
    historyStore.record(`Adjusted row ${index + 1}`, this.config.rowOffsets);
  }

  getRowOffset(index: number): number {
    return this.config.rowOffsets[index] ?? 0;
  }

  randomizeOffsets() {
    const offsets: number[] = [];
    for (let i = 0; i < this.numRows; i++) {
      offsets.push(-Math.random() * this.config.plankFullLength);
    }
    this.config = { ...this.config, rowOffsets: offsets, modified: Date.now() };
    this.isDirty = true;
    historyStore.record("Randomize offsets", offsets);
  }

  applyHistoryState(state: { rowOffsets: number[]; config?: Partial<ProjectConfig> }) {
    let newConfig = { ...this.config, rowOffsets: state.rowOffsets, modified: Date.now() };
    if (state.config) {
      newConfig = { ...newConfig, ...state.config };
    }
    this.config = newConfig;
    this.isDirty = true;
  }

  undo() {
    const state = historyStore.undo();
    if (state) {
      this.applyHistoryState(state);
    }
  }

  redo() {
    const state = historyStore.redo();
    if (state) {
      this.applyHistoryState(state);
    }
  }
}

export const projectStore = new ProjectStore();
