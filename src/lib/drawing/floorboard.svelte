<script lang="ts">
    import { Rect } from "svelte-konva";

    interface Props {
        x: number;
        y: number;
        width: number;
        height: number;
        strokeWidth: number;
        isOffcut: boolean;
    }

    let { x, y, width, height, strokeWidth, isOffcut }: Props = $props();

    // Colors - derived to react to prop changes
    const boardFill = $derived(isOffcut ? "#9D7F5A" : "#8B6F47"); // Slightly lighter for offcuts
    const boardStroke = "#5C4033";
</script>

<Rect
    config={{
        x,
        y,
        width,
        height,
        fill: boardFill,
        stroke: boardStroke,
        strokeWidth,
    }}
/>
