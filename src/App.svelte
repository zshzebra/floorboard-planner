<script lang="ts">
    import { Layer, Stage, Rect } from "svelte-konva";
    import { untrack } from "svelte";
    import "./app.css";
    import FloorboardRow from "./lib/drawing/FloorboardRow.svelte";
    import ProjectSettings from "./lib/components/ProjectSettings.svelte";
    import CutListPanel from "./lib/components/CutListPanel.svelte";
    import { projectStore } from "./lib/stores/project.svelte";
    import { historyStore } from "./lib/stores/history.svelte";
    import { solverStore } from "./lib/stores/solver.svelte";
    import { CutAnalyzer, type CutList } from "./lib/analysis/cutAnalyzer";

    let globalOffset = $state(0);
    let solverInitialized = $state(false);
    let solverError = $state<string | null>(null);

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
            projectStore.roomDimensions.height +
            projectStore.boardDimensions.height * 2;
        const scaleX =
            (canvasWidth - 2 * padding) / projectStore.roomDimensions.width;
        const scaleY = (canvasHeight - 2 * padding) / totalHeight;
        return Math.min(scaleX, scaleY);
    });

    const mmToPx = (mm: number) => mm * scale;

    let roomX = $derived(
        (canvasWidth - mmToPx(projectStore.roomDimensions.width)) / 2,
    );
    let totalVisualHeight = $derived(
        mmToPx(
            projectStore.roomDimensions.height +
                projectStore.boardDimensions.height * 2,
        ),
    );
    let roomY = $derived(
        (canvasHeight - totalVisualHeight) / 2 +
            mmToPx(projectStore.boardDimensions.height),
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

    function applyHistoryState(state: import("./lib/history/historyManager").HistoryState) {
        for (let i = 0; i < state.rowOffsets.length; i++) {
            projectStore.setRowOffset(i, state.rowOffsets[i]);
        }
    }

    $effect(() => {
        function handleKeydown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    const state = historyStore.undoSkip("solver");
                    if (state) applyHistoryState(state);
                } else {
                    projectStore.undo();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "y") {
                e.preventDefault();
                if (e.shiftKey) {
                    const state = historyStore.redoSkip("solver");
                    if (state) applyHistoryState(state);
                } else {
                    projectStore.redo();
                }
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

    let solverConfigKey = $derived(
        JSON.stringify({
            plankFullLength: projectStore.config.plankFullLength,
            plankWidth: projectStore.config.plankWidth,
            roomPolygon: projectStore.config.roomPolygon,
            sawKerf: projectStore.config.sawKerf,
            minCutLength: projectStore.config.minCutLength,
            maxUniqueCuts: projectStore.config.maxUniqueCuts,
            optimizationWeights: projectStore.config.optimizationWeights,
            numRows: projectStore.numRows,
        })
    );

    $effect(() => {
        const _key = solverConfigKey;

        solverError = null;
        solverInitialized = false;

        const config = untrack(() => projectStore.config);
        const numRows = untrack(() => projectStore.numRows);

        solverStore
            .init(config, numRows)
            .then(() => {
                solverInitialized = true;
            })
            .catch((err) => {
                solverError = err.message || "Failed to initialize solver";
            });

        return () => {
            solverStore.dispose();
        };
    });

    function toggleSearch() {
        if (solverStore.isSearching) {
            solverStore.stopSearch();
        } else {
            const numRows = projectStore.numRows;
            const existingOffsets = projectStore.config.rowOffsets;
            const rowOffsets: number[] = [];
            for (let i = 0; i < numRows; i++) {
                rowOffsets.push(existingOffsets[i] ?? 0);
            }

            solverStore.startSearch({ row_offsets: rowOffsets }, (layout, score, iteration) => {
                for (let i = 0; i < layout.row_offsets.length; i++) {
                    projectStore.setRowOffset(i, layout.row_offsets[i]);
                }
                historyStore.record(
                    `Solver: ${score.toFixed(3)} @ ${iteration}`,
                    layout.row_offsets,
                    undefined,
                    "solver"
                );
            });
        }
    }

    function updateWeight(
        key: keyof typeof projectStore.config.optimizationWeights,
        value: number,
    ) {
        projectStore.updateConfig(
            {
                optimizationWeights: {
                    ...projectStore.config.optimizationWeights,
                    [key]: value,
                },
            },
            false,
        );
    }
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
                    onclick={(e: MouseEvent) => {
                        if (e.shiftKey) {
                            const state = historyStore.undoSkip("solver");
                            if (state) applyHistoryState(state);
                        } else {
                            projectStore.undo();
                        }
                    }}
                    disabled={!historyStore.canUndo}
                    title="Hold Shift to skip solver steps"
                >
                    Undo
                </button>
                <button
                    class="btn-secondary"
                    onclick={(e: MouseEvent) => {
                        if (e.shiftKey) {
                            const state = historyStore.redoSkip("solver");
                            if (state) applyHistoryState(state);
                        } else {
                            projectStore.redo();
                        }
                    }}
                    disabled={!historyStore.canRedo}
                    title="Hold Shift to skip solver steps"
                >
                    Redo
                </button>
            </div>
        </div>

        <div class="section">
            <h3>Optimization</h3>

            <div class="slider-group">
                <label>
                    <span>Cutting Simplicity</span>
                    <span class="slider-value"
                        >{projectStore.config.optimizationWeights
                            .cuttingSimplicity}</span
                    >
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={projectStore.config.optimizationWeights
                        .cuttingSimplicity}
                    oninput={(e) =>
                        updateWeight(
                            "cuttingSimplicity",
                            parseInt((e.target as HTMLInputElement).value),
                        )}
                />
            </div>

            <div class="slider-group">
                <label>
                    <span>Waste Minimization</span>
                    <span class="slider-value"
                        >{projectStore.config.optimizationWeights
                            .wasteMinimization}</span
                    >
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={projectStore.config.optimizationWeights
                        .wasteMinimization}
                    oninput={(e) =>
                        updateWeight(
                            "wasteMinimization",
                            parseInt((e.target as HTMLInputElement).value),
                        )}
                />
            </div>

            <div class="slider-group">
                <label>
                    <span>Visual Randomness</span>
                    <span class="slider-value"
                        >{projectStore.config.optimizationWeights
                            .visualRandomness}</span
                    >
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={projectStore.config.optimizationWeights
                        .visualRandomness}
                    oninput={(e) =>
                        updateWeight(
                            "visualRandomness",
                            parseInt((e.target as HTMLInputElement).value),
                        )}
                />
            </div>

            <div class="slider-group">
                <label>
                    <span>Max Unique Cuts</span>
                    <span class="slider-value">
                        {projectStore.config.maxUniqueCuts === null
                            ? "Unlimited"
                            : projectStore.config.maxUniqueCuts}
                    </span>
                </label>
                <input
                    type="range"
                    min="0"
                    max={projectStore.numRows * 2}
                    value={projectStore.config.maxUniqueCuts ?? 0}
                    oninput={(e) => {
                        const val = parseInt(
                            (e.target as HTMLInputElement).value,
                        );
                        projectStore.updateConfig(
                            { maxUniqueCuts: val === 0 ? null : val },
                            false,
                        );
                    }}
                />
                <span class="slider-hint"
                    >Current: {cutList.uniqueCuts} unique cuts</span
                >
            </div>

            <button
                class="btn-optimize"
                onclick={toggleSearch}
                disabled={!solverInitialized}
            >
                {#if solverStore.isSearching}
                    Stop Search
                {:else if !solverInitialized}
                    Loading Solver...
                {:else}
                    Start Search
                {/if}
            </button>

            {#if solverStore.isSearching || solverStore.bestScore !== null}
                <div class="search-status">
                    <span>Iteration: {solverStore.currentIteration.toLocaleString()}</span>
                    {#if solverStore.bestScore !== null}
                        <span>Score: {solverStore.bestScore.toFixed(3)}</span>
                    {/if}
                </div>
            {/if}

            {#if solverError}
                <p class="solver-error">{solverError}</p>
            {/if}
        </div>

        <div class="section">
            <h3>Project Info</h3>
            <div class="info-grid">
                <span class="info-label">Plank:</span>
                <span class="info-value">
                    {projectStore.config.plankFullLength} x {projectStore.config
                        .plankWidth} mm
                </span>
                <span class="info-label">Room:</span>
                <span class="info-value">
                    {projectStore.roomDimensions.width} x {projectStore
                        .roomDimensions.height} mm
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
                        onUpdateRowOffset={(offset) =>
                            updateRowOffset(rowIndex, offset)}
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

    .slider-group {
        margin-bottom: 16px;
    }

    .slider-group label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 13px;
        color: #aaaaaa;
    }

    .slider-value {
        color: #ffffff;
        font-weight: 500;
    }

    .slider-hint {
        display: block;
        margin-top: 4px;
        font-size: 11px;
        color: #888888;
    }

    .slider-group input[type="range"] {
        width: 100%;
        height: 6px;
        background: #444444;
        border-radius: 3px;
        appearance: none;
        cursor: pointer;
    }

    .slider-group input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 16px;
        height: 16px;
        background: #8b6f47;
        border-radius: 50%;
        cursor: pointer;
    }

    .slider-group input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: #8b6f47;
        border-radius: 50%;
        cursor: pointer;
        border: none;
    }

    .btn-optimize {
        width: 100%;
        padding: 12px 20px;
        background: #3a5a8a;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-optimize:hover:not(:disabled) {
        background: #4a6a9a;
    }

    .btn-optimize:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .solver-error {
        margin: 10px 0 0 0;
        padding: 8px 12px;
        background: #3a2a2a;
        border: 1px solid #5a3a3a;
        border-radius: 4px;
        color: #ff8888;
        font-size: 13px;
    }

    .search-status {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        padding: 8px 12px;
        background: #333333;
        border-radius: 4px;
        font-size: 12px;
        color: #aaaaaa;
    }
</style>
