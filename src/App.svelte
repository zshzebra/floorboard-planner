<script lang="ts">
    import { Layer, Stage, Rect } from "svelte-konva";
    import "./app.css";
    import FloorboardRow from "./lib/drawing/FloorboardRow.svelte";

    // Configuration in mm
    let roomDimensions = { width: 5000, height: 4000 };
    let boardDimensions = { width: 200, height: 1200 };
    let visualGap = 2; // mm
    let globalOffset = $state(0); // horizontal shift of entire layout

    // Load wood texture
    let woodTexture = $state<HTMLImageElement | null>(null);
    $effect(() => {
        const img = new Image();
        img.onload = () => {
            woodTexture = img;
        };
        img.src = "/wood.jpg";
    });

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

    // Canvas dimensions - will be set from container
    let canvasWidth = $state(0);
    let canvasHeight = $state(0);
    let canvasContainer: HTMLDivElement;

    // Calculate scale factor to fit everything on screen with padding
    // Account for overflowing floorboards (one board length can extend beyond room on EITHER top or bottom)
    const padding = 50; // px
    let scale = $derived.by(() => {
        const totalHeight = roomDimensions.height + boardDimensions.height * 2; // Room + possible overflow on top + possible overflow on bottom
        const scaleX = (canvasWidth - 2 * padding) / roomDimensions.width;
        const scaleY = (canvasHeight - 2 * padding) / totalHeight;
        return Math.min(scaleX, scaleY);
    });

    // Convert mm to px
    const mmToPx = (mm: number) => mm * scale;

    // Room position (centered on canvas, accounting for overflow space on both sides)
    let roomX = $derived((canvasWidth - mmToPx(roomDimensions.width)) / 2);
    // Total visual height includes room + overflow space on both sides
    // Center this total height, which automatically accounts for overflow
    let totalVisualHeight = $derived(
        mmToPx(roomDimensions.height + boardDimensions.height * 2),
    );
    let roomY = $derived(
        (canvasHeight - totalVisualHeight) / 2 + mmToPx(boardDimensions.height),
    );

    // Calculate constraints for global offset
    // The leftmost board should not go past the left edge of the room
    // The rightmost board should not go past the right edge of the room
    let minGlobalOffset = $derived(-(numRows - 1) * boardDimensions.width);
    let maxGlobalOffset = $derived(0);

    // Update canvas size from container
    function updateCanvasSize() {
        if (canvasContainer) {
            canvasWidth = canvasContainer.clientWidth;
            canvasHeight = canvasContainer.clientHeight;
        }
    }

    // Initialize canvas size and handle window resize
    $effect(() => {
        updateCanvasSize();
        window.addEventListener("resize", updateCanvasSize);
        return () => window.removeEventListener("resize", updateCanvasSize);
    });

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

    // Randomize all row offsets
    function randomizeOffsets() {
        const newOffsets: Record<number, number> = {};
        for (let i = 0; i < numRows; i++) {
            // Random offset between 0 and -boardHeight
            newOffsets[i] = -Math.random() * boardDimensions.height;
        }
        rowOffsets = newOffsets;
    }
</script>

<div class="app-container">
    <!-- Sidebar -->
    <div class="sidebar">
        <h2>Floorboard Planner</h2>

        <div class="section">
            <h3>Layout Controls</h3>
            <button class="btn-primary" onclick={randomizeOffsets}>
                Randomize Offsets
            </button>
        </div>

        <div class="section">
            <h3>Offcuts</h3>
            <p class="placeholder">Offcut list will appear here</p>
        </div>
    </div>

    <!-- Canvas -->
    <div class="canvas-container" bind:this={canvasContainer}>
        <Stage width={canvasWidth} height={canvasHeight}>
            <Layer>
                <!-- Room outline (centered, dashed) -->
                <Rect
                    x={roomX}
                    y={roomY}
                    width={mmToPx(roomDimensions.width)}
                    height={mmToPx(roomDimensions.height)}
                    stroke="#cccccc"
                    strokeWidth={2}
                    dash={[10, 5]}
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
                        {woodTexture}
                        rowOffset={rowOffsets[rowIndex] ?? 0}
                        onUpdateRowOffset={(offset) =>
                            updateRowOffset(rowIndex, offset)}
                    />
                {/each}
            </Layer>
        </Stage>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
    }

    .app-container {
        display: flex;
        width: 100vw;
        height: 100vh;
    }

    .sidebar {
        width: 300px;
        background: #2c2c2c;
        color: #ffffff;
        padding: 20px;
        overflow-y: auto;
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
    }

    .sidebar h2 {
        margin: 0 0 20px 0;
        font-size: 24px;
        color: #ffffff;
    }

    .sidebar h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #cccccc;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .section {
        margin-bottom: 30px;
    }

    .btn-primary {
        width: 100%;
        padding: 12px 20px;
        background: #8b6f47;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-primary:hover {
        background: #9d7f5a;
    }

    .btn-primary:active {
        background: #7a5f3a;
    }

    .placeholder {
        color: #888888;
        font-size: 14px;
        font-style: italic;
    }

    .canvas-container {
        flex: 1;
        position: relative;
        overflow: hidden;
    }
</style>
