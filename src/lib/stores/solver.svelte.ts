import type { ProjectConfig } from "../types/project";

interface ScoredLayout {
  layout: { row_offsets: number[] };
  total_score: number;
  cutting_score: number;
  waste_score: number;
  randomness_score: number;
}

interface Layout {
  row_offsets: number[];
}

class SolverStore {
  private worker: Worker | null = null;
  private pendingResolve: ((value: unknown) => void) | null = null;

  isReady = $state(false);
  isProcessing = $state(false);
  currentScore = $state<ScoredLayout | null>(null);

  async init(config: ProjectConfig, numRows: number): Promise<void> {
    this.dispose();

    const roomHeight = this.getRoomHeight(config);

    this.worker = new Worker(
      new URL("../workers/solverWorker.ts", import.meta.url),
      { type: "module" }
    );

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker failed to create"));
        return;
      }

      this.worker.onmessage = (e) => {
        const { type } = e.data;

        if (type === "ready") {
          this.isReady = true;
          resolve();
        } else if (type === "result" || type === "score") {
          this.isProcessing = false;
          if (this.pendingResolve) {
            this.pendingResolve(e.data);
            this.pendingResolve = null;
          }
        } else if (type === "error") {
          this.isProcessing = false;
          reject(new Error(e.data.message));
        }
      };

      this.worker.onerror = (err) => {
        this.isProcessing = false;
        reject(err);
      };

      this.worker.postMessage({
        type: "init",
        config: {
          plank_full_length: config.plankFullLength,
          plank_width: config.plankWidth,
          room_height: roomHeight,
          saw_kerf: config.sawKerf,
          min_cut_length: config.minCutLength,
        },
        weights: {
          cutting_simplicity: config.optimizationWeights.cuttingSimplicity / 100,
          waste_minimization: config.optimizationWeights.wasteMinimization / 100,
          visual_randomness: config.optimizationWeights.visualRandomness / 100,
        },
        numRows,
      });
    });
  }

  private getRoomHeight(config: ProjectConfig): number {
    if (config.roomPolygon.length < 2) return 4000;
    const ys = config.roomPolygon.map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  }

  async generateRandom(): Promise<Layout> {
    if (!this.worker || !this.isReady) {
      throw new Error("Solver not initialized");
    }

    this.isProcessing = true;
    this.worker.postMessage({ type: "generate" });

    return new Promise((resolve) => {
      this.pendingResolve = (data: unknown) => {
        resolve((data as { layout: Layout }).layout);
      };
    });
  }

  async optimize(layout: Layout, maxIterations = 10000): Promise<Layout> {
    if (!this.worker || !this.isReady) {
      throw new Error("Solver not initialized");
    }

    this.isProcessing = true;
    this.worker.postMessage({
      type: "optimize",
      layout: { row_offsets: [...layout.row_offsets] },
      maxIterations,
    });

    return new Promise((resolve) => {
      this.pendingResolve = (data: unknown) => {
        resolve((data as { layout: Layout }).layout);
      };
    });
  }

  async scoreLayout(layout: Layout): Promise<ScoredLayout> {
    if (!this.worker || !this.isReady) {
      throw new Error("Solver not initialized");
    }

    this.isProcessing = true;
    this.worker.postMessage({ type: "score", layout: { row_offsets: [...layout.row_offsets] } });

    return new Promise((resolve) => {
      this.pendingResolve = (data: unknown) => {
        const scored = (data as { score: ScoredLayout }).score;
        this.currentScore = scored;
        resolve(scored);
      };
    });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.isProcessing = false;
    this.currentScore = null;
    this.pendingResolve = null;
  }
}

export const solverStore = new SolverStore();
