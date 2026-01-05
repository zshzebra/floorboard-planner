<script lang="ts">
    import type { CutList } from "../analysis/cutAnalyzer";

    interface Props {
        cutList: CutList | null;
        onExport?: (includePageBreakMargins: boolean) => void;
    }

    let { cutList, onExport }: Props = $props();

    let includePageBreakMargins = $state(true);

    let sortedCuts = $derived.by(() => {
        if (!cutList) return [];
        return Array.from(cutList.cuts.entries()).sort((a, b) => b[0] - a[0]);
    });

    let unusedOffcuts = $derived.by(() => {
        if (!cutList) return [];
        return cutList.offcuts.filter((o) => !o.allocated);
    });
</script>

{#if cutList}
    <div class="cut-list">
        <div class="stats">
            <div class="stat">
                <span class="label">Full Planks:</span>
                <span class="value">{cutList.fullPlanks}</span>
            </div>
            <div class="stat">
                <span class="label">Unique Cuts:</span>
                <span class="value">{cutList.uniqueCuts}</span>
            </div>
            <div class="stat">
                <span class="label">Efficiency:</span>
                <span class="value">{cutList.efficiency.toFixed(1)}%</span>
            </div>
            <div class="stat">
                <span class="label">Waste:</span>
                <span class="value">{(cutList.waste / 1000).toFixed(2)}m</span>
            </div>
        </div>

        <div class="export-group">
            <label class="checkbox-label">
                <input type="checkbox" bind:checked={includePageBreakMargins} />
                Include page break margins
            </label>
            <button class="export-btn" onclick={() => onExport?.(includePageBreakMargins)}>
                Export SVG
                <span class="shortcut">Ctrl+E</span>
            </button>
        </div>

        {#if sortedCuts.length > 0}
            <div class="cuts-section">
                <h4>Cuts Required</h4>
                <ul class="cuts-list">
                    {#each sortedCuts as [length, count]}
                        <li>
                            <span class="cut-length">{length}mm</span>
                            <span class="cut-count">x{count}</span>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        {#if unusedOffcuts.length > 0}
            <div class="offcuts-section">
                <h4>Unused Offcuts</h4>
                <ul class="offcuts-list">
                    {#each unusedOffcuts as offcut}
                        <li>{offcut.length}mm</li>
                    {/each}
                </ul>
            </div>
        {/if}
    </div>
{:else}
    <p class="placeholder">Analyzing layout...</p>
{/if}

<style>
    .cut-list {
        font-size: 13px;
    }

    .stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 16px;
    }

    .stat {
        display: flex;
        justify-content: space-between;
        padding: 6px 8px;
        background: #3a3a3a;
        border-radius: 4px;
    }

    .label {
        color: #888888;
    }

    .value {
        color: #ffffff;
        font-weight: 500;
    }

    .cuts-section,
    .offcuts-section {
        margin-top: 12px;
    }

    h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: #888888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .cuts-list,
    .offcuts-list {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .cuts-list li {
        display: flex;
        justify-content: space-between;
        padding: 4px 8px;
        background: #333333;
        border-radius: 3px;
        margin-bottom: 4px;
    }

    .cut-length {
        color: #ffffff;
    }

    .cut-count {
        color: #8b6f47;
        font-weight: 500;
    }

    .offcuts-list li {
        display: inline-block;
        padding: 3px 8px;
        background: #444444;
        border-radius: 3px;
        margin: 2px 4px 2px 0;
        color: #aaaaaa;
    }

    .placeholder {
        color: #888888;
        font-size: 14px;
        font-style: italic;
    }

    .export-group {
        margin-bottom: 16px;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #aaaaaa;
        margin-bottom: 8px;
        cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
        width: 14px;
        height: 14px;
        accent-color: #8b6f47;
        cursor: pointer;
    }

    .export-btn {
        width: 100%;
        padding: 10px 12px;
        background: #8b6f47;
        color: #ffffff;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.15s;
    }

    .export-btn:hover {
        background: #9d7f5a;
    }

    .shortcut {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 400;
    }
</style>
