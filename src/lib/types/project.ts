export interface Point {
  x: number;
  y: number;
}

export interface OptimizationWeights {
  cuttingSimplicity: number;
  wasteMinimization: number;
  visualRandomness: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  created: number;
  modified: number;

  plankFullLength: number;
  plankWidth: number;
  plankThickness: number;

  visualGap: number;

  roomPolygon: Point[];

  sawKerf: number;
  minCutLength: number;

  rowOffsets: number[];

  optimizationWeights: OptimizationWeights;

  maxUniqueCuts: number | null;
}

export const DEFAULT_CONFIG: Omit<ProjectConfig, "id" | "created" | "modified"> = {
  name: "Untitled Project",
  plankFullLength: 2400,
  plankWidth: 190,
  plankThickness: 14,
  visualGap: 2,
  roomPolygon: [
    { x: 0, y: 0 },
    { x: 5000, y: 0 },
    { x: 5000, y: 4000 },
    { x: 0, y: 4000 },
  ],
  sawKerf: 3,
  minCutLength: 300,
  rowOffsets: [],
  optimizationWeights: {
    cuttingSimplicity: 50,
    wasteMinimization: 50,
    visualRandomness: 50,
  },
  maxUniqueCuts: null,
};

export function createProject(overrides?: Partial<ProjectConfig>): ProjectConfig {
  const now = Date.now();
  return {
    ...DEFAULT_CONFIG,
    id: crypto.randomUUID(),
    created: now,
    modified: now,
    ...overrides,
  };
}

export function getRoomBounds(polygon: Point[]): { width: number; height: number } {
  if (polygon.length === 0) return { width: 0, height: 0 };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
  };
}
