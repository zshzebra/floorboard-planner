import type { ProjectConfig } from "../types/project";

const PROJECTS_KEY = "floorboard_projects";
const CURRENT_KEY = "floorboard_current";

export interface ProjectMetadata {
  id: string;
  name: string;
  modified: number;
}

export class ProjectStorage {
  static listProjects(): ProjectMetadata[] {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (!data) return [];

    try {
      const projects: Record<string, ProjectConfig> = JSON.parse(data);
      return Object.values(projects)
        .map((p) => ({ id: p.id, name: p.name, modified: p.modified }))
        .sort((a, b) => b.modified - a.modified);
    } catch {
      return [];
    }
  }

  static loadProject(id: string): ProjectConfig | null {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (!data) return null;

    try {
      const projects: Record<string, ProjectConfig> = JSON.parse(data);
      return projects[id] ?? null;
    } catch {
      return null;
    }
  }

  static saveProject(config: ProjectConfig): void {
    const data = localStorage.getItem(PROJECTS_KEY);
    let projects: Record<string, ProjectConfig> = {};

    try {
      if (data) projects = JSON.parse(data);
    } catch {
      // ignore
    }

    config.modified = Date.now();
    projects[config.id] = config;
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  static deleteProject(id: string): void {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (!data) return;

    try {
      const projects: Record<string, ProjectConfig> = JSON.parse(data);
      delete projects[id];
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

      if (this.getCurrentProjectId() === id) {
        localStorage.removeItem(CURRENT_KEY);
      }
    } catch {
      // ignore
    }
  }

  static getCurrentProjectId(): string | null {
    return localStorage.getItem(CURRENT_KEY);
  }

  static setCurrentProject(id: string): void {
    localStorage.setItem(CURRENT_KEY, id);
  }

  static clearCurrentProject(): void {
    localStorage.removeItem(CURRENT_KEY);
  }
}
