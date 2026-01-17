import type { ProjectConfig } from "../types/project";

export interface CutRequirement {
  length: number;
  rowIndex: number;
  boardIndex: number;
  position: "top" | "full" | "bottom";
}

export interface Offcut {
  length: number;
  sourceRow: number;
  sourceBoard: number;
  sourcePlank: number;
  allocated: boolean;
  allocatedTo?: { rowIndex: number; boardIndex: number };
}

export interface PlankAllocation {
  plankNumber: number;
  cuts: number[];
  offcutLength: number;
}

export interface CutList {
  fullPlanks: number;
  cuts: Map<number, number>;
  offcuts: Offcut[];
  waste: number;
  totalMaterial: number;
  efficiency: number;
  uniqueCuts: number;
  requirements: CutRequirement[];
  plankAllocations: PlankAllocation[];
}

export class CutAnalyzer {
  private config: ProjectConfig;
  private roomHeight: number;

  constructor(config: ProjectConfig) {
    this.config = config;
    this.roomHeight = this.getRoomHeight();
  }

  private getRoomHeight(): number {
    if (this.config.roomPolygon.length < 2) return 4000;
    const ys = this.config.roomPolygon.map((p) => p.y);
    return Math.max(...ys) - Math.min(...ys);
  }

  private getNumRows(): number {
    const roomWidth = this.getRoomWidth();
    return Math.ceil(roomWidth / this.config.plankWidth);
  }

  private getRoomWidth(): number {
    if (this.config.roomPolygon.length < 2) return 5000;
    const xs = this.config.roomPolygon.map((p) => p.x);
    return Math.max(...xs) - Math.min(...xs);
  }

  analyze(): CutList {
    const requirements = this.calculateRequirements();
    const { fullPlanks, cuts, offcuts, waste, totalMaterial, plankAllocations } =
      this.allocateMaterial(requirements);

    const usedMaterial = totalMaterial - waste;
    const efficiency = totalMaterial > 0 ? (usedMaterial / totalMaterial) * 100 : 0;

    return {
      fullPlanks,
      cuts,
      offcuts,
      waste,
      totalMaterial,
      efficiency,
      uniqueCuts: cuts.size,
      requirements,
      plankAllocations,
    };
  }

  private calculateRequirements(): CutRequirement[] {
    const requirements: CutRequirement[] = [];
    const numRows = this.getNumRows();
    const boardHeight = this.config.plankFullLength;

    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      const rowOffset = this.config.rowOffsets[rowIndex] ?? 0;
      let currentY = rowOffset;
      const numBoardsNeeded = Math.ceil(this.roomHeight / boardHeight) + 1;

      for (let boardIndex = 0; boardIndex < numBoardsNeeded; boardIndex++) {
        const boardStart = currentY;
        const boardEnd = currentY + boardHeight;

        const insideStart = Math.max(0, boardStart);
        const insideEnd = Math.min(this.roomHeight, boardEnd);

        if (insideEnd > insideStart) {
          const visibleLength = insideEnd - insideStart;
          let position: "top" | "full" | "bottom";

          if (boardStart < 0 && boardEnd <= this.roomHeight) {
            position = "top";
          } else if (boardStart >= 0 && boardEnd > this.roomHeight) {
            position = "bottom";
          } else if (boardStart < 0 && boardEnd > this.roomHeight) {
            position = "full";
          } else {
            position = "full";
          }

          requirements.push({
            length: Math.round(visibleLength),
            rowIndex,
            boardIndex,
            position,
          });
        }

        currentY += boardHeight;
      }
    }

    return requirements;
  }

  private allocateMaterial(requirements: CutRequirement[]): {
    fullPlanks: number;
    cuts: Map<number, number>;
    offcuts: Offcut[];
    waste: number;
    totalMaterial: number;
    plankAllocations: PlankAllocation[];
  } {
    const plankLength = this.config.plankFullLength;
    const sawKerf = this.config.sawKerf;
    const minCutLength = this.config.minCutLength;

    const sortedReqs = [...requirements].sort((a, b) => b.length - a.length);

    let fullPlanks = 0;
    const cuts = new Map<number, number>();
    const offcuts: Offcut[] = [];
    let waste = 0;
    let totalMaterial = 0;

    const availableOffcuts: Offcut[] = [];
    const plankAllocations: PlankAllocation[] = [];
    let currentPlankNumber = 0;

    for (const req of sortedReqs) {
      if (req.length === plankLength) {
        fullPlanks++;
        totalMaterial += plankLength;
        continue;
      }

      const usableOffcut = availableOffcuts.find(
        (o) => !o.allocated && o.length >= req.length + sawKerf
      );

      if (usableOffcut) {
        usableOffcut.allocated = true;
        usableOffcut.allocatedTo = {
          rowIndex: req.rowIndex,
          boardIndex: req.boardIndex,
        };

        const cutCount = cuts.get(req.length) ?? 0;
        cuts.set(req.length, cutCount + 1);

        const allocation = plankAllocations.find(
          (p) => p.plankNumber === usableOffcut.sourcePlank
        );
        if (allocation) {
          allocation.cuts.push(req.length);
        }

        const remainingLength = usableOffcut.length - req.length - sawKerf;
        if (remainingLength >= minCutLength) {
          availableOffcuts.push({
            length: remainingLength,
            sourceRow: usableOffcut.sourceRow,
            sourceBoard: usableOffcut.sourceBoard,
            sourcePlank: usableOffcut.sourcePlank,
            allocated: false,
          });
        } else if (remainingLength > 0) {
          waste += remainingLength;
        }
        waste += sawKerf;
      } else {
        currentPlankNumber++;
        fullPlanks++;
        totalMaterial += plankLength;

        const cutCount = cuts.get(req.length) ?? 0;
        cuts.set(req.length, cutCount + 1);

        const allocation: PlankAllocation = {
          plankNumber: currentPlankNumber,
          cuts: [req.length],
          offcutLength: 0,
        };
        plankAllocations.push(allocation);

        const offcutLength = plankLength - req.length - sawKerf;
        if (offcutLength >= minCutLength) {
          availableOffcuts.push({
            length: offcutLength,
            sourceRow: req.rowIndex,
            sourceBoard: req.boardIndex,
            sourcePlank: currentPlankNumber,
            allocated: false,
          });
        } else if (offcutLength > 0) {
          waste += offcutLength;
        }
        waste += sawKerf;
      }
    }

    for (const offcut of availableOffcuts) {
      if (!offcut.allocated) {
        waste += offcut.length;
        const allocation = plankAllocations.find(
          (p) => p.plankNumber === offcut.sourcePlank
        );
        if (allocation) {
          allocation.offcutLength = offcut.length;
        }
      }
      offcuts.push(offcut);
    }

    return { fullPlanks, cuts, offcuts, waste, totalMaterial, plankAllocations };
  }
}
