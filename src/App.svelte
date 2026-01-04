<script lang="ts">
    import { Layer, Stage, Rect } from "svelte-konva";
    import "./app.css";
    import FloorboardRow from "./lib/drawing/FloorboardRow.svelte";

    // Configuration in mm
    let roomDimensions = { width: 5000, height: 4000 };
    let boardDimensions = { width: 200, height: 1200 };
    let visualGap = 2; // mm
    let globalOffset = $state(0); // horizontal shift of entire layout

    // Calculate number of rows
    let numRows = $derived(
        Math.ceil(roomDimensions.width / boardDimensions.width),
    );

    // Initialize row offsets (each row can be independently offset vertically)
    let rowOffsets = $state<Record<number, number>>({});

    // Ensure all rows have an offset initialized
    $effect(() => {
        for (let i = 0; i < numRows; i++) {
            if (rowOffsets[i] === undefined) {
                rowOffsets[i] = 0;
            }
        }
    });

    // Canvas dimensions
    let canvasWidth = $state(window.innerWidth);
    let canvasHeight = $state(window.innerHeight);

    // Calculate scale factor to fit everything on screen with padding
    const padding = 50; // px
    let scale = $derived.by(() => {
        const scaleX = (canvasWidth - 2 * padding) / roomDimensions.width;
        const scaleY = (canvasHeight - 2 * padding) / roomDimensions.height;
        return Math.min(scaleX, scaleY);
    });

    // Convert mm to px
    const mmToPx = (mm: number) => mm * scale;

    // Room position (centered on canvas)
    let roomX = $derived((canvasWidth - mmToPx(roomDimensions.width)) / 2);
    let roomY = $derived((canvasHeight - mmToPx(roomDimensions.height)) / 2);

    // Calculate constraints for global offset
    // The leftmost board should not go past the left edge of the room
    // The rightmost board should not go past the right edge of the room
    let minGlobalOffset = $derived(-(numRows - 1) * boardDimensions.width);
    let maxGlobalOffset = $derived(0);

    // Handle window resize
    function handleResize() {
        canvasWidth = window.innerWidth;
        canvasHeight = window.innerHeight;
    }

    // Update row offset
    function updateRowOffset(index: number, offset: number) {
        rowOffsets = { ...rowOffsets, [index]: offset };
    }

    // Update global offset with constraints
    function updateGlobalOffset(newOffset: number) {
        globalOffset = Math.max(
            minGlobalOffset,
            Math.min(maxGlobalOffset, newOffset),
        );
    }
</script>

<svelte:window on:resize={handleResize} />

<Stage config={{ width: canvasWidth, height: canvasHeight }}>
    <Layer>
        <!-- Room outline (centered, dashed) -->
        <Rect
            config={{
                x: roomX,
                y: roomY,
                width: mmToPx(roomDimensions.width),
                height: mmToPx(roomDimensions.height),
                stroke: "#cccccc",
                strokeWidth: 2,
                dash: [10, 5],
            }}
        />

        <!-- Render each row of floorboards -->
        {#each Array(numRows) as _, rowIndex}
            <FloorboardRow
                {rowIndex}
                {roomX}
                {roomY}
                {boardDimensions}
                {roomDimensions}
                {visualGap}
                {scale}
                {globalOffset}
                rowOffset={rowOffsets[rowIndex] ?? 0}
                onUpdateRowOffset={(offset) =>
                    updateRowOffset(rowIndex, offset)}
            />
        {/each}
    </Layer>
</Stage>

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
    }
</style>
