<script lang="ts">
    import { Rect } from "svelte-konva";

    interface Props {
        x: number;
        y: number;
        width: number;
        height: number;
        strokeWidth: number;
        isOffcut: boolean;
        woodTexture: HTMLImageElement | null;
        rowIndex: number;
        boardIndex: number;
        textureYOffset?: number; // Offset in mm to simulate "pushing" the board
    }

    let {
        x,
        y,
        width,
        height,
        strokeWidth,
        isOffcut,
        woodTexture,
        rowIndex,
        boardIndex,
        textureYOffset = 0,
    }: Props = $props();

    // Deterministic random number generator (Mulberry32)
    function seededRandom(seed: number): () => number {
        return function () {
            let t = (seed += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Hash function to create seed from row and board indices
    function hashCoords(row: number, board: number): number {
        // Simple hash combining row and board indices
        let hash = 0;
        hash = (hash << 5) - hash + row;
        hash = hash & hash; // Convert to 32bit integer
        hash = (hash << 5) - hash + board;
        hash = hash & hash;
        return Math.abs(hash);
    }

    // Generate deterministic random offsets for this specific board
    let textureOffsetX = $derived.by(() => {
        const seed = hashCoords(rowIndex, boardIndex);
        const rng = seededRandom(seed);
        return rng();
    });

    let textureOffsetY = $derived.by(() => {
        const seed = hashCoords(rowIndex, boardIndex);
        const rng = seededRandom(seed);
        rng(); // Skip first value (used for X)
        return rng();
    });

    // Colors
    let fill = $derived(isOffcut ? "#9D7F5A" : "#8B6F47");
    let stroke = "#5C4033";

    // Calculate texture offset in pixels if texture is available and not an offcut
    let fillPatternOffsetX = $derived(
        woodTexture && !isOffcut ? woodTexture.width * textureOffsetX : 0,
    );
    let fillPatternOffsetY = $derived.by(() => {
        if (!woodTexture || isOffcut) return 0;

        // Base random offset
        let offset = woodTexture.height * textureOffsetY;

        // Add the "push" offset to simulate board continuing from above
        // textureYOffset is in mm, scale it to match the texture scale (0.4)
        if (textureYOffset !== 0) {
            // The texture is scaled by 0.4, so we need to account for that
            // Positive offset moves texture down (simulating board pushed down from above)
            offset += textureYOffset * 0.4;
        }

        return offset;
    });
</script>

{#if !isOffcut && woodTexture}
    <!-- Regular floorboard with wood texture -->
    <Rect
        {x}
        {y}
        {width}
        {height}
        fillPatternImage={woodTexture}
        fillPatternRepeat="repeat"
        fillPatternScale={{ x: 0.4, y: 0.4 }}
        {fillPatternOffsetX}
        {fillPatternOffsetY}
        {stroke}
        {strokeWidth}
    />
{:else}
    <!-- Offcut or no texture - use solid color -->
    <Rect {x} {y} {width} {height} {fill} {stroke} {strokeWidth} />
{/if}
