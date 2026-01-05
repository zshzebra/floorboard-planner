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
        woodTexture: HTMLImageElement | null;
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
        woodTexture,
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
            yStart: number;
            yEnd: number;
            insideStart: number;
            insideEnd: number;
        }> = [];

        const boardHeight = boardDimensions.height;
        const roomHeight = roomDimensions.height;

        // Starting Y position in mm (accounting for row offset)
        let currentY = rowOffset;

        // Calculate how many boards we need
        // We need exactly one more board than what fits in the room
        // This allows shifting within one board length range without gaps
        const numBoardsNeeded = Math.ceil(roomHeight / boardHeight) + 1;

        // Render all boards, they may extend outside the room
        for (let i = 0; i < numBoardsNeeded; i++) {
            const boardStart = currentY;
            const boardEnd = currentY + boardHeight;

            // Calculate the part of the board that's inside the room
            const insideStart = Math.max(0, boardStart);
            const insideEnd = Math.min(roomHeight, boardEnd);

            boards.push({
                yStart: boardStart,
                yEnd: boardEnd,
                insideStart,
                insideEnd,
            });

            currentY += boardHeight;
        }

        return boards;
    });

    // Drag handling
    let dragStartOffset = 0;

    // Constrain offset to one board length of travel
    let minOffset = $derived(-boardDimensions.height);
    let maxOffset = 0;

    function handleDragStart() {
        dragStartOffset = rowOffset;
    }

    function handleDragMove(e: any) {
        const group = e.target;
        const deltaY = group.y();
        const deltaMm = deltaY / scale;
        let newOffset = dragStartOffset + deltaMm;

        // Constrain to one board length range
        newOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

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
    draggable={true}
    dragBoundFunc={(pos) => {
        // Constrain dragging to vertical axis only
        return { x: 0, y: pos.y };
    }}
    ondragstart={handleDragStart}
    ondragmove={handleDragMove}
    ondragend={handleDragEnd}
>
    {#each boardsToRender as board, boardIndex}
        {#if board.yStart < 0}
            <!-- Board extends above room - render top offcut -->
            <Floorboard
                x={rowX}
                y={roomY + mmToPx(board.yStart)}
                width={mmToPx(boardDimensions.width)}
                height={mmToPx(board.insideStart - board.yStart)}
                strokeWidth={mmToPx(visualGap)}
                isOffcut={true}
                {woodTexture}
                {rowIndex}
                {boardIndex}
            />
        {/if}

        {#if board.insideEnd > board.insideStart}
            <!-- Part of board inside room -->
            <Floorboard
                x={rowX}
                y={roomY + mmToPx(board.insideStart)}
                width={mmToPx(boardDimensions.width)}
                height={mmToPx(board.insideEnd - board.insideStart)}
                strokeWidth={mmToPx(visualGap)}
                isOffcut={false}
                {woodTexture}
                {rowIndex}
                {boardIndex}
                textureYOffset={board.yStart < 0 ? Math.abs(board.yStart) : 0}
            />
        {/if}

        {#if board.yEnd > roomDimensions.height}
            <!-- Board extends below room - render bottom offcut -->
            <Floorboard
                x={rowX}
                y={roomY + mmToPx(board.insideEnd)}
                width={mmToPx(boardDimensions.width)}
                height={mmToPx(board.yEnd - board.insideEnd)}
                strokeWidth={mmToPx(visualGap)}
                isOffcut={true}
                {woodTexture}
                {rowIndex}
                {boardIndex}
            />
        {/if}
    {/each}
</Group>
