import init, { initThreadPool, Solver } from "../solver/pkg/floorboard_solver";
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

type CandidateCallback = (layout: Layout, score: number, iteration: number) => void;

const BATCH_SIZE = 1000;
const MAX_NO_IMPROVEMENT = 5_000_000;

class SolverStore {
  private solver: Solver | null = null;
  private stopRequested = false;

  isReady = $state(false);
  isProcessing = $state(false);
  isSearching = $state(false);
  currentScore = $state<ScoredLayout | null>(null);
  currentIteration = $state(0);
  bestScore = $state<number | null>(null);

  async init(config: ProjectConfig, numRows: number): Promise<void> {
    this.dispose();

    const roomHeight = this.getRoomHeight(config);

    await init();
    await initThreadPool(navigator.hardwareConcurrency);

    this.solver = new Solver(
      {
        plank_full_length: config.plankFullLength,
        plank_width: config.plankWidth,
        room_height: roomHeight,
        saw_kerf: config.sawKerf,
        min_cut_length: config.minCutLength,
        max_unique_cuts: config.maxUniqueCuts,
      },
      {
        cutting_simplicity: config.optimizationWeights.cuttingSimplicity / 100,
        waste_minimization: config.optimizationWeights.wasteMinimization / 100,
        visual_randomness: config.optimizationWeights.visualRandomness / 100,
      },
      numRows
    );

    this.isReady = true;
  }

  private getRoomHeight(config: ProjectConfig): number {
    if (config.roomPolygon.length < 2) return 4000;
    const ys = config.roomPolygon.map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  }

  generateRandom(): Layout {
    if (!this.solver || !this.isReady) {
      throw new Error("Solver not initialized");
    }
    return this.solver.generate_random() as Layout;
  }

  optimize(layout: Layout, maxIterations = 10000): Layout {
    if (!this.solver || !this.isReady) {
      throw new Error("Solver not initialized");
    }
    return this.solver.optimize({ row_offsets: [...layout.row_offsets] }, maxIterations) as Layout;
  }

  scoreLayout(layout: Layout): ScoredLayout {
    if (!this.solver || !this.isReady) {
      throw new Error("Solver not initialized");
    }
    const scored = this.solver.score_layout({ row_offsets: [...layout.row_offsets] }) as ScoredLayout;
    this.currentScore = scored;
    return scored;
  }

  startSearch(layout: Layout, onCandidate: CandidateCallback): void {
    if (!this.solver || !this.isReady) {
      throw new Error("Solver not initialized");
    }

    this.isSearching = true;
    this.currentIteration = 0;
    this.bestScore = null;
    this.stopRequested = false;

    let best = this.scoreLayout(layout);
    let noImprovementCount = 0;
    let iteration = 0;

    const runBatch = () => {
      if (this.stopRequested || noImprovementCount >= MAX_NO_IMPROVEMENT) {
        this.isSearching = false;
        return;
      }

      const candidate = this.solver!.generate_batch_best(BATCH_SIZE) as ScoredLayout;
      iteration += BATCH_SIZE;

      if (candidate.total_score > best.total_score) {
        best = candidate;
        noImprovementCount = 0;
        onCandidate(best.layout, best.total_score, iteration);
      } else {
        noImprovementCount += BATCH_SIZE;
      }

      this.currentIteration = iteration;
      this.bestScore = best.total_score;

      // Yield to keep UI responsive, then continue
      setTimeout(runBatch, 0);
    };

    runBatch();
  }

  stopSearch(): void {
    this.stopRequested = true;
  }

  dispose(): void {
    this.stopRequested = true;
    if (this.solver) {
      this.solver.free();
      this.solver = null;
    }
    this.isReady = false;
    this.isProcessing = false;
    this.isSearching = false;
    this.currentScore = null;
    this.currentIteration = 0;
    this.bestScore = null;
  }
}

export const solverStore = new SolverStore();
