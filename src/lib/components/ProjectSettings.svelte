<script lang="ts">
    import { projectStore } from "../stores/project.svelte";
    import { ProjectStorage, type ProjectMetadata } from "../storage/projectStorage";

    let showModal = $state(false);
    let showProjectList = $state(false);
    let projects = $state<ProjectMetadata[]>([]);

    let name = $state("");
    let plankFullLength = $state(0);
    let plankWidth = $state(0);
    let plankThickness = $state(0);
    let visualGap = $state(0);
    let sawKerf = $state(0);
    let minCutLength = $state(0);
    let roomWidth = $state(0);
    let roomHeight = $state(0);

    function openModal() {
        const config = projectStore.config;
        name = config.name;
        plankFullLength = config.plankFullLength;
        plankWidth = config.plankWidth;
        plankThickness = config.plankThickness;
        visualGap = config.visualGap;
        sawKerf = config.sawKerf;
        minCutLength = config.minCutLength;
        const bounds = { width: 0, height: 0 };
        if (config.roomPolygon.length >= 2) {
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            for (const p of config.roomPolygon) {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            }
            bounds.width = maxX - minX;
            bounds.height = maxY - minY;
        }
        roomWidth = bounds.width;
        roomHeight = bounds.height;
        showModal = true;
    }

    function closeModal() {
        showModal = false;
    }

    function saveSettings() {
        projectStore.updateConfig({
            name,
            plankFullLength,
            plankWidth,
            plankThickness,
            visualGap,
            sawKerf,
            minCutLength,
            roomPolygon: [
                { x: 0, y: 0 },
                { x: roomWidth, y: 0 },
                { x: roomWidth, y: roomHeight },
                { x: 0, y: roomHeight },
            ],
        });
        showModal = false;
    }

    function handleNewProject() {
        projectStore.newProject();
        openModal();
    }

    function handleSaveProject() {
        projectStore.save();
    }

    function handleOpenProjects() {
        projects = ProjectStorage.listProjects();
        showProjectList = true;
    }

    function loadProject(id: string) {
        projectStore.load(id);
        showProjectList = false;
    }

    function deleteProject(id: string) {
        ProjectStorage.deleteProject(id);
        projects = ProjectStorage.listProjects();
    }
</script>

