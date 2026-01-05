import { type ProjectConfig, createProject, getRoomBounds } from "../types/project";
import { ProjectStorage } from "../storage/projectStorage";

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
        return;
      }
    }
    this.config = createProject();
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
      this.isDirty = false;
    }
  }

  newProject() {
    this.config = createProject();
    this.isDirty = true;
  }

  updateConfig(updates: Partial<ProjectConfig>) {
    this.config = { ...this.config, ...updates, modified: Date.now() };
    this.isDirty = true;
  }

  setRowOffset(index: number, offset: number) {
    const offsets = [...this.config.rowOffsets];
    while (offsets.length <= index) offsets.push(0);
    offsets[index] = offset;
    this.config = { ...this.config, rowOffsets: offsets, modified: Date.now() };
    this.isDirty = true;
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
  }
}

export const projectStore = new ProjectStore();
