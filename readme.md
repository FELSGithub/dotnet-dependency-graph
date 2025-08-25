# Fuzze .NET Dependency Graph

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/FuzzelogicSolutionsLimited.dotnet-dependency-graph)](https://marketplace.visualstudio.com/items?itemName=FuzzelogicSolutionsLimited.dotnet-dependency-graph)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/FuzzelogicSolutionsLimited.dotnet-dependency-graph)](https://marketplace.visualstudio.com/items?itemName=FuzzelogicSolutionsLimited.dotnet-dependency-graph)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/FuzzelogicSolutionsLimited.dotnet-dependency-graph)](https://marketplace.visualstudio.com/items?itemName=FuzzelogicSolutionsLimited.dotnet-dependency-graph)

**Professional .NET dependency analysis with interactive graphs, security scanning, and comprehensive reporting.**

Visualize your .NET solution dependencies with an interactive graph, identify security vulnerabilities, and generate professional PDF reports. Built by [Fuzzelogic Solutions Limited](https://www.fuzzelogicsolutions.com).

---

## 🚀 Features

### 📊 Interactive Dependency Graph

- **Drag & Drop**: Move individual nodes around the canvas
- **Zoom & Pan**: Mouse wheel zoom and drag-to-pan navigation
- **Force-Directed Layout**: Automatic node positioning with physics simulation
- **Canvas-Based Rendering**: Smooth performance for large dependency networks

### 🔍 Complete Solution Analysis

- **Multi-Project Support**: Analyzes entire .NET solutions from `.sln` files
- **Dependency Detection**:
  - NuGet package references with versions
  - Project-to-project references
  - Assembly/DLL dependencies
- **Visual Organization**: Color-coded nodes by type and security status

### 🛡️ Security Analysis

- **Vulnerability Detection**: Identifies packages with known security issues
- **Deprecation Warnings**: Highlights unmaintained packages
- **Outdated Package Detection**: Shows packages with available updates
- **Color-Coded Status**: Visual indicators for security issues

### 📄 Professional Reporting

- **PDF Export**: Generate comprehensive multi-page reports
- **Executive Summary**: Key metrics and security overview
- **Project Breakdown**: Detailed dependencies for each project
- **Security Report**: Vulnerability analysis with recommendations

---

## 🎯 Quick Start

### Installation

1. **From VS Code Marketplace**:

   - Open VS Code Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
   - Search for "Fuzze .NET Dependency Graph"
   - Click **Install**

2. **From Command Line**:
   ```bash
   ext install FuzzelogicSolutionsLimited.dotnet-dependency-graph
   ```

### Basic Usage

1. **Open a .NET solution** in VS Code
2. **Right-click** on a `.sln` file in the Explorer
3. **Select** "Analyze .NET Dependencies"
4. **Explore** the interactive graph and tabs

---

## 📖 How to Use

### 🎮 Graph Navigation

#### **Moving Around**

- **Drag nodes**: Click and drag any dependency to move it
- **Pan canvas**: Click empty space and drag to move the view
- **Zoom**: Mouse wheel or use the zoom in/out buttons
- **Reset Layout**: Click "Reset Layout" to reorganize nodes automatically

#### **Understanding the Visualization**

- 🟢 **Green boxes** = Your projects
- 🔵 **Blue circles** = NuGet packages
- 🟠 **Orange diamonds** = Assemblies/DLLs
- **Arrows** = Dependency connections

#### **Security Color Coding**

- 🔴 **Red** = Vulnerable packages
- 🟠 **Orange** = Deprecated packages
- 🟡 **Yellow** = Outdated packages
- 🟢 **Green** = Secure packages

### 📋 Interface Tabs

#### **1. Dependency Graph Tab**

- Interactive canvas with draggable nodes
- Zoom and pan controls
- Reset layout button
- Real-time visualization

#### **2. Detailed Summary Tab**

- Table view of all dependencies organized by project
- Package names, versions, and types
- Easy-to-scan tabular format

#### **3. Security Analysis Tab**

- **Vulnerable Packages**: Security issues requiring updates
- **Deprecated Packages**: No longer maintained
- **Outdated Packages**: Updates available
- **Secure Packages**: Up-to-date dependencies

### 📊 PDF Export

Click **"Export Complete Report to PDF"** to generate:

- Executive summary with statistics
- Individual project dependency tables
- Security analysis with action items
- Professional formatting ready for stakeholders

---

## 🏗️ Supported Projects

### ✅ Fully Supported

- **.NET Core** (.NET 5, 6, 7, 8+)
- **ASP.NET Core** applications
- **.NET MAUI** projects
- **Blazor** applications
- **Console apps** and **Class libraries**
- **Any project with PackageReference format**

### ✅ File Types

- **Solution files**: `.sln`
- **Project files**: `.csproj`, `.vbproj`, `.fsproj`
- **Package formats**: `PackageReference` (modern format)

---

## 🔧 Current Functionality

### Graph Controls

- **Fit All**: Auto-scale to show entire graph
- **Reset Zoom**: Return to default scale
- **Toggle Physics**: Enable/disable automatic positioning

### Analysis Features

- **Solution parsing**: Extracts projects from .sln files
- **Package detection**: Reads NuGet references with versions
- **Project references**: Maps project-to-project dependencies
- **Assembly scanning**: Finds DLL dependencies in bin/obj folders
- **Security checking**: Basic vulnerability detection using known package lists

### Report Generation

- **Multi-page PDFs**: Executive summary, project details, security analysis
- **Professional styling**: Clean formatting suitable for business use
- **Complete data**: All dependencies with versions and security status

---

## 🚨 Troubleshooting

### Graph Not Showing

- Ensure your solution contains .NET projects with dependencies
- Check that `.sln` file is valid and contains project references
- Try re-running "Analyze .NET Dependencies"
- Look for errors in VS Code Developer Console (F12)

### PDF Export Not Working

- Allow popups in your browser
- Check for popup blockers
- Try closing other browser tabs if memory is low
- Wait a moment and try again if first attempt fails

### Large Solutions

- Analysis may take 30-60 seconds for solutions with 50+ projects
- Graph may be slow with 100+ dependencies - use zoom and pan
- Consider analyzing individual projects for very large codebases

### Missing Dependencies

- Ensure `dotnet restore` has been run on your solution
- Check that project files are properly formatted XML
- Verify NuGet packages are installed in packages folders

---

## 📞 Support & Resources

### 📚 Documentation

- **GitHub Repository**: [FELSGithub/dotnet-dependency-graph](https://github.com/FELSGithub/dotnet-dependency-graph)
- **Issue Reporting**: [GitHub Issues](https://github.com/FELSGithub/dotnet-dependency-graph/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/FELSGithub/dotnet-dependency-graph/discussions)

### 💬 Getting Help

- **Email Support**: [info@fuzzelogicsolutions.com](mailto:info@fuzzelogicsolutions.com)
- **Website**: [fuzzelogicsolutions.com](https://www.fuzzelogicsolutions.com)

### 🐛 Reporting Issues

Please include:

- VS Code version and operating system
- .NET project type and version
- Steps to reproduce the issue
- Any error messages from Developer Console

---

## 🔒 Privacy & Security

- **Local Processing**: All analysis happens on your machine
- **No Data Sent**: Your code never leaves VS Code
- **No External Calls**: Dependencies analyzed from local files only
- **Secure Reports**: PDF generation happens in your browser locally

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🏢 About Fuzzelogic Solutions

**Fuzzelogic Solutions Limited** creates professional developer tools and productivity extensions.

- **Website**: [fuzzelogicsolutions.com](https://www.fuzzelogicsolutions.com)
- **Email**: [info@fuzzelogicsolutions.com](mailto:info@fuzzelogicsolutions.com)
- **GitHub**: [FELSGithub](https://github.com/FELSGithub)

---

## 🎉 Get Started

1. **Install** the extension from VS Code Marketplace
2. **Open** your .NET solution in VS Code
3. **Right-click** any `.sln` file and select "Analyze .NET Dependencies"
4. **Explore** your dependencies with the interactive graph!

---

_Made with ❤️ by [Fuzzelogic Solutions Limited](https://www.fuzzelogicsolutions.com)_