<div class="project-controls">
    <div class="project-header">
        <span class="project-name">{projectStore.config.name}</span>
        {#if projectStore.isDirty}
            <span class="unsaved">*</span>
        {/if}
    </div>
    <div class="btn-group">
        <button class="btn-small" onclick={handleNewProject}>New</button>
        <button class="btn-small" onclick={handleOpenProjects}>Open</button>
        <button class="btn-small" onclick={handleSaveProject}>Save</button>
        <button class="btn-small" onclick={openModal}>Settings</button>
    </div>
</div>

{#if showModal}
    <div class="modal-overlay" onclick={closeModal} role="presentation">
        <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1">
            <h3>Project Settings</h3>

            <div class="form-group">
                <label for="name">Project Name</label>
                <input id="name" type="text" bind:value={name} />
            </div>

            <h4>Plank Dimensions (mm)</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="plankLength">Length</label>
                    <input id="plankLength" type="number" bind:value={plankFullLength} />
                </div>
                <div class="form-group">
                    <label for="plankWidth">Width</label>
                    <input id="plankWidth" type="number" bind:value={plankWidth} />
                </div>
                <div class="form-group">
                    <label for="plankThickness">Thickness</label>
                    <input id="plankThickness" type="number" bind:value={plankThickness} />
                </div>
            </div>

            <h4>Room Dimensions (mm)</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="roomWidth">Width</label>
                    <input id="roomWidth" type="number" bind:value={roomWidth} />
                </div>
                <div class="form-group">
                    <label for="roomHeight">Height</label>
                    <input id="roomHeight" type="number" bind:value={roomHeight} />
                </div>
            </div>

            <h4>Cutting Settings (mm)</h4>
            <div class="form-row">
                <div class="form-group">
                    <label for="sawKerf">Saw Kerf</label>
                    <input id="sawKerf" type="number" step="0.1" bind:value={sawKerf} />
                </div>
                <div class="form-group">
                    <label for="minCutLength">Min Cut Length</label>
                    <input id="minCutLength" type="number" bind:value={minCutLength} />
                </div>
                <div class="form-group">
                    <label for="visualGap">Visual Gap</label>
                    <input id="visualGap" type="number" step="0.1" bind:value={visualGap} />
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn-secondary" onclick={closeModal}>Cancel</button>
                <button class="btn-primary" onclick={saveSettings}>Save</button>
            </div>
        </div>
    </div>
{/if}

{#if showProjectList}
    <div class="modal-overlay" onclick={() => (showProjectList = false)} role="presentation">
        <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (showProjectList = false)} role="dialog" tabindex="-1">
            <h3>Open Project</h3>

            {#if projects.length === 0}
                <p class="empty-message">No saved projects</p>
            {:else}
                <ul class="project-list">
                    {#each projects as project}
                        <li class="project-item">
                            <button class="project-btn" onclick={() => loadProject(project.id)}>
                                <span class="project-item-name">{project.name}</span>
                                <span class="project-item-date">
                                    {new Date(project.modified).toLocaleDateString()}
                                </span>
                            </button>
                            <button
                                class="btn-delete"
                                onclick={() => deleteProject(project.id)}
                                title="Delete"
                            >
                                &times;
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}

            <div class="modal-actions">
                <button class="btn-secondary" onclick={() => (showProjectList = false)}>
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .project-controls {
        margin-bottom: 20px;
    }

    .project-header {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 10px;
    }

    .project-name {
        font-size: 14px;
        color: #ffffff;
    }

    .unsaved {
        color: #ffaa00;
        font-size: 16px;
    }

    .btn-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .btn-small {
        padding: 6px 12px;
        background: #444444;
        color: #ffffff;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-small:hover {
        background: #555555;
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: #2c2c2c;
        padding: 24px;
        border-radius: 8px;
        min-width: 400px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
    }

    .modal h3 {
        margin: 0 0 20px 0;
        color: #ffffff;
        font-size: 18px;
    }

    .modal h4 {
        margin: 20px 0 12px 0;
        color: #cccccc;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .form-group {
        margin-bottom: 12px;
    }

    .form-group label {
        display: block;
        margin-bottom: 4px;
        color: #aaaaaa;
        font-size: 12px;
    }

    .form-group input {
        width: 100%;
        padding: 8px 10px;
        background: #1a1a1a;
        border: 1px solid #444444;
        border-radius: 4px;
        color: #ffffff;
        font-size: 14px;
        box-sizing: border-box;
    }

    .form-group input:focus {
        outline: none;
        border-color: #8b6f47;
    }

    .form-row {
        display: flex;
        gap: 12px;
    }

    .form-row .form-group {
        flex: 1;
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
    }

    .btn-primary {
        padding: 10px 20px;
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

    .btn-secondary {
        padding: 10px 20px;
        background: #444444;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-secondary:hover {
        background: #555555;
    }

    .project-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .project-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .project-btn {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #1a1a1a;
        border: 1px solid #444444;
        border-radius: 4px;
        color: #ffffff;
        cursor: pointer;
        transition: background 0.2s;
    }

    .project-btn:hover {
        background: #333333;
    }

    .project-item-name {
        font-size: 14px;
    }

    .project-item-date {
        font-size: 12px;
        color: #888888;
    }

    .btn-delete {
        padding: 8px 12px;
        background: transparent;
        border: 1px solid #444444;
        border-radius: 4px;
        color: #888888;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: all 0.2s;
    }

    .btn-delete:hover {
        background: #ff4444;
        border-color: #ff4444;
        color: #ffffff;
    }

    .empty-message {
        color: #888888;
        font-style: italic;
        text-align: center;
        padding: 20px;
    }
</style>
