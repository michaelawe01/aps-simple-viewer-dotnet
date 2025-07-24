class TimelineExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;
        this.timeline = null;
        this.tasks = [];
        this.startDate = new Date('2025-01-01');
        this.endDate = new Date('2026-12-31');
        this.currentDate = new Date('2025-01-01');
        this.timelinePanel = null;
        this.timelineButton = null;
        this.isPanelVisible = false;
        this.elementNamesCache = new Map(); // Cache for element names
    }

    initializeConstants() {
        // Task types similar to Navisworks
        this.TASK_TYPES = {
            CONSTRUCT: 'Construct',
            DEMOLISH: 'Demolish',
            TEMPORARY: 'Temporary'
        };

        // Task relationships
        this.RELATIONSHIPS = {
            FS: 'Finish-to-Start',
            SS: 'Start-to-Start',
            FF: 'Finish-to-Finish',
            SF: 'Start-to-Finish'
        };

        // Task columns configuration
        this.COLUMNS = {
            NAME: { id: 'name', title: 'TaskName', width: 200 },
            START: { id: 'startDate', title: 'Start', width: 100 },
            END: { id: 'endDate', title: 'End', width: 100 },
            DURATION: { id: 'duration', title: 'Duration', width: 80 },
            TYPE: { id: 'type', title: 'Type', width: 80 },
            TRADE: { id: 'trade', title: 'Trade', width: 100 },
            RESPONSIBLE: { id: 'responsible', title: 'Responsible', width: 120 },
            RELATIONSHIP: { id: 'relationship', title: 'Relationship', width: 100 },
            PREDECESSOR: { id: 'predecessor', title: 'Predecessor', width: 100 },
            LINKED_ELEMENTS: { id: 'linkedElements', title: 'LinkedElements', width: 120 },
            ELEMENTS_NAMES: { id: 'elementsNames', title: 'Elements_names', width: 150 },
            STATUS: { id: 'status', title: 'Status', width: 80 }
        };
        
        // Element linking modes
        this.LINKING_MODES = {
            ONE_TO_ONE: 'One element to one task',
            MANY_TO_ONE: 'Many elements to one task',
            ONE_TO_MANY: 'One element to many tasks'
        };
        
        // Global element mapping for one-to-many relationships
        this.elementTaskMapping = new Map(); // elementId -> [taskIds]
    }

    load() {
        console.log('TimelineExtension loading...');
        this.initializeConstants();
        this.createToolbarButton();
        return true;
    }

    unload() {
        // Remove timeline panel if it exists
        if (this.timelinePanel) {
            this.timelinePanel.remove();
            this.timelinePanel = null;
        }
        
        // Remove toolbar button
        if (this.timelineButton && this.viewer.toolbar) {
            const timelineGroup = this.viewer.toolbar.getControl('timelineToolbarGroup');
            if (timelineGroup) {
                this.viewer.toolbar.removeControl('timelineToolbarGroup');
            }
        }
        
        this.isPanelVisible = false;
        return true;
    }

    createToolbarButton() {
        // Wait for toolbar to be ready
        if (!this.viewer.toolbar) {
            setTimeout(() => this.createToolbarButton(), 100);
            return;
        }

        // Add custom CSS for timeline icon first
        this.addTimelineIconCSS();

        // Create timeline toolbar group
        const timelineGroup = new Autodesk.Viewing.UI.ControlGroup('timelineToolbarGroup');
        
        // Create timeline button
        this.timelineButton = new Autodesk.Viewing.UI.Button('timelineButton');
        this.timelineButton.setToolTip('Timeline');
        
        // Set the icon using the container approach
        this.timelineButton.container.classList.add('timeline-icon');
        
        // Add click handler
        this.timelineButton.onClick = () => {
            this.toggleTimelinePanel();
        };
        
        // Add button to group
        timelineGroup.addControl(this.timelineButton);
        
        // Add group to toolbar
        this.viewer.toolbar.addControl(timelineGroup);
        
        console.log('Timeline toolbar button created and added to toolbar');
    }

    addTimelineIconCSS() {
        if (document.getElementById('timeline-icon-css')) return;
        
        const style = document.createElement('style');
        style.id = 'timeline-icon-css';
        style.textContent = `
            .timeline-icon:before {
                content: "⏱";
                font-size: 18px;
                line-height: 1;
                color: #333;
            }
            
            .timeline-icon {
                background: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 40px !important;
                height: 40px !important;
                border: none !important;
                position: relative !important;
            }
            
            .timeline-icon:hover {
                background-color: #e6f3ff !important;
            }
            
            .timeline-icon.active {
                background-color: #0078d4 !important;
            }
            
            .timeline-icon.active:before {
                color: white !important;
            }
            
            /* Ensure the button container follows Autodesk styles */
            .adsk-button.timeline-icon {
                background: none !important;
                border: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    toggleTimelinePanel() {
        console.log('toggleTimelinePanel called, isPanelVisible:', this.isPanelVisible);
        if (this.isPanelVisible) {
            this.hideTimelinePanel();
        } else {
            this.showTimelinePanel();
        }
    }

    showTimelinePanel() {
        console.log('showTimelinePanel called');
        if (!this.timelinePanel) {
            console.log('Creating timeline panel...');
            this.createTimelinePanel();
        }
        
        console.log('Setting panel display to flex, panel element:', this.timelinePanel);
        this.timelinePanel.style.display = 'flex';
        this.isPanelVisible = true;
        
        // Update button state
        if (this.timelineButton) {
            this.timelineButton.addClass('active');
            this.timelineButton.setState(Autodesk.Viewing.UI.Button.State.ACTIVE);
        }
        console.log('Timeline panel should now be visible');
    }

    hideTimelinePanel() {
        console.log('hideTimelinePanel called');
        if (this.timelinePanel) {
            this.timelinePanel.style.display = 'none';
        }
        
        this.isPanelVisible = false;
        
        // Update button state
        if (this.timelineButton) {
            this.timelineButton.removeClass('active');
            this.timelineButton.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
        }
    }

    createTimelinePanel() {
        console.log('createTimelinePanel called');
        // Create timeline container
        const container = document.createElement('div');
        container.id = 'timelineContainer';
        this.timelinePanel = container;
        
        // Make panel draggable
        let isDragging = false;
        let startX;
        let startY;
        let startLeft;
        let startTop;

        const dragStart = (e) => {
            // Only start dragging from the header area or if not clicking a button
            if (!e.target.closest('button') && e.target.closest('.timeline-header')) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = container.offsetLeft;
                startTop = container.offsetTop;
            }
        };

        const dragEnd = () => {
            isDragging = false;
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                container.style.left = `${startLeft + dx}px`;
                container.style.top = `${startTop + dy}px`;
            }
        };

        document.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        // Enhanced positioning to work better with toolbar
        container.style.position = 'fixed';
        container.style.top = '100px'; // Move down to avoid header and toolbar
        container.style.left = '50%'; // Center horizontally
        container.style.transform = 'translateX(-50%)'; // Center using transform
        container.style.zIndex = '1000'; // Higher z-index for better layering
        container.style.backgroundColor = 'white';
        container.style.padding = '5px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        container.style.width = '800px';
        container.style.height = '250px';
        container.style.cursor = 'move';
        container.style.display = 'none'; // Initially hidden
        container.style.flexDirection = 'column';
        container.style.border = '1px solid #ddd';
        container.style.maxWidth = 'calc(100vw - 40px)'; // Responsive width
        container.style.maxHeight = 'calc(100vh - 150px)'; // Responsive height

        // Create timeline controls
        const controls = `
            <div class="timeline-header" style="padding: 8px; border-bottom: 1px solid #ccc; cursor: default; background: linear-gradient(to bottom, #f8f9fa, #e9ecef); border-radius: 5px 5px 0 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <span style="font-weight: bold; font-size: 13px; color: #333; margin-right: 10px;">📅 Timeline</span>
                        <button id="collapseBtn" class="timeline-btn" data-tooltip="Collapse/Expand Panel">▢</button>
                        <button id="playButton" class="timeline-btn" data-tooltip="Play Animation">▶</button>
                        <button id="pauseButton" class="timeline-btn" data-tooltip="Pause Animation">⏸</button>
                        <button id="addTaskBtn" class="timeline-btn" data-tooltip="Add New Task">+</button>
                        <button id="addSubtaskBtn" class="timeline-btn" data-tooltip="Add Subtask to Selected Task">↳</button>
                        <button id="deleteTaskBtn" class="timeline-btn" data-tooltip="Delete Selected Task">✕</button>
                        <button id="linkTasksBtn" class="timeline-btn" data-tooltip="Link Selected Tasks">⛓</button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div id="dateDisplay" style="font-family: Arial; font-size: 12px; padding: 2px 6px; background: #fff; border: 1px solid #ddd; border-radius: 3px;">2025-01-01</div>
                        <select id="simulationSpeed" class="timeline-select">
                            <option value="1000">1x</option>
                            <option value="500">2x</option>
                            <option value="250">4x</option>
                            <option value="100">8x</option>
                        </select>
                        <button id="closeTimelineBtn" class="timeline-btn" data-tooltip="Close Timeline Panel" style="background: #dc3545;">✕</button>
                    </div>
                </div>
                <div style="display: flex; gap: 5px; align-items: center; margin-top: 5px;">
                    <input type="range" id="timeSlider" min="0" max="100" value="0" style="flex-grow: 1; height: 20px;">
                    <span id="timeDisplay" style="font-size: 12px; min-width: 35px;">0%</span>
                </div>
            </div>
            <div class="timeline-content" style="display: flex; flex-direction: column; height: calc(100% - 70px); overflow: hidden;">
                <div class="timeline-scroll-wrapper" style="position: relative; flex-grow: 1; overflow: hidden;">
                    <div class="timeline-scroll-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: auto;">
                        <div class="grid-container" style="display: flex; min-width: max-content;">
                            <!-- Task Grid -->
                            <div id="taskGrid" style="width: 1200px; flex-shrink: 0;">
                                <table class="task-table" style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 140px;">TaskName</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 70px;">Start</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 70px;">End</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 56px;">Duration</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 56px;">Type</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 70px;">Trade</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 84px;">Responsible</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 70px;">Relationship</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 70px;">Predecessor</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 120px;">LinkedElements</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 150px;">Elements_names</th>
                                            <th style="position: sticky; top: 0; background: #f5f5f5; padding: 4px; text-align: left; border-bottom: 1px solid #ccc; font-size: 11px; width: 56px;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="taskTableBody"></tbody>
                                </table>
                            </div>
                            <!-- Gantt Chart -->
                            <div id="ganttChart" style="margin-left: 10px; flex-grow: 1; border-left: 1px solid #ccc;">
                                <canvas id="ganttCanvas"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .timeline-btn {
                    padding: 3px 8px;
                    background: #0066cc;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    min-width: 24px;
                    position: relative;
                }
                .timeline-btn:hover {
                    background: #0052a3;
                }
                .timeline-btn:hover::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 4px 8px;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    font-size: 11px;
                    white-space: nowrap;
                    border-radius: 3px;
                    z-index: 1000;
                }
                .timeline-select {
                    padding: 2px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    font-size: 11px;
                }
                .timeline-scroll-container::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .timeline-scroll-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                .timeline-scroll-container::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 4px;
                }
                .timeline-scroll-container::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                .task-table {
                    font-size: 11px;
                }
                .task-table td {
                    padding: 2px 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .task-table tr:hover {
                    background-color: #f0f0f0;
                }
                .task-row {
                    cursor: pointer;
                    height: 24px;
                    border-bottom: 1px solid #eee;
                }
                .task-row.selected {
                    background-color: #e3f2fd;
                }
                .task-row:not(.subtask-row) {
                    font-weight: bold;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #ddd;
                }
                .subtask-row {
                    background-color: #fff;
                    font-size: 10px;
                    color: #444;
                }
                .gantt-bar {
                    height: 16px;
                    background: #0066cc;
                    border-radius: 2px;
                    position: relative;
                    margin: 4px 0;
                }
                .gantt-bar.subtask {
                    background: #4f9de3;
                }
                .gantt-bar:hover {
                    opacity: 0.8;
                }
                .element-link-btn {
                    padding: 1px 4px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 10px;
                    margin-right: 2px;
                }
                .element-link-btn:hover {
                    background: #218838;
                }
                .elements-display {
                    max-height: 60px;
                    overflow-y: auto;
                    font-size: 9px;
                    line-height: 1.2;
                }
                .element-item {
                    display: inline-block;
                    background: #e9ecef;
                    padding: 1px 3px;
                    margin: 1px;
                    border-radius: 2px;
                    font-size: 9px;
                }
                .element-browser {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 500px;
                    height: 400px;
                    background: white;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 10000;
                    display: none;
                    flex-direction: column;
                }
            </style>
        `;
        container.innerHTML = controls;

        // Add to viewer
        this.viewer.container.appendChild(container);
        
        // Store reference for global access
        window.timelineExt = this;

        // Add event listeners
        const playButton = document.getElementById('playButton');
        const timeSlider = document.getElementById('timeSlider');
        const timeDisplay = document.getElementById('timeDisplay');
        const collapseBtn = document.getElementById('collapseBtn');
        
        // Collapse functionality
        let isCollapsed = false;
        const timelineContent = container.querySelector('.timeline-content');
        collapseBtn.onclick = () => {
            if (isCollapsed) {
                timelineContent.style.display = 'flex';
                collapseBtn.textContent = '□';
                collapseBtn.title = 'Collapse Panel';
                container.style.height = '250px';
            } else {
                timelineContent.style.display = 'none';
                collapseBtn.textContent = '⊡';
                collapseBtn.title = 'Expand Panel';
                container.style.height = 'auto';
            }
            isCollapsed = !isCollapsed;
        };

        let isPlaying = false;
        let animationInterval;

        // Play/Pause simulation
        playButton.onclick = () => {
            if (isPlaying) {
                clearInterval(animationInterval);
                playButton.textContent = 'Play';
            } else {
                const speed = parseInt(document.getElementById('simulationSpeed').value);
                animationInterval = setInterval(() => {
                    const currentValue = parseInt(timeSlider.value);
                    if (currentValue < 100) {
                        timeSlider.value = currentValue + 1;
                        timeDisplay.textContent = `${timeSlider.value}%`;
                        this.updateModel(timeSlider.value);
                    } else {
                        clearInterval(animationInterval);
                        playButton.textContent = 'Play';
                        isPlaying = false;
                    }
                }, speed);
                playButton.textContent = 'Pause';
            }
            isPlaying = !isPlaying;
        };

        // Timeline slider
        timeSlider.oninput = () => {
            timeDisplay.textContent = `${timeSlider.value}%`;
            this.updateModel(timeSlider.value);
        };

        // Add Task button
        document.getElementById('addTaskBtn').onclick = () => {
            const taskDialog = this.createTaskDialog();
            document.body.appendChild(taskDialog);
            taskDialog.showModal();
        };

        // Pause button
        document.getElementById('pauseButton').onclick = () => {
            if (isPlaying && animationInterval) {
                clearInterval(animationInterval);
                playButton.textContent = '▶';
                isPlaying = false;
            }
        };

        // Add Subtask button
        document.getElementById('addSubtaskBtn').onclick = () => {
            const selectedRow = document.querySelector('.task-row.selected');
            if (!selectedRow) {
                alert('Please select a parent task first');
                return;
            }
            const parentId = parseInt(selectedRow.dataset.taskId);
            const taskDialog = this.createTaskDialog(parentId);
            document.body.appendChild(taskDialog);
            taskDialog.showModal();
        };

        // Delete Task button
        document.getElementById('deleteTaskBtn').onclick = () => {
            const selectedRow = document.querySelector('.task-row.selected');
            if (!selectedRow) {
                alert('Please select a task to delete');
                return;
            }
            const taskId = parseInt(selectedRow.dataset.taskId);
            this.deleteTask(taskId);
        };

        // Link Tasks button
        document.getElementById('linkTasksBtn').onclick = () => {
            const selectedRows = document.querySelectorAll('.task-row.selected');
            if (selectedRows.length !== 2) {
                alert('Please select exactly two tasks to link');
                return;
            }
            const linkDialog = this.createLinkDialog(
                parseInt(selectedRows[0].dataset.taskId),
                parseInt(selectedRows[1].dataset.taskId)
            );
            document.body.appendChild(linkDialog);
            linkDialog.showModal();
        };

        // Close Timeline button
        document.getElementById('closeTimelineBtn').onclick = () => {
            this.hideTimelinePanel();
        };

                // Task selection and cell editing
        const taskTableBody = document.getElementById('taskTableBody');
        
        taskTableBody.addEventListener('click', (e) => {
            const row = e.target.closest('.task-row');
            if (!row) return;

            if (e.ctrlKey) {
                row.classList.toggle('selected');
            } else {
                document.querySelectorAll('.task-row.selected').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
            }
        });

        // Handle editable cell changes
        taskTableBody.addEventListener('change', async (e) => {
            const cell = e.target.closest('.editable-cell');
            if (!cell) return;

            const taskId = parseInt(cell.dataset.taskId);
            const field = cell.dataset.field;
            const value = cell.value;
            const task = this.findTask(taskId);

            if (task) {
                // Update task
                task[field] = value;

                // If dates changed, update duration
                if (field === 'startDate' || field === 'endDate') {
                    task.duration = this.calculateDuration(task.startDate, task.endDate);
                    this.updateTaskGrid(); // Refresh to show new duration
                }
                
                // If linking mode changed, reset element associations if needed
                if (field === 'linkedElements') {
                    if (value === this.LINKING_MODES.ONE_TO_ONE && task.elementIds.length > 1) {
                        task.elementIds = task.elementIds.slice(0, 1);
                        task.elementsNames = await this.getElementName(task.elementIds[0]);
                    } else if (value === this.LINKING_MODES.ONE_TO_MANY && task.elementIds.length > 1) {
                        task.elementIds = task.elementIds.slice(0, 1);
                        task.elementsNames = await this.getElementName(task.elementIds[0]);
                    }
                }

                // Update visuals
                this.updateTaskGrid();
                this.updateGanttChart();
            }
        });
    }

    updateModel(percentage) {
        // Calculate current date based on percentage
        const totalTime = this.endDate.getTime() - this.startDate.getTime();
        const currentTime = this.startDate.getTime() + (totalTime * (percentage / 100));
        this.currentDate = new Date(currentTime);
        
        // Update date display
        const dateDisplay = document.getElementById('dateDisplay');
        dateDisplay.textContent = this.currentDate.toISOString().split('T')[0];
        
        // Get all model fragments
        const fragList = this.viewer.model.getFragmentList();
        
        // Reset all fragments to initial state
        const fragCount = fragList.getCount();
        for (let i = 0; i < fragCount; i++) {
            this.viewer.impl.setFragmentTransparency(i, 0);
        }
        // Reset all nodes to visible
        this.viewer.showAll();
        
        // Apply task states
        this.tasks.forEach(task => {
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            
            if (this.currentDate >= taskStart && this.currentDate <= taskEnd) {
                task.dbIds.forEach(dbId => {
                    const fragIds = this.getFragIds(dbId);
                    fragIds.forEach(fragId => {
                        switch (task.type) {
                            case this.TASK_TYPES.CONSTRUCT:
                                // Show construction progress
                                const progress = (this.currentDate - taskStart) / (taskEnd - taskStart);
                                this.viewer.impl.setFragmentTransparency(fragId, 1 - progress);
                                break;
                            case this.TASK_TYPES.DEMOLISH:
                                // Show demolition progress
                                const demolishProgress = (this.currentDate - taskStart) / (taskEnd - taskStart);
                                this.viewer.impl.setFragmentTransparency(fragId, demolishProgress);
                                if (demolishProgress >= 1) {
                                    this.viewer.hide(dbId);
                                }
                                break;
                            case this.TASK_TYPES.TEMPORARY:
                                // Show temporary elements
                                this.viewer.impl.setFragmentTransparency(fragId, 0);
                                this.viewer.show(dbId);
                                break;
                        }
                    });
                });
            } else if (this.currentDate < taskStart) {
                // Hide elements not yet constructed
                task.dbIds.forEach(dbId => {
                    if (task.type === this.TASK_TYPES.CONSTRUCT) {
                        this.viewer.hide(dbId);
                    }
                });
            }
        });
        
        this.viewer.impl.invalidate(true);
    }
    
    getFragIds(dbId) {
        const instanceTree = this.viewer.model.getData().instanceTree;
        const fragIds = [];
        
        instanceTree.enumNodeFragments(dbId, (fragId) => {
            fragIds.push(fragId);
        });
        
        return fragIds;
    }
    
    async addTask(dbIds, type, startDate, endDate, name, parentId = null, trade = '', responsible = '', relationship = null, predecessor = null) {
        const task = {
            id: Date.now(),
            name: name || `Task ${this.tasks.length + 1}`,
            dbIds: dbIds,
            type: type,
            startDate: startDate,
            endDate: endDate,
            parentId: parentId,
            trade: trade,
            responsible: responsible,
            relationship: relationship,
            predecessor: predecessor,
            status: 'Not Started',
            level: parentId ? this.getTaskLevel(parentId) + 1 : 0,
            subtasks: [],
            duration: this.calculateDuration(startDate, endDate),
            linkedElements: 'One element to one task', // Default linking mode
            elementIds: [], // Array of linked element IDs
            elementsNames: '' // Display string for element names
        };
        
        if (parentId) {
            const parentTask = this.findTask(parentId);
            if (parentTask) {
                parentTask.subtasks.push(task);
            }
        } else {
            this.tasks.push(task);
        }
        
        this.updateTaskGrid();
        this.updateGanttChart();
        return task;
    }
    
    getTaskLevel(taskId) {
        const task = this.findTask(taskId);
        return task ? task.level : 0;
    }
    
    findTask(taskId) {
        const searchTasks = (tasks) => {
            for (const task of tasks) {
                if (task.id === taskId) return task;
                if (task.subtasks) {
                    const found = searchTasks(task.subtasks);
                    if (found) return found;
                }
            }
            return null;
        };
        return searchTasks(this.tasks);
    }
    
    calculateDuration(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    updateTaskGrid() {
        const tbody = document.getElementById('taskTableBody');
        tbody.innerHTML = '';
        
        const renderTask = (task, level = 0) => {
            const row = document.createElement('tr');
            row.className = `task-row ${level > 0 ? 'subtask-row' : ''}`;
            row.dataset.taskId = task.id;
            
            // Create editable cells
            const cells = [
                { value: task.name, style: `padding-left: ${level * 20}px`, field: 'name' },
                { value: task.startDate, field: 'startDate', type: 'date' },
                { value: task.endDate, field: 'endDate', type: 'date' },
                { value: task.duration, field: 'duration', readonly: true },
                { value: task.type, field: 'type', type: 'select', options: Object.values(this.TASK_TYPES) },
                { value: task.trade, field: 'trade' },
                { value: task.responsible, field: 'responsible' },
                { value: task.relationship || '', field: 'relationship', type: 'select', options: Object.values(this.RELATIONSHIPS) },
                { value: task.predecessor || '', field: 'predecessor' },
                { value: task.linkedElements || this.LINKING_MODES.ONE_TO_ONE, field: 'linkedElements', type: 'custom', customType: 'linkedElements' },
                { value: task.elementsNames || '', field: 'elementsNames', type: 'custom', customType: 'elementsNames' },
                { value: task.status, field: 'status' }
            ];
            
            row.innerHTML = cells.map(cell => {
                if (cell.readonly) {
                    return `<td style="${cell.style || ''}">${cell.value}</td>`;
                } else if (cell.type === 'select') {
                    return `<td style="${cell.style || ''}">
                        <select class="editable-cell" style="width: 100%; border: none; background: transparent; font-size: 11px;"
                            data-field="${cell.field}" data-task-id="${task.id}">
                            <option value=""></option>
                            ${cell.options ? cell.options.map(opt => 
                                `<option value="${opt}" ${cell.value === opt ? 'selected' : ''}>${opt}</option>`
                            ).join('') : ''}
                        </select>
                    </td>`;
                } else if (cell.type === 'date') {
                    return `<td style="${cell.style || ''}">
                        <input type="date" class="editable-cell" style="width: 100%; border: none; background: transparent; font-size: 11px;"
                            value="${cell.value}" data-field="${cell.field}" data-task-id="${task.id}">
                    </td>`;
                } else if (cell.type === 'custom') {
                    if (cell.customType === 'linkedElements') {
                        return `<td style="${cell.style || ''}">
                            <select class="editable-cell" style="width: 80%; border: none; background: transparent; font-size: 10px;"
                                data-field="${cell.field}" data-task-id="${task.id}">
                                ${Object.values(this.LINKING_MODES).map(mode => 
                                    `<option value="${mode}" ${cell.value === mode ? 'selected' : ''}>${mode}</option>`
                                ).join('')}
                            </select>
                            <button class="element-link-btn" onclick="window.timelineExt.openElementBrowser(${task.id})" title="Link Elements">🔗</button>
                        </td>`;
                    } else if (cell.customType === 'elementsNames') {
                        const elementsDisplay = this.renderElementsDisplay(task);
                        return `<td style="${cell.style || ''}">
                            <div class="elements-display">${elementsDisplay}</div>
                        </td>`;
                    }
                } else {
                    return `<td style="${cell.style || ''}">
                        <input type="text" class="editable-cell" style="width: 100%; border: none; background: transparent; font-size: 11px;"
                            value="${cell.value}" data-field="${cell.field}" data-task-id="${task.id}">
                    </td>`;
                }
            }).join('');
            
            tbody.appendChild(row);
            
            // Render subtasks recursively
            if (task.subtasks && task.subtasks.length > 0) {
                task.subtasks.forEach(subtask => renderTask(subtask, level + 1));
            }
        };
        
        this.tasks.forEach(task => renderTask(task));
    }
    
    updateGanttChart() {
        const canvas = document.getElementById('ganttCanvas');
        const ctx = canvas.getContext('2d');
        const ganttContainer = document.getElementById('ganttChart');
        
        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        const rowHeight = 24; // Match table row height
        const headerHeight = 30;
        
        // Double the canvas width to provide more space for timeline
        const expandedWidth = ganttContainer.clientWidth * 2;
        
        canvas.width = expandedWidth * dpr;
        canvas.height = (this.getAllTasks().length * rowHeight + headerHeight) * dpr;
        canvas.style.width = `${expandedWidth}px`;
        canvas.style.height = `${this.getAllTasks().length * rowHeight + headerHeight}px`;
        
        // Scale context for high DPI displays
        ctx.scale(dpr, dpr);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        
        // Draw timeline with expanded width
        this.drawTimeline(ctx, expandedWidth, headerHeight);
        
        // Draw tasks
        let y = headerHeight;
        this.getAllTasks().forEach(task => {
            this.drawTask(ctx, task, y);
            y += rowHeight;
        });
    }
    
    getAllTasks() {
        const allTasks = [];
        const flatten = (tasks, level = 0) => {
            tasks.forEach(task => {
                allTasks.push({...task, level});
                if (task.subtasks && task.subtasks.length > 0) {
                    flatten(task.subtasks, level + 1);
                }
            });
        };
        flatten(this.tasks);
        return allTasks;
    }
    
    drawTimeline(ctx, width, height) {
        // Calculate total months between start and end dates
        const startYear = this.startDate.getFullYear();
        const startMonth = this.startDate.getMonth();
        const endYear = this.endDate.getFullYear();
        const endMonth = this.endDate.getMonth();
        const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
        
        // Increase month width by 2x for better spacing and readability
        const monthWidth = ((width - 40) * 2) / totalMonths;
        
        // Draw timeline background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);
        
        // Draw date scales with monthly intervals
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        
        let x = 20; // Start from left margin
        let currentDate = new Date(startYear, startMonth, 1); // First day of start month
        
        // Draw monthly grid and dates
        while (currentDate <= this.endDate) {
            // Month separator line
            ctx.beginPath();
            ctx.strokeStyle = '#ddd';
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            // Show date in dd/mm format (first day of the month)
            const day = '01';
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            const formattedDate = `${day}/${month}`;
            
            ctx.fillStyle = '#666';
            ctx.fillText(formattedDate, x + 2, 15);
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
            x += monthWidth;
        }
    }
    
    drawTask(ctx, task, y) {
        const totalDays = (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
        const canvasWidth = document.getElementById('ganttChart').clientWidth;
        // Increase day width by 2x to match expanded timeline
        const dayWidth = ((canvasWidth - 40) * 2) / totalDays;
        
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        const duration = (taskEnd - taskStart) / (1000 * 60 * 60 * 24);
        
        const x = 20 + ((taskStart - this.startDate) / (1000 * 60 * 60 * 24)) * dayWidth;
        const width = duration * dayWidth;
        
        // Calculate bar position to align with table row
        const barY = y + 2;
        const barHeight = 20;
        
        // Different styles for main tasks and subtasks
        if (task.level === 0) {
            // Main task - solid bar with border
            ctx.fillStyle = '#0066cc';
            ctx.fillRect(x, barY, width, barHeight);
            ctx.strokeStyle = '#004999';
            ctx.strokeRect(x, barY, width, barHeight);
            // Add subtle gradient
            const gradient = ctx.createLinearGradient(x, barY, x, barY + barHeight);
            gradient.addColorStop(0, 'rgba(255,255,255,0.1)');
            gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, barY, width, barHeight);
        } else {
            // Subtask - lighter color without pattern
            ctx.fillStyle = '#4f9de3';
            ctx.fillRect(x, barY + 2, width, barHeight - 4); // Slightly smaller height
            ctx.strokeStyle = '#3d7ab3';
            ctx.strokeRect(x, barY + 2, width, barHeight - 4);
        }
        
        // Draw progress indicator if task is in progress
        if (this.currentDate >= taskStart && this.currentDate <= taskEnd) {
            const progress = (this.currentDate - taskStart) / (taskEnd - taskStart);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, barY, width * progress, barHeight);
        }
        
        // Draw task dependencies
        if (task.predecessor) {
            this.drawDependency(ctx, task, barY);
        }
    }
    
    drawDependency(ctx, task, taskY) {
        const predecessor = this.findTask(task.predecessor);
        if (!predecessor) return;
        
        const totalDays = (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
        const canvasWidth = document.getElementById('ganttChart').clientWidth;
        // Increase day width by 2x to match expanded timeline
        const dayWidth = ((canvasWidth - 40) * 2) / totalDays;
        
        // Calculate positions
        const startX = 20 + ((new Date(predecessor.endDate) - this.startDate) / (1000 * 60 * 60 * 24)) * dayWidth;
        const endX = 20 + ((new Date(task.startDate) - this.startDate) / (1000 * 60 * 60 * 24)) * dayWidth;
        
        // Draw arrow
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.moveTo(startX, taskY + 10);
        ctx.lineTo(endX, taskY + 10);
        ctx.stroke();
        
        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, taskY + 10);
        ctx.lineTo(endX - 5, taskY + 5);
        ctx.lineTo(endX - 5, taskY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1;
    }

    createTaskDialog(parentId = null) {
        const dialog = document.createElement('dialog');
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '5px';
        dialog.style.border = '1px solid #ccc';
        dialog.style.backgroundColor = 'white';
        dialog.style.maxWidth = '400px';
        dialog.style.width = '100%';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';

        const form = document.createElement('form');
        form.innerHTML = `
            <h3 style="font-size: 12px; margin: 0 0 10px 0;">Add New Task</h3>
            <div style="display: grid; gap: 5px; margin: 10px 0;">
                <div style="display: grid; gap: 5px;">
                    <label style="font-size: 11px;">
                        Name:
                        <input type="text" name="name" required style="width: 100%; padding: 2px; font-size: 11px;">
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                        <label style="font-size: 11px;">
                            Task Level:
                            <select name="taskLevel" required style="width: 100%; padding: 2px; font-size: 11px;" 
                                ${parentId ? 'disabled' : ''}>
                                <option value="main" ${!parentId ? 'selected' : ''}>Main Task</option>
                                <option value="sub" ${parentId ? 'selected' : ''}>Subtask</option>
                            </select>
                        </label>
                        <label style="font-size: 11px;">
                            Type:
                            <select name="type" required style="width: 100%; padding: 2px; font-size: 11px;">
                                <option value="Construct">Construct</option>
                                <option value="Demolish">Demolish</option>
                                <option value="Temporary">Temporary</option>
                            </select>
                        </label>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <label style="font-size: 11px;">
                        Start:
                        <input type="date" name="startDate" required style="width: 100%; padding: 2px; font-size: 11px;">
                    </label>
                    <label style="font-size: 11px;">
                        End:
                        <input type="date" name="endDate" required style="width: 100%; padding: 2px; font-size: 11px;">
                    </label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <label style="font-size: 11px;">
                        Trade:
                        <input type="text" name="trade" style="width: 100%; padding: 2px; font-size: 11px;">
                    </label>
                    <label style="font-size: 11px;">
                        Responsible:
                        <input type="text" name="responsible" style="width: 100%; padding: 2px; font-size: 11px;">
                    </label>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="submit">Add Task</button>
            </div>
        `;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            
            // Get selected elements from viewer
            const selection = this.viewer.getSelection();
            if (selection.length === 0) {
                alert('Please select elements in the model first');
                return;
            }

            const newTask = await this.addTask(
                selection,
                formData.get('type'),
                formData.get('startDate'),
                formData.get('endDate'),
                formData.get('name'),
                parentId,
                formData.get('trade'),
                formData.get('responsible')
            );
            
            // Initialize element linking with selected elements
            if (selection && selection.length > 0) {
                newTask.elementIds = [...selection];
                const elementNames = [];
                for (const id of selection) {
                    const name = await this.getElementName(id);
                    elementNames.push(name);
                }
                newTask.elementsNames = elementNames.join(', ');
            }

            dialog.close();
            dialog.remove();
        };

        dialog.appendChild(form);
        return dialog;
    }

    createLinkDialog(sourceId, targetId) {
        const dialog = document.createElement('dialog');
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '5px';
        dialog.style.border = '1px solid #ccc';

        const form = document.createElement('form');
        form.innerHTML = `
            <h3>Link Tasks</h3>
            <div style="display: grid; gap: 10px; margin: 20px 0;">
                <label>
                    Relationship Type:
                    <select name="relationship" required>
                        <option value="FS">Finish-to-Start (FS)</option>
                        <option value="SS">Start-to-Start (SS)</option>
                        <option value="FF">Finish-to-Finish (FF)</option>
                        <option value="SF">Start-to-Finish (SF)</option>
                    </select>
                </label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="submit">Link Tasks</button>
            </div>
        `;

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            
            const targetTask = this.findTask(targetId);
            if (targetTask) {
                targetTask.relationship = formData.get('relationship');
                targetTask.predecessor = sourceId;
                this.updateTaskGrid();
                this.updateGanttChart();
            }

            dialog.close();
            dialog.remove();
        };

        dialog.appendChild(form);
        return dialog;
    }

    deleteTask(taskId) {
        const deleteFromArray = (tasks) => {
            const index = tasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                tasks.splice(index, 1);
                return true;
            }
            for (const task of tasks) {
                if (task.subtasks && deleteFromArray(task.subtasks)) {
                    return true;
                }
            }
            return false;
        };

        if (deleteFromArray(this.tasks)) {
            this.updateTaskGrid();
            this.updateGanttChart();
        }
    }
    
    // Element linking functionality
    renderElementsDisplay(task) {
        if (!task.elementIds || task.elementIds.length === 0) {
            return '<span style="color: #999; font-style: italic;">No elements linked</span>';
        }
        
        const elementNames = task.elementIds.map(id => {
            const name = this.getElementName(id);
            return `<span class="element-item" title="ID: ${id}">${name}</span>`;
        });
        
        return elementNames.join('');
    }
    
    async getElementName(dbId) {
        if (this.elementNamesCache.has(dbId)) {
            return this.elementNamesCache.get(dbId);
        }
        
        return new Promise((resolve) => {
            this.viewer.getProperties(dbId, (props) => {
                let name = `Element ${dbId}`;
                if (props && props.properties) {
                    const nameProperty = props.properties.find(p => 
                        p.displayName === 'Name' || p.displayName === 'Element Name' || 
                        p.attributeName === 'name' || p.attributeName === 'Name'
                    );
                    if (nameProperty) {
                        name = nameProperty.displayValue || nameProperty.value || name;
                    }
                }
                this.elementNamesCache.set(dbId, name);
                resolve(name);
            }, () => {
                const name = `Element ${dbId}`;
                this.elementNamesCache.set(dbId, name);
                resolve(name);
            });
        });
    }
    
    openElementBrowser(taskId) {
        const task = this.findTask(taskId);
        if (!task) return;
        
        // Create element browser dialog
        const browser = this.createElementBrowser(task);
        document.body.appendChild(browser);
        browser.style.display = 'flex';
    }
    
    createElementBrowser(task) {
        const browser = document.createElement('div');
        browser.className = 'element-browser';
        
        browser.innerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #ccc; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; font-size: 14px;">Link Elements to Task: ${task.name}</h4>
                <button onclick="this.closest('.element-browser').remove()" style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 10px; flex-grow: 1; display: flex; flex-direction: column;">
                <div style="margin-bottom: 10px;">
                    <label style="font-size: 12px; font-weight: bold;">Linking Mode: ${task.linkedElements}</label>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button id="selectFromViewer" class="element-link-btn" style="padding: 5px 10px;">Select from Viewer</button>
                    <button id="browseModel" class="element-link-btn" style="padding: 5px 10px;">Browse Model</button>
                    <button id="clearSelection" class="element-link-btn" style="background: #dc3545; padding: 5px 10px;">Clear All</button>
                </div>
                <div style="border: 1px solid #ddd; padding: 10px; flex-grow: 1; overflow-y: auto; background: #f9f9f9;">
                    <div style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Currently Linked Elements:</div>
                    <div id="currentElements" style="max-height: 150px; overflow-y: auto;">
                        ${this.renderCurrentElements(task)}
                    </div>
                    <div style="font-size: 12px; font-weight: bold; margin: 10px 0 5px 0;">Available Elements:</div>
                    <div id="availableElements" style="max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; background: white;">
                        <div style="color: #666; font-style: italic;">Select elements from viewer or browse model</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                    <button onclick="this.closest('.element-browser').remove()" style="padding: 5px 15px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Cancel</button>
                    <button id="applyElements" style="padding: 5px 15px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Apply</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        const selectFromViewer = browser.querySelector('#selectFromViewer');
        const browseModel = browser.querySelector('#browseModel');
        const clearSelection = browser.querySelector('#clearSelection');
        const applyElements = browser.querySelector('#applyElements');
        const availableElements = browser.querySelector('#availableElements');
        
        let selectedElements = [...task.elementIds]; // Copy current elements
        
        selectFromViewer.onclick = () => {
            const selection = this.viewer.getSelection();
            if (selection.length === 0) {
                alert('Please select elements in the viewer first');
                return;
            }
            
            this.handleElementSelection(task, selection, selectedElements, availableElements);
        };
        
        browseModel.onclick = () => {
            this.openModelBrowser(task, selectedElements, availableElements);
        };
        
        clearSelection.onclick = () => {
            selectedElements.length = 0;
            availableElements.innerHTML = '<div style="color: #666; font-style: italic;">All elements cleared</div>';
        };
        
        applyElements.onclick = () => {
            this.applyElementLinking(task, selectedElements);
            browser.remove();
        };
        
        return browser;
    }
    
    renderCurrentElements(task) {
        if (!task.elementIds || task.elementIds.length === 0) {
            return '<div style="color: #666; font-style: italic;">No elements currently linked</div>';
        }
        
        return task.elementIds.map(id => {
            const name = this.elementNamesCache.get(id) || `Element ${id}`;
            return `<div style="padding: 2px 5px; margin: 2px 0; background: #e9ecef; border-radius: 3px; font-size: 11px;">
                ${name} (ID: ${id})
                <button onclick="this.remove()" style="float: right; background: #dc3545; color: white; border: none; border-radius: 2px; padding: 1px 4px; font-size: 10px; cursor: pointer;">×</button>
            </div>`;
        }).join('');
    }
    
    handleElementSelection(task, selection, selectedElements, container) {
        const linkingMode = task.linkedElements;
        
        if (linkingMode === this.LINKING_MODES.ONE_TO_ONE) {
            if (selection.length > 1) {
                alert('One-to-one mode: Please select only one element');
                return;
            }
            selectedElements.length = 0;
            selectedElements.push(...selection);
        } else if (linkingMode === this.LINKING_MODES.MANY_TO_ONE) {
            // Add to existing selection
            selection.forEach(id => {
                if (!selectedElements.includes(id)) {
                    selectedElements.push(id);
                }
            });
        } else if (linkingMode === this.LINKING_MODES.ONE_TO_MANY) {
            if (selection.length > 1) {
                alert('One-to-many mode: Please select only one element');
                return;
            }
            selectedElements.length = 0;
            selectedElements.push(...selection);
        }
        
        this.updateAvailableElementsDisplay(selectedElements, container);
    }
    
    async updateAvailableElementsDisplay(elementIds, container) {
        if (elementIds.length === 0) {
            container.innerHTML = '<div style="color: #666; font-style: italic;">No elements selected</div>';
            return;
        }
        
        const elementItems = [];
        for (const id of elementIds) {
            const name = await this.getElementName(id);
            elementItems.push(`<div style="padding: 3px 6px; margin: 2px; background: #d4eddf; border-radius: 3px; font-size: 11px; border-left: 3px solid #28a745;">
                ${name} (ID: ${id})
            </div>`);
        }
        
        container.innerHTML = elementItems.join('');
    }
    
    openModelBrowser(task, selectedElements, container) {
        // Simple model browser - gets all leaf nodes
        const instanceTree = this.viewer.model.getData().instanceTree;
        if (!instanceTree) {
            alert('Model tree not available');
            return;
        }
        
        // Reference to task for potential future use
        console.log('Opening model browser for task:', task.name);
        
        const leafNodes = [];
        instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
            if (!instanceTree.getChildCount(dbId)) {
                leafNodes.push(dbId);
            }
        }, true);
        
        // Create a simple selection dialog
        const browserDialog = document.createElement('div');
        browserDialog.style.cssText = `
            position: fixed; top: 60px; right: 20px; width: 300px; height: 400px;
            background: white; border: 1px solid #ccc; border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10001;
            display: flex; flex-direction: column;
        `;
        
        browserDialog.innerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #ccc; background: #f8f9fa;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; font-size: 12px;">Model Browser</span>
                    <button onclick="this.closest('div').remove()" style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer;">✕</button>
                </div>
                <input type="text" id="elementFilter" placeholder="Filter elements..." style="width: 100%; margin-top: 5px; padding: 3px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px;">
            </div>
            <div id="elementList" style="flex-grow: 1; overflow-y: auto; padding: 5px; font-size: 11px;"></div>
            <div style="padding: 10px; border-top: 1px solid #ccc;">
                <button id="addSelectedElements" style="width: 100%; padding: 5px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Add Selected</button>
            </div>
        `;
        
        document.body.appendChild(browserDialog);
        
        // Populate element list
        this.populateElementList(leafNodes, browserDialog.querySelector('#elementList'));
        
        // Add filter functionality
        const filterInput = browserDialog.querySelector('#elementFilter');
        filterInput.oninput = () => {
            this.filterElementList(leafNodes, browserDialog.querySelector('#elementList'), filterInput.value);
        };
        
        // Add selection functionality
        browserDialog.querySelector('#addSelectedElements').onclick = () => {
            const checkboxes = browserDialog.querySelectorAll('input[type="checkbox"]:checked');
            const newElements = Array.from(checkboxes).map(cb => parseInt(cb.value));
            
            newElements.forEach(id => {
                if (!selectedElements.includes(id)) {
                    selectedElements.push(id);
                }
            });
            
            this.updateAvailableElementsDisplay(selectedElements, container);
            browserDialog.remove();
        };
    }
    
    async populateElementList(nodeIds, container) {
        const items = [];
        const batchSize = 50;
        
        for (let i = 0; i < Math.min(nodeIds.length, 200); i += batchSize) {
            const batch = nodeIds.slice(i, i + batchSize);
            const batchItems = await Promise.all(
                batch.map(async (id) => {
                    const name = await this.getElementName(id);
                    return `<div style="display: flex; align-items: center; padding: 2px; border-bottom: 1px solid #eee;">
                        <input type="checkbox" value="${id}" style="margin-right: 5px;">
                        <span title="ID: ${id}">${name}</span>
                    </div>`;
                })
            );
            items.push(...batchItems);
        }
        
        container.innerHTML = items.join('');
        
        if (nodeIds.length > 200) {
            container.innerHTML += '<div style="padding: 10px; text-align: center; color: #666; font-style: italic;">Showing first 200 elements. Use filter to narrow down results.</div>';
        }
    }
    
    async filterElementList(nodeIds, container, filterText) {
        if (!filterText.trim()) {
            this.populateElementList(nodeIds, container);
            return;
        }
        
        const filteredIds = [];
        for (const id of nodeIds) {
            const name = await this.getElementName(id);
            if (name.toLowerCase().includes(filterText.toLowerCase()) || id.toString().includes(filterText)) {
                filteredIds.push(id);
            }
            if (filteredIds.length >= 100) break; // Limit results
        }
        
        this.populateElementList(filteredIds, container);
    }
    
    async applyElementLinking(task, selectedElements) {
        const linkingMode = task.linkedElements;
        
        // Handle one-to-many relationships
        if (linkingMode === this.LINKING_MODES.ONE_TO_MANY && selectedElements.length === 1) {
            const elementId = selectedElements[0];
            if (!this.elementTaskMapping.has(elementId)) {
                this.elementTaskMapping.set(elementId, []);
            }
            const taskList = this.elementTaskMapping.get(elementId);
            if (!taskList.includes(task.id)) {
                taskList.push(task.id);
            }
        }
        
        // Update task with selected elements
        task.elementIds = [...selectedElements];
        
        // Update elements names display
        const elementNames = [];
        for (const id of selectedElements) {
            const name = await this.getElementName(id);
            elementNames.push(name);
        }
        task.elementsNames = elementNames.join(', ');
        
        // Refresh the grid
        this.updateTaskGrid();
        this.updateGanttChart();
    }
}

// Register the extension with Autodesk Viewer
if (typeof Autodesk !== "undefined" && Autodesk.Viewing) {
    Autodesk.Viewing.theExtensionManager.registerExtension('TimelineExtension', TimelineExtension);
}
