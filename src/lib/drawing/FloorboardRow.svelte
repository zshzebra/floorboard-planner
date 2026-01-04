<script lang="ts">
    import { Group } from "svelte-konva";
    import Floorboard from "./floorboard.svelte";

    interface Props {
        rowIndex: number;
        roomX: number;
        roomY: number;
        boardDimensions: { width: number; height: number };
        roomDimensions: { width: number; height: number };
        visualGap: number;
        scale: number;
        globalOffset: number;
        rowOffset: number;
        onUpdateRowOffset: (offset: number) => void;
    }

    let {
        rowIndex,
        roomX,
        roomY,
        boardDimensions,
        roomDimensions,
        visualGap,
        scale,
        globalOffset,
        rowOffset,
        onUpdateRowOffset,
    }: Props = $props();

    // Convert mm to px
    const mmToPx = (mm: number) => mm * scale;

    // Calculate the X position of this row (horizontal position)
    let rowX = $derived(
        roomX + mmToPx(rowIndex * boardDimensions.width + globalOffset),
    );

    // Calculate how many boards fit in this row considering the offset
    // The offset shifts boards vertically, so we need to calculate visible portions
    let boardsToRender = $derived.by(() => {
        const boards: Array<{
            y: number;
            height: number;
            isOffcut: boolean;
        }> = [];

        const boardHeight = boardDimensions.height;
        const roomHeight = roomDimensions.height;

        // Starting Y position in mm (accounting for row offset)
        let currentY = rowOffset;

        // If offset is negative, we start with an offcut at the top
        if (currentY < 0) {
            const visibleHeight = boardHeight + currentY;
            if (visibleHeight > 0) {
                boards.push({
                    y: 0,
                    height: visibleHeight,
                    isOffcut: true,
                });
            }
            currentY = currentY + boardHeight;
        }

        // Add full boards
        while (currentY + boardHeight <= roomHeight) {
            boards.push({
                y: currentY,
                height: boardHeight,
                isOffcut: false,
            });
            currentY += boardHeight;
        }

        // Add final offcut if there's remaining space
        if (currentY < roomHeight) {
            const remainingHeight = roomHeight - currentY;
            boards.push({
                y: currentY,
                height: remainingHeight,
                isOffcut: true,
            });
        }

        return boards;
    });

    // Drag handling
    let dragStartOffset = 0;

    function handleDragStart() {
        dragStartOffset = rowOffset;
    }

    function handleDragMove(e: any) {
        const group = e.target;
        const deltaY = group.y();
        const deltaMm = deltaY / scale;
        const newOffset = dragStartOffset + deltaMm;

        onUpdateRowOffset(newOffset);

        // Reset group position so it doesn't actually move
        group.y(0);
    }

    function handleDragEnd(e: any) {
        const group = e.target;
        group.y(0);
    }
</script>

<Group
    config={{
        draggable: true,
        dragBoundFunc: (pos: any) => {
            // Constrain dragging to vertical axis only
            return { x: 0, y: pos.y };
        },
        ondragstart: handleDragStart,
        ondragmove: handleDragMove,
        ondragend: handleDragEnd,
    }}
>
    {#each boardsToRender as board}
        <Floorboard
            x={rowX}
            y={roomY + mmToPx(board.y)}
            width={mmToPx(boardDimensions.width)}
            height={mmToPx(board.height)}
            strokeWidth={mmToPx(visualGap)}
            isOffcut={board.isOffcut}
        />
    {/each}
</Group>
