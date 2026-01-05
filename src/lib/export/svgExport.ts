import type { CutList } from "../analysis/cutAnalyzer";

export interface CutListSVGOptions {
  cutList: CutList;
  plankFullLength: number;
  woodTexture: HTMLImageElement | null;
  includePageBreakMargins: boolean;
}

export async function generateCutListSVG(
  options: CutListSVGOptions,
): Promise<string> {
  const { cutList, plankFullLength, woodTexture, includePageBreakMargins } =
    options;

  // A4 landscape dimensions in mm
  const PAGE_WIDTH = 297;
  const PAGE_HEIGHT = 210;
  const MARGIN = 15;
  const PAGE_GAP = 10;
  const BAR_HEIGHT = 8;
  const ROW_GAP = 4;
  const COUNT_WIDTH = 15;
  const LENGTH_WIDTH = 25;
  const HEADER_HEIGHT = 50;

  const availableWidth =
    PAGE_WIDTH - MARGIN * 2 - COUNT_WIDTH - LENGTH_WIDTH - 10;
  const rowHeight = BAR_HEIGHT + ROW_GAP;

  const sortedCuts = Array.from(cutList.cuts.entries()).sort(
    (a, b) => b[0] - a[0],
  );
  const scale = availableWidth / plankFullLength;

  const totalCuts = Array.from(cutList.cuts.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const offcutsTotalLength = cutList.offcuts
    .filter((o) => !o.allocated)
    .reduce((sum, o) => sum + o.length, 0);

  // Wood pattern rotated 90deg
  let woodPatternDef = "";
  if (woodTexture) {
    const base64 = imageToBase64(woodTexture);
    // Create a pattern that tiles the rotated texture horizontally
    // After 90deg rotation: width becomes height, height becomes width
    const textureAspectRatio = woodTexture.height / woodTexture.width;
    const patternWidth = BAR_HEIGHT * textureAspectRatio;
    const patternHeight = BAR_HEIGHT;

    woodPatternDef = `
    <pattern id="wood" patternUnits="userSpaceOnUse" width="${patternWidth}" height="${patternHeight}">
      <image href="${base64}" x="0" y="${-patternWidth}" width="${patternHeight}" height="${patternWidth}" transform="rotate(90 0 0)" preserveAspectRatio="none"/>
    </pattern>`;
  }

  const headerSvg = `
    <text x="${MARGIN}" y="12" font-size="6" font-weight="600" fill="#222">Cut List</text>
    <text x="${MARGIN}" y="22" font-size="3" fill="#666">Total cuts: ${totalCuts + cutList.fullPlanks} (${cutList.fullPlanks} full planks)  |  Offcuts: ${Math.round(offcutsTotalLength)}mm  |  Efficiency: ${cutList.efficiency.toFixed(1)}%</text>
    <text x="${MARGIN + COUNT_WIDTH - 3}" y="38" font-size="2.5" text-anchor="end" fill="#999">QTY</text>
    <text x="${MARGIN + COUNT_WIDTH}" y="38" font-size="2.5" fill="#999">CUT</text>
    <text x="${MARGIN + COUNT_WIDTH + availableWidth + 3}" y="38" font-size="2.5" fill="#999">LENGTH</text>
    <line x1="${MARGIN}" y1="42" x2="${PAGE_WIDTH - MARGIN}" y2="42" stroke="#ddd" stroke-width="0.3"/>`;

  if (!includePageBreakMargins) {
    // Continuous mode: single flowing image, no page breaks
    const contentHeight =
      HEADER_HEIGHT + sortedCuts.length * rowHeight + MARGIN;
    const totalHeight = Math.max(PAGE_HEIGHT, contentHeight);

    const cutRows = sortedCuts.map(([length, count], i) => {
      const barWidth = length * scale;
      const countText = count > 1 ? `${count}x` : "";
      const barX = MARGIN + COUNT_WIDTH;
      const y = HEADER_HEIGHT + i * rowHeight;

      return `
      <g transform="translate(0, ${y})">
        <text x="${MARGIN + COUNT_WIDTH - 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" text-anchor="end" fill="#666">${countText}</text>
        <rect x="${barX}" y="0" width="${barWidth}" height="${BAR_HEIGHT}" fill="${woodTexture ? "url(#wood)" : "#8B6F47"}" stroke="#5a4a32" stroke-width="0.3" rx="0.5"/>
        <text x="${barX + barWidth + 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" fill="#333">${length}mm</text>
      </g>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${PAGE_WIDTH} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    ${woodPatternDef}
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#fafafa"/>
  ${headerSvg}
  ${cutRows.join("")}
</svg>`;
  }

  // Paginated mode: separate A4 pages with gaps
  const contentAreaHeight = PAGE_HEIGHT - HEADER_HEIGHT - MARGIN;
  const cutsPerPage = Math.floor(contentAreaHeight / rowHeight);
  const numPages = Math.max(1, Math.ceil(sortedCuts.length / cutsPerPage));
  const totalHeight = numPages * PAGE_HEIGHT + (numPages - 1) * PAGE_GAP;

  const pages: string[] = [];

  for (let page = 0; page < numPages; page++) {
    const pageY = page * (PAGE_HEIGHT + PAGE_GAP);
    const pageCuts = sortedCuts.slice(
      page * cutsPerPage,
      (page + 1) * cutsPerPage,
    );

    const cutRows = pageCuts.map(([length, count], i) => {
      const barWidth = length * scale;
      const countText = count > 1 ? `${count}x` : "";
      const barX = MARGIN + COUNT_WIDTH;
      const y = HEADER_HEIGHT + i * rowHeight;

      return `
      <g transform="translate(0, ${y})">
        <text x="${MARGIN + COUNT_WIDTH - 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" text-anchor="end" fill="#666">${countText}</text>
        <rect x="${barX}" y="0" width="${barWidth}" height="${BAR_HEIGHT}" fill="${woodTexture ? "url(#wood)" : "#8B6F47"}" stroke="#5a4a32" stroke-width="0.3" rx="0.5"/>
        <text x="${barX + barWidth + 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" fill="#333">${length}mm</text>
      </g>`;
    });

    const isFirstPage = page === 0;
    const header = isFirstPage
      ? headerSvg
      : `
      <text x="${MARGIN}" y="12" font-size="4" fill="#999">Cut List (continued - page ${page + 1})</text>
      <line x1="${MARGIN}" y1="42" x2="${PAGE_WIDTH - MARGIN}" y2="42" stroke="#ddd" stroke-width="0.3"/>`;

    pages.push(`
    <g transform="translate(0, ${pageY})">
      <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#fafafa"/>
      ${header}
      ${cutRows.join("")}
    </g>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${PAGE_WIDTH} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    ${woodPatternDef}
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
  </defs>
  ${pages.join("")}
</svg>`;
}

function imageToBase64(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function downloadSVG(
  svgContent: string,
  filename: string = "cut-list.svg",
): void {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
