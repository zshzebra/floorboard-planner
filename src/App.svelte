<script lang="ts">
    import { Layer, Stage, Rect } from "svelte-konva";
    import "./app.css";
    import FloorboardRow from "./lib/drawing/FloorboardRow.svelte";
    import ProjectSettings from "./lib/components/ProjectSettings.svelte";
    import CutListPanel from "./lib/components/CutListPanel.svelte";
    import { projectStore } from "./lib/stores/project.svelte";
    import { historyStore } from "./lib/stores/history.svelte";
    import { CutAnalyzer, type CutList } from "./lib/analysis/cutAnalyzer";

    let globalOffset = $state(0);

    let woodTexture = $state<HTMLImageElement | null>(null);
    $effect(() => {
        const img = new Image();
        img.onload = () => {
            woodTexture = img;
        };
        img.src = "/wood.png";
    });

    let canvasWidth = $state(0);
    let canvasHeight = $state(0);
    let canvasContainer: HTMLDivElement;

    const padding = 50;
    let scale = $derived.by(() => {
        const totalHeight =
            projectStore.roomDimensions.height + projectStore.boardDimensions.height * 2;
        const scaleX = (canvasWidth - 2 * padding) / projectStore.roomDimensions.width;
        const scaleY = (canvasHeight - 2 * padding) / totalHeight;
        return Math.min(scaleX, scaleY);
    });

    const mmToPx = (mm: number) => mm * scale;

    let roomX = $derived((canvasWidth - mmToPx(projectStore.roomDimensions.width)) / 2);
    let totalVisualHeight = $derived(
        mmToPx(projectStore.roomDimensions.height + projectStore.boardDimensions.height * 2),
    );
    let roomY = $derived(
        (canvasHeight - totalVisualHeight) / 2 + mmToPx(projectStore.boardDimensions.height),
    );

    let minGlobalOffset = $derived(
        -(projectStore.numRows - 1) * projectStore.boardDimensions.width,
    );
    let maxGlobalOffset = $derived(0);

    function updateCanvasSize() {
        if (canvasContainer) {
            canvasWidth = canvasContainer.clientWidth;
            canvasHeight = canvasContainer.clientHeight;
        }
    }

    $effect(() => {
        updateCanvasSize();
        window.addEventListener("resize", updateCanvasSize);
        return () => window.removeEventListener("resize", updateCanvasSize);
    });

    $effect(() => {
        function handleKeydown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                if (e.shiftKey) {
                    e.preventDefault();
                    projectStore.redo();
                } else {
                    e.preventDefault();
                    projectStore.undo();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "y") {
                e.preventDefault();
                projectStore.redo();
            }
        }
        window.addEventListener("keydown", handleKeydown);
        return () => window.removeEventListener("keydown", handleKeydown);
    });

    function updateRowOffset(index: number, offset: number) {
        projectStore.setRowOffset(index, offset);
    }

    function handleRowDragEnd(index: number) {
        projectStore.recordRowDrag(index);
    }

    function handleRandomizeOffsets() {
        projectStore.randomizeOffsets();
    }

    let cutList = $derived.by(() => {
        const analyzer = new CutAnalyzer(projectStore.config);
        return analyzer.analyze();
    });
</script>

<div class="app-container">
    <div class="sidebar">
        <h2>Floorboard Planner</h2>

        <ProjectSettings />

        <div class="section">
            <h3>Layout Controls</h3>
            <button class="btn-primary" onclick={handleRandomizeOffsets}>
                Randomize Offsets
            </button>
            <div class="undo-redo-row">
                <button
                    class="btn-secondary"
                    onclick={() => projectStore.undo()}
                    disabled={!historyStore.canUndo}
                >
                    Undo
                </button>
                <button
                    class="btn-secondary"
                    onclick={() => projectStore.redo()}
                    disabled={!historyStore.canRedo}
                >
                    Redo
                </button>
            </div>
        </div>

        <div class="section">
            <h3>Project Info</h3>
            <div class="info-grid">
                <span class="info-label">Plank:</span>
                <span class="info-value">
                    {projectStore.config.plankFullLength} x {projectStore.config.plankWidth} mm
                </span>
                <span class="info-label">Room:</span>
                <span class="info-value">
                    {projectStore.roomDimensions.width} x {projectStore.roomDimensions.height} mm
                </span>
                <span class="info-label">Rows:</span>
                <span class="info-value">{projectStore.numRows}</span>
                <span class="info-label">Saw Kerf:</span>
                <span class="info-value">{projectStore.config.sawKerf} mm</span>
            </div>
        </div>

        <div class="section">
            <h3>Cut List</h3>
            <CutListPanel {cutList} />
        </div>
    </div>

    <div class="canvas-container" bind:this={canvasContainer}>
        <Stage width={canvasWidth} height={canvasHeight}>
            <Layer>
                <Rect
                    x={roomX}
                    y={roomY}
                    width={mmToPx(projectStore.roomDimensions.width)}
                    height={mmToPx(projectStore.roomDimensions.height)}
                    stroke="#cccccc"
                    strokeWidth={2}
                    dash={[10, 5]}
                />

                {#each Array(projectStore.numRows) as _, rowIndex}
                    <FloorboardRow
                        {rowIndex}
                        {roomX}
                        {roomY}
                        boardDimensions={projectStore.boardDimensions}
                        roomDimensions={projectStore.roomDimensions}
                        visualGap={projectStore.config.visualGap}
                        {scale}
                        {globalOffset}
                        {woodTexture}
                        rowOffset={projectStore.getRowOffset(rowIndex)}
                        onUpdateRowOffset={(offset) => updateRowOffset(rowIndex, offset)}
                        onDragEnd={() => handleRowDragEnd(rowIndex)}
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

    .undo-redo-row {
        display: flex;
        gap: 8px;
        margin-top: 10px;
    }

    .btn-secondary {
        flex: 1;
        padding: 8px 12px;
        background: #444444;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #555555;
    }

    .btn-secondary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .info-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 12px;
        font-size: 13px;
    }

    .info-label {
        color: #888888;
    }

    .info-value {
        color: #ffffff;
    }

    .canvas-container {
        flex: 1;
        position: relative;
        overflow: hidden;
    }
</style>
