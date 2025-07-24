class TimelineExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;
        this.timeline = null;
        this.tasks = [];
        this.startDate = new Date('2025-01-01');
        this.endDate = new Date('2026-12-31');
        this.currentDate = new Date('2025-01-01');
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
            STATUS: { id: 'status', title: 'Status', width: 80 }
        };
    }

    load() {
        console.log('TimelineExtension loading...');
        this.initializeConstants();
        this.createUI();
        return true;
    }

    unload() {
        const container = document.getElementById('timelineContainer');
        if (container) {
            container.remove();
        }
        return true;
    }

    createUI() {
        // Create timeline container
        const container = document.createElement('div');
        container.id = 'timelineContainer';
        
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
        container.style.position = 'absolute';
        container.style.top = '20px';
        container.style.left = '20px';
        container.style.zIndex = '100';
        container.style.backgroundColor = 'white';
        container.style.padding = '5px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        container.style.width = '800px';
        container.style.height = '250px';
        container.style.cursor = 'move';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        // Create timeline controls
        const controls = `
            <div class="timeline-header" style="padding: 5px; border-bottom: 1px solid #ccc; cursor: default;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 5px;">
                        <button id="collapseBtn" class="timeline-btn" data-tooltip="Collapse/Expand Panel">▢</button>
                        <button id="playButton" class="timeline-btn" data-tooltip="Play Animation">▶</button>
                        <button id="pauseButton" class="timeline-btn" data-tooltip="Pause Animation">⏸</button>
                        <button id="addTaskBtn" class="timeline-btn" data-tooltip="Add New Task">+</button>
                        <button id="addSubtaskBtn" class="timeline-btn" data-tooltip="Add Subtask to Selected Task">↳</button>
                        <button id="deleteTaskBtn" class="timeline-btn" data-tooltip="Delete Selected Task">✕</button>
                        <button id="linkTasksBtn" class="timeline-btn" data-tooltip="Link Selected Tasks">⛓</button>
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <div id="dateDisplay" style="font-family: Arial; font-size: 12px;">2025-01-01</div>
                        <select id="simulationSpeed" class="timeline-select">
                            <option value="1000">1x</option>
                            <option value="500">2x</option>
                            <option value="250">4x</option>
                            <option value="100">8x</option>
                        </select>
                    </div>
                </div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <input type="range" id="timeSlider" min="0" max="100" value="0" style="flex-grow: 1; height: 20px;">
                    <span id="timeDisplay" style="font-size: 12px;">0%</span>
                </div>
            </div>
            <div class="timeline-content" style="display: flex; flex-direction: column; height: calc(100% - 70px); overflow: hidden;">
                <div class="timeline-scroll-wrapper" style="position: relative; flex-grow: 1; overflow: hidden;">
                    <div class="timeline-scroll-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: auto;">
                        <div class="grid-container" style="display: flex; min-width: max-content;">
                            <!-- Task Grid -->
                            <div id="taskGrid" style="width: 900px; flex-shrink: 0;">
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
            </style>
        `;
        container.innerHTML = controls;

        // Add to viewer
        this.viewer.container.appendChild(container);

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
            duration: this.calculateDuration(startDate, endDate)
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
        
        canvas.width = ganttContainer.clientWidth * dpr;
        canvas.height = (this.getAllTasks().length * rowHeight + headerHeight) * dpr;
        canvas.style.width = `${ganttContainer.clientWidth}px`;
        canvas.style.height = `${this.getAllTasks().length * rowHeight + headerHeight}px`;
        
        // Scale context for high DPI displays
        ctx.scale(dpr, dpr);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        
        // Draw timeline
        this.drawTimeline(ctx, ganttContainer.clientWidth, headerHeight);
        
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
        const totalDays = (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
        const dayWidth = (width - 40) / (totalDays * 0.7); // Increased day width by reducing the divisor
        
        // Draw timeline background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);
        
        // Draw date scales
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        let currentDate = new Date(this.startDate);
        let x = 20; // Start from left margin
        
        // Draw timeline grid and dates
        while (currentDate <= this.endDate) {
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            const daysThisMonth = lastDay.getDate();
            
            // Month separator line
            ctx.beginPath();
            ctx.strokeStyle = '#ddd';
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            // Draw days
            for (let day = 1; day <= daysThisMonth; day++) {
                const dayX = x + (day - 1) * dayWidth;
                
                // Day separator (lighter)
                ctx.beginPath();
                ctx.strokeStyle = '#eee';
                ctx.moveTo(dayX, 20);
                ctx.lineTo(dayX, height);
                ctx.stroke();
                
                // Show date in dd/mm format
                const formattedDate = `${day.toString().padStart(2, '0')}/${month}`;
                ctx.fillStyle = '#666';
                // Rotate text for better readability
                ctx.save();
                ctx.translate(dayX + 2, 15);
                ctx.rotate(-Math.PI / 6);
                ctx.fillText(formattedDate, 0, 0);
                ctx.restore();
            }
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
            x += daysThisMonth * dayWidth;
        }
    }
    
    drawTask(ctx, task, y) {
        const totalDays = (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
        const canvasWidth = document.getElementById('ganttChart').clientWidth;
        const dayWidth = (canvasWidth - 40) / (totalDays * 0.7); // Match timeline day width
        
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
            // Subtask - lighter color with pattern
            ctx.fillStyle = '#4f9de3';
            ctx.fillRect(x, barY + 2, width, barHeight - 4); // Slightly smaller height
            // Add subtle diagonal pattern
            ctx.strokeStyle = '#3d7ab3';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < width; i += 6) {
                ctx.beginPath();
                ctx.moveTo(x + i, barY + 2);
                ctx.lineTo(x + i + 6, barY + barHeight - 2);
                ctx.stroke();
            }
            ctx.lineWidth = 1;
        }
        
        // Add duration label
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        const text = `${duration}d`;
        const textWidth = ctx.measureText(text).width;
        if (width > textWidth + 10) {
            ctx.fillText(text, x + (width - textWidth) / 2, barY + 14);
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
        const dayWidth = (canvasWidth - 40) / (totalDays * 0.7);
        
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

            await this.addTask(
                selection,
                formData.get('type'),
                formData.get('startDate'),
                formData.get('endDate'),
                formData.get('name'),
                parentId,
                formData.get('trade'),
                formData.get('responsible')
            );

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
}

// Register the extension with Autodesk Viewer
if (typeof Autodesk !== "undefined" && Autodesk.Viewing) {
    Autodesk.Viewing.theExtensionManager.registerExtension('TimelineExtension', TimelineExtension);
}
