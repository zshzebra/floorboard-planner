import type { Point } from "../types/project";

export interface SVGImportResult {
  polygon: Point[];
  bounds: { width: number; height: number };
  originalUnit: string;
}

const UNIT_TO_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  pt: 0.352778,
  px: 0.264583, // Assumes 96 DPI
};

export class SVGRoomImporter {
  async importFromFile(file: File): Promise<SVGImportResult> {
    const text = await file.text();
    return this.parseFromString(text);
  }

  parseFromString(svgContent: string): SVGImportResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");

    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      throw new Error("Invalid SVG file");
    }

    const svgRoot = doc.querySelector("svg");
    if (!svgRoot) {
      throw new Error("No SVG element found");
    }

    const shape = this.findRoomShape(doc);
    if (!shape) {
      throw new Error("No room shape found. Add id='room' to your shape, or include a <rect> or <polygon>.");
    }

    const unit = this.detectUnit(svgRoot);
    let polygon: Point[];

    if (shape.tagName === "rect") {
      polygon = this.rectToPolygon(shape);
    } else if (shape.tagName === "polygon") {
      polygon = this.polygonToPoints(shape);
    } else if (shape.tagName === "path") {
      polygon = this.pathToPolygon(shape);
    } else {
      throw new Error(`Unsupported shape type: ${shape.tagName}`);
    }

    polygon = this.applyTransforms(shape, polygon);
    polygon = polygon.map((p) => ({
      x: this.convertToMm(p.x, unit),
      y: this.convertToMm(p.y, unit),
    }));
    polygon = this.normalizePolygon(polygon);

    if (!this.validatePolygon(polygon)) {
      throw new Error("Invalid polygon: must have at least 3 points");
    }

    const bounds = this.calculateBounds(polygon);

    return { polygon, bounds, originalUnit: unit };
  }

  private findRoomShape(doc: Document): Element | null {
    const namedIds = ["room", "floorplan", "floor", "boundary", "outline"];
    for (const id of namedIds) {
      const el = doc.getElementById(id);
      if (el && this.isSupportedShape(el)) return el;
    }

    const shapes = ["polygon", "rect", "path"];
    for (const tag of shapes) {
      const el = doc.querySelector(tag);
      if (el) return el;
    }

    return null;
  }

  private isSupportedShape(el: Element): boolean {
    return ["rect", "polygon", "path"].includes(el.tagName);
  }

  private detectUnit(svg: SVGSVGElement): string {
    const width = svg.getAttribute("width") || "";
    const match = width.match(/[\d.]+([a-z]+)/i);
    if (match && UNIT_TO_MM[match[1]]) {
      return match[1];
    }
    return "mm";
  }

  private convertToMm(value: number, unit: string): number {
    const factor = UNIT_TO_MM[unit] ?? 1;
    return value * factor;
  }

  private rectToPolygon(rect: Element): Point[] {
    const x = parseFloat(rect.getAttribute("x") || "0");
    const y = parseFloat(rect.getAttribute("y") || "0");
    const width = parseFloat(rect.getAttribute("width") || "0");
    const height = parseFloat(rect.getAttribute("height") || "0");

    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  private polygonToPoints(polygon: Element): Point[] {
    const pointsStr = polygon.getAttribute("points") || "";
    const points: Point[] = [];

    const pairs = pointsStr.trim().split(/\s+|,/);
    for (let i = 0; i < pairs.length - 1; i += 2) {
      const x = parseFloat(pairs[i]);
      const y = parseFloat(pairs[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }

    return points;
  }

  private pathToPolygon(path: Element): Point[] {
    const d = path.getAttribute("d") || "";
    const points: Point[] = [];
    let currentX = 0;
    let currentY = 0;

    const commands = d.match(/[MLHVZmlhvz][^MLHVZmlhvz]*/gi) || [];

    for (const cmd of commands) {
      const type = cmd[0];
      const args = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(parseFloat);

      switch (type) {
        case "M":
          currentX = args[0];
          currentY = args[1];
          points.push({ x: currentX, y: currentY });
          for (let i = 2; i < args.length; i += 2) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "m":
          currentX += args[0];
          currentY += args[1];
          points.push({ x: currentX, y: currentY });
          for (let i = 2; i < args.length; i += 2) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "L":
          for (let i = 0; i < args.length; i += 2) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "l":
          for (let i = 0; i < args.length; i += 2) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "H":
          for (const x of args) {
            currentX = x;
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "h":
          for (const dx of args) {
            currentX += dx;
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "V":
          for (const y of args) {
            currentY = y;
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "v":
          for (const dy of args) {
            currentY += dy;
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "Z":
        case "z":
          break;
      }
    }

    return points;
  }

  private applyTransforms(element: Element, points: Point[]): Point[] {
    const transform = element.getAttribute("transform");
    if (!transform) return points;

    let result = [...points];

    const translateMatch = transform.match(/translate\(\s*([\d.-]+)[\s,]*([\d.-]+)?\s*\)/);
    if (translateMatch) {
      const tx = parseFloat(translateMatch[1]);
      const ty = parseFloat(translateMatch[2] || "0");
      result = result.map((p) => ({ x: p.x + tx, y: p.y + ty }));
    }

    const scaleMatch = transform.match(/scale\(\s*([\d.-]+)[\s,]*([\d.-]+)?\s*\)/);
    if (scaleMatch) {
      const sx = parseFloat(scaleMatch[1]);
      const sy = parseFloat(scaleMatch[2] || scaleMatch[1]);
      result = result.map((p) => ({ x: p.x * sx, y: p.y * sy }));
    }

    return result;
  }

  private normalizePolygon(polygon: Point[]): Point[] {
    const minX = Math.min(...polygon.map((p) => p.x));
    const minY = Math.min(...polygon.map((p) => p.y));
    return polygon.map((p) => ({
      x: Math.round(p.x - minX),
      y: Math.round(p.y - minY),
    }));
  }

  private validatePolygon(points: Point[]): boolean {
    return points.length >= 3;
  }

  private calculateBounds(polygon: Point[]): { width: number; height: number } {
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    return {
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }
}
