import init, { Solver } from "../solver/pkg/floorboard_solver";

let solver: Solver | null = null;

interface InitMessage {
  type: "init";
  config: {
    plank_full_length: number;
    plank_width: number;
    room_height: number;
    saw_kerf: number;
    min_cut_length: number;
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

type WorkerMessage = InitMessage | GenerateMessage | OptimizeMessage | ScoreMessage;

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
  }
};
