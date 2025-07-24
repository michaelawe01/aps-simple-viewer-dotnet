# Timeline Extension Enhancement Plan

## Current Status
The basic timeline extension is working correctly with:
- ✅ Timeline animation and controls
- ✅ Task management (add, edit, delete)
- ✅ Gantt chart visualization
- ✅ Basic table structure

## Required Enhancements

### 1. Toolbar Integration
**Goal**: Add timeline icon to viewer toolbar panel for better accessibility
**Implementation**:
- Modify the extension to add a toolbar button instead of showing panel immediately
- Integrate with Autodesk Viewer's toolbar system
- Make panel toggleable via toolbar button

### 2. Gantt Chart Date Formatting
**Current Issue**: Scrambled date display on Gantt chart
**Requirements**:
- Format dates as dd/mm
- One day = one grid pixel
- Ensure 30 days visible in one view
**Implementation**:
- Recalculate dayWidth to ensure proper spacing
- Fix date label positioning and formatting
- Adjust timeline scale for better visibility

### 3. LinkedElements Column
**New Feature**: Element linking system
**Requirements**:
- Add "LinkedElements" column to task table
- Support three linking modes:
  1. One element to one task
  2. Many elements to one task  
  3. Many tasks to one element
**Implementation**:
- Extend task data structure to include linking mode
- Add UI controls for selecting linking mode
- Update table rendering to include new column

### 4. Elements_names Column  
**New Feature**: Display linked element names
**Requirements**:
- Show names of linked elements
- For many elements: compact UI to show all elements
- Allow selection from viewer interface
- Enable filtering using model browser
**Implementation**:
- Add element name resolution from viewer
- Create compact element list UI for many-to-one scenarios
- Integrate with viewer selection and model browser

### 5. Enhanced Table Formatting
**Goal**: Better visual distinction between major tasks and subtasks
**Implementation**:
- Adjust cell lightness/background colors
- Modify font weights and styling
- Improve visual hierarchy

### 6. Testing & Integration
**Final Step**: Comprehensive testing of all new features
- Test toolbar integration
- Verify Gantt chart improvements
- Test element linking functionality
- Validate table formatting improvements

## Implementation Order
1. Toolbar integration (most visible change)
2. Gantt chart date formatting (fixes existing issue)
3. Table formatting improvements (enhances current UI)
4. LinkedElements column (new functionality)
5. Elements_names column (completes linking system)
6. Comprehensive testing

## Technical Considerations
- Maintain backward compatibility with existing tasks
- Ensure performance with large numbers of elements
- Integrate seamlessly with Autodesk Viewer APIs
- Preserve existing drag/drop and panel functionality