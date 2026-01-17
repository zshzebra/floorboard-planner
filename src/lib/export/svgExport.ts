import type { CutList } from "../analysis/cutAnalyzer";

interface CutRow {
  length: number;
  count?: number;
  isPlankSeparator?: boolean;
}

export interface CutListSVGOptions {
  cutList: CutList;
  plankFullLength: number;
  woodTexture: HTMLImageElement | null;
  includePageBreakMargins: boolean;
}

function buildCutRows(cutList: CutList, plankFullLength: number): CutRow[] {
  const rows: CutRow[] = [];

  const fullPlankCount =
    cutList.fullPlanks - cutList.plankAllocations.length;
  if (fullPlankCount > 0) {
    rows.push({ length: plankFullLength, count: fullPlankCount });
  }

  for (let i = 0; i < cutList.plankAllocations.length; i++) {
    const plank = cutList.plankAllocations[i];

    if (i > 0 || fullPlankCount > 0) {
      rows.push({ length: 0, isPlankSeparator: true });
    }

    const sortedCuts = [...plank.cuts].sort((a, b) => b - a);
    for (const length of sortedCuts) {
      rows.push({ length });
    }
  }

  return rows;
}

export async function generateCutListSVG(
  options: CutListSVGOptions,
): Promise<string> {
  const { cutList, plankFullLength, woodTexture, includePageBreakMargins } =
    options;

  const PAGE_WIDTH = 297;
  const PAGE_HEIGHT = 210;
  const MARGIN = 15;
  const PAGE_GAP = 10;
  const BAR_HEIGHT = 8;
  const ROW_GAP = 4;
  const PLANK_GAP = 2;
  const COUNT_WIDTH = 15;
  const LENGTH_WIDTH = 25;
  const HEADER_HEIGHT = 50;

  const availableWidth =
    PAGE_WIDTH - MARGIN * 2 - COUNT_WIDTH - LENGTH_WIDTH - 10;
  const rowHeight = BAR_HEIGHT + ROW_GAP;

  const cutRows = buildCutRows(cutList, plankFullLength);
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
    let totalContentHeight = 0;
    for (const row of cutRows) {
      totalContentHeight += row.isPlankSeparator ? PLANK_GAP : rowHeight;
    }
    const contentHeight = HEADER_HEIGHT + totalContentHeight + MARGIN;
    const totalHeight = Math.max(PAGE_HEIGHT, contentHeight);

    let yOffset = 0;
    const rowElements = cutRows.map((row) => {
      if (row.isPlankSeparator) {
        yOffset += PLANK_GAP;
        return "";
      }

      const barWidth = row.length * scale;
      const countText = row.count && row.count > 1 ? `${row.count}x` : "";
      const barX = MARGIN + COUNT_WIDTH;
      const y = HEADER_HEIGHT + yOffset;
      yOffset += rowHeight;

      return `
      <g transform="translate(0, ${y})">
        <text x="${MARGIN + COUNT_WIDTH - 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" text-anchor="end" fill="#666">${countText}</text>
        <rect x="${barX}" y="0" width="${barWidth}" height="${BAR_HEIGHT}" fill="${woodTexture ? "url(#wood)" : "#8B6F47"}" stroke="#5a4a32" stroke-width="0.3" rx="0.5"/>
        <text x="${barX + barWidth + 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" fill="#333">${row.length}mm</text>
      </g>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${PAGE_WIDTH}mm" viewBox="0 0 ${PAGE_WIDTH} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    ${woodPatternDef}
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#fafafa"/>
  ${headerSvg}
  ${rowElements.join("")}
</svg>`;
  }

  // Paginated mode: separate A4 pages with gaps
  const contentAreaHeight = PAGE_HEIGHT - HEADER_HEIGHT - MARGIN;

  const pages: string[] = [];
  let currentPage = 0;
  let pageY = 0;
  let yOffsetInPage = 0;
  let pageElements: string[] = [];

  function flushPage(isFirstPage: boolean) {
    const header = isFirstPage
      ? headerSvg
      : `
      <text x="${MARGIN}" y="12" font-size="4" fill="#999">Cut List (continued - page ${currentPage + 1})</text>
      <line x1="${MARGIN}" y1="42" x2="${PAGE_WIDTH - MARGIN}" y2="42" stroke="#ddd" stroke-width="0.3"/>`;

    pages.push(`
    <g transform="translate(0, ${pageY})">
      <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#fafafa"/>
      ${header}
      ${pageElements.join("")}
    </g>`);
    pageElements = [];
    currentPage++;
    pageY += PAGE_HEIGHT + PAGE_GAP;
    yOffsetInPage = 0;
  }

  for (const row of cutRows) {
    const neededHeight = row.isPlankSeparator ? PLANK_GAP : rowHeight;

    if (yOffsetInPage + neededHeight > contentAreaHeight && pageElements.length > 0) {
      flushPage(currentPage === 0);
    }

    if (row.isPlankSeparator) {
      yOffsetInPage += PLANK_GAP;
      continue;
    }

    const barWidth = row.length * scale;
    const countText = row.count && row.count > 1 ? `${row.count}x` : "";
    const barX = MARGIN + COUNT_WIDTH;
    const y = HEADER_HEIGHT + yOffsetInPage;
    yOffsetInPage += rowHeight;

    pageElements.push(`
      <g transform="translate(0, ${y})">
        <text x="${MARGIN + COUNT_WIDTH - 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" text-anchor="end" fill="#666">${countText}</text>
        <rect x="${barX}" y="0" width="${barWidth}" height="${BAR_HEIGHT}" fill="${woodTexture ? "url(#wood)" : "#8B6F47"}" stroke="#5a4a32" stroke-width="0.3" rx="0.5"/>
        <text x="${barX + barWidth + 3}" y="${BAR_HEIGHT * 0.7}" font-size="3.5" fill="#333">${row.length}mm</text>
      </g>`);
  }

  if (pageElements.length > 0) {
    flushPage(currentPage === 0);
  }

  const numPages = Math.max(1, pages.length);
  const totalHeight = numPages * PAGE_HEIGHT + (numPages - 1) * PAGE_GAP;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${PAGE_WIDTH}mm" viewBox="0 0 ${PAGE_WIDTH} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
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
