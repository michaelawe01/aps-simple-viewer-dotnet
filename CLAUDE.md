# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Autodesk Platform Services (APS) Simple Viewer application built with .NET 8 and ASP.NET Core. It demonstrates how to authenticate with APS, upload 3D models, translate them, and view them using the Autodesk Viewer. The project includes a custom Timeline Extension for 4D construction simulation capabilities.

## Development Commands

### Setup and Build
- `dotnet restore` - Install/restore .NET dependencies
- `dotnet build` - Build the application
- `dotnet run` - Run the application (available at http://localhost:8080)
- `dotnet watch run` - Run with hot reload during development

### Configuration
- Copy `appsettings.Development.json.example` to `appsettings.Development.json` if needed
- Set `APS_CLIENT_ID` and `APS_CLIENT_SECRET` in `appsettings.Development.json`
- Optional: Set `APS_BUCKET` (defaults to `{clientId}-basic-app`)

## Architecture

### Backend (.NET/C#)
- **Program.cs/Startup.cs**: Standard ASP.NET Core entry point and configuration
- **Models/APS.cs**: Main APS service class (partial class split across multiple files)
  - **APS.Auth.cs**: Authentication and token management with public/internal token caching
  - **APS.Oss.cs**: Object Storage Service operations (bucket management, file upload)
  - **APS.Deriv.cs**: Model Derivative service operations (translation, status checking)
- **Controllers/**:
  - **AuthController.cs**: Provides `/api/auth/token` endpoint for frontend authentication
  - **ModelsController.cs**: Handles model operations (`GET /api/models`, `POST /api/models`, `GET /api/models/{urn}/status`)

### Frontend (JavaScript/HTML)
- **wwwroot/index.html**: Main application page with Autodesk Viewer integration
- **wwwroot/viewer.js**: Core viewer initialization and model loading functions
- **wwwroot/main.js**: Application logic for model management UI
- **wwwroot/TimelineExtension.js**: Custom Autodesk Viewer extension for 4D timeline functionality
- **wwwroot/extensions-init.js**: Extension initialization helpers
- **wwwroot/timeline-init.js**: Timeline-specific initialization

### Key Dependencies
- **Autodesk.Authentication** (2.0.0): APS authentication
- **Autodesk.ModelDerivative** (2.0.0): Model translation services
- **Autodesk.OSS** (2.0.0): Object storage services
- **Chuongmep.Navis.Api** packages: Navisworks integration for timeline features

## Development Patterns

### APS Service Architecture
The `APS` class uses a partial class pattern split across multiple files for organization:
- Token caching implemented for both public (viewables:read) and internal (full permissions) tokens
- Automatic bucket creation with persistent policy
- Base64 encoding for URNs used throughout the application

### Frontend Integration
- Uses Autodesk Viewer 7.* from CDN
- Module-based JavaScript with ES6 imports/exports
- Extension loading configured in viewer initialization: `['Autodesk.DocumentBrowser', 'TimelineExtension']`

### Timeline Extension Features
- 4D construction simulation capabilities
- Task types: Construct, Demolish, Temporary (similar to Navisworks)
- Task relationships: Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish
- Date range simulation with visual timeline controls

## Configuration Notes
- Application runs on port 8080 by default (configurable in `Properties/launchSettings.json`)
- Uses ASP.NET Core development server with hot reload support
- Static files served from `wwwroot/` directory
- API controllers use conventional routing (`/api/[controller]/[action]`)