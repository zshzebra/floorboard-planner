import init, { Solver } from "../solver/pkg/floorboard_solver";

let solver: Solver | null = null;
let stopRequested = false;

interface InitMessage {
  type: "init";
  config: {
    plank_full_length: number;
    plank_width: number;
    room_height: number;
    saw_kerf: number;
    min_cut_length: number;
    max_unique_cuts: number | null;
  };
  weights: {
    cutting_simplicity: number;
    waste_minimization: number;
    visual_randomness: number;
  };
  numRows: number;
}

interface GenerateMessage {
  type: "generate";
}

interface OptimizeMessage {
  type: "optimize";
  layout: { row_offsets: number[] };
  maxIterations: number;
}

interface ScoreMessage {
  type: "score";
  layout: { row_offsets: number[] };
}

interface StartSearchMessage {
  type: "startSearch";
  currentLayout: { row_offsets: number[] };
}

interface StopSearchMessage {
  type: "stopSearch";
}

type WorkerMessage =
  | InitMessage
  | GenerateMessage
  | OptimizeMessage
  | ScoreMessage
  | StartSearchMessage
  | StopSearchMessage;

interface ScoredLayout {
  layout: { row_offsets: number[] };
  total_score: number;
}

async function runSearch(currentLayout: { row_offsets: number[] }) {
  if (!solver) {
    self.postMessage({ type: "error", message: "Solver not initialized" });
    return;
  }

  try {
    stopRequested = false;
    let best: ScoredLayout = solver.score_layout(currentLayout) as ScoredLayout;
    let noImprovementCount = 0;
    let iteration = 0;
    const MAX_NO_IMPROVEMENT = 5_000_000;

    self.postMessage({
      type: "progress",
      iteration: 0,
      bestScore: best.total_score,
    });

    while (!stopRequested && noImprovementCount < MAX_NO_IMPROVEMENT) {
      const candidate = solver.generate_and_score() as ScoredLayout;
      iteration++;

      if (candidate.total_score > best.total_score) {
        best = candidate;
        noImprovementCount = 0;
        self.postMessage({
          type: "candidate",
          layout: best.layout,
          score: best.total_score,
          iteration,
        });
      } else {
        noImprovementCount++;
      }

      if (iteration % 1000 === 0) {
        self.postMessage({
          type: "progress",
          iteration,
          bestScore: best.total_score,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    self.postMessage({
      type: "searchComplete",
      layout: best.layout,
      totalIterations: iteration,
    });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  switch (type) {
    case "init": {
      const { config, weights, numRows } = e.data as InitMessage;
      await init();
      solver = new Solver(config, weights, numRows);
      self.postMessage({ type: "ready" });
      break;
    }

    case "generate": {
      if (!solver) {
        self.postMessage({ type: "error", message: "Solver not initialized" });
        return;
      }
      const random = solver.generate_random();
      self.postMessage({ type: "result", layout: random });
      break;
    }

    case "optimize": {
      if (!solver) {
        self.postMessage({ type: "error", message: "Solver not initialized" });
        return;
      }
      const { layout, maxIterations } = e.data as OptimizeMessage;
      const optimized = solver.optimize(layout, maxIterations);
      self.postMessage({ type: "result", layout: optimized });
      break;
    }

    case "score": {
      if (!solver) {
        self.postMessage({ type: "error", message: "Solver not initialized" });
        return;
      }
      const { layout } = e.data as ScoreMessage;
      const score = solver.score_layout(layout);
      self.postMessage({ type: "score", score });
      break;
    }

    case "startSearch": {
      const { currentLayout } = e.data as StartSearchMessage;
      runSearch(currentLayout);
      break;
    }

    case "stopSearch": {
      stopRequested = true;
      break;
    }
  }
};
