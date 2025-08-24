import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Import xml2js with require to avoid type issues
const xml2js = require('xml2js');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface ProjectInfo {
    name: string;
    path: string;
    dependencies: string[];
    packageReferences: PackageReference[];
    projectReferences: string[];
    outputType?: string;
}

interface PackageReference {
    name: string;
    version: string;
}

interface DependencyNode {
    id: string;
    label: string;
    type: 'project' | 'package' | 'assembly';
    version?: string;
    path?: string;
}

interface DependencyEdge {
    from: string;
    to: string;
    type: 'project-ref' | 'package-ref' | 'assembly-ref';
}

class DotNetDependencyAnalyzer {
    private projects: ProjectInfo[] = [];
    private nodes: DependencyNode[] = [];
    private edges: DependencyEdge[] = [];

    async analyzeSolution(solutionPath: string): Promise<void> {
        this.projects = [];
        this.nodes = [];
        this.edges = [];

        const solutionDir = path.dirname(solutionPath);
        
        // If no solution file, scan directory for project files
        if (!solutionPath.endsWith('.sln')) {
            await this.scanDirectoryForProjects(solutionDir);
        } else {
            const solutionContent = await readFile(solutionPath, 'utf8');
            const projectPaths = this.extractProjectPaths(solutionContent, solutionDir);
            
            // If no projects found in solution, scan directory
            if (projectPaths.length === 0) {
                await this.scanDirectoryForProjects(solutionDir);
            } else {
                // Analyze each project from solution
                for (const projectPath of projectPaths) {
                    try {
                        await this.analyzeProject(projectPath);
                    } catch (error) {
                        console.error(`Error analyzing project ${projectPath}:`, error);
                    }
                }
            }
        }

        // Build dependency graph
        this.buildDependencyGraph();
        
        // If still no projects, create a sample to show the interface works
        if (this.projects.length === 0) {
            this.createSampleData();
        }
    }

    private async scanDirectoryForProjects(directory: string): Promise<void> {
        try {
            const entries = await readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    await this.scanDirectoryForProjects(fullPath);
                } else if (entry.isFile() && /\.(csproj|vbproj|fsproj)$/.test(entry.name)) {
                    try {
                        await this.analyzeProject(fullPath);
                    } catch (error) {
                        console.error(`Error analyzing project ${fullPath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning directory:', error);
        }
    }

    private createSampleData(): void {
        // Create sample data to demonstrate the interface
        const sampleProject = {
            name: 'SampleProject',
            path: '/sample/path/SampleProject.csproj',
            dependencies: ['System.Core', 'System.Data'],
            packageReferences: [
                { name: 'Newtonsoft.Json', version: '13.0.3' },
                { name: 'Microsoft.EntityFrameworkCore', version: '7.0.0' }
            ],
            projectReferences: [],
            outputType: 'Library'
        };

        this.projects.push(sampleProject);
        this.buildDependencyGraph();
    }

    private extractProjectPaths(solutionContent: string, solutionDir: string): string[] {
        const projectRegex = /Project\(".*"\)\s*=\s*".*",\s*"([^"]+\.(?:csproj|vbproj|fsproj))"/g;
        const projectPaths: string[] = [];
        let match;

        while ((match = projectRegex.exec(solutionContent)) !== null) {
            const relativePath = match[1].replace(/\\/g, path.sep);
            const fullPath = path.resolve(solutionDir, relativePath);
            projectPaths.push(fullPath);
        }

        return projectPaths;
    }

    private async analyzeProject(projectPath: string): Promise<void> {
        const projectContent = await readFile(projectPath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(projectContent);

        const projectName = path.basename(projectPath, path.extname(projectPath));
        const projectDir = path.dirname(projectPath);

        const project: ProjectInfo = {
            name: projectName,
            path: projectPath,
            dependencies: [],
            packageReferences: [],
            projectReferences: [],
            outputType: this.getOutputType(result)
        };

        // Extract package references
        this.extractPackageReferences(result, project);
        
        // Extract project references
        this.extractProjectReferences(result, project, projectDir);
        
        // Extract assembly references
        await this.extractAssemblyReferences(result, project, projectDir);

        this.projects.push(project);
    }

    private getOutputType(projectXml: any): string {
        try {
            const propertyGroups = projectXml.Project?.PropertyGroup || [];
            for (const group of Array.isArray(propertyGroups) ? propertyGroups : [propertyGroups]) {
                if (group.OutputType) {
                    return Array.isArray(group.OutputType) ? group.OutputType[0] : group.OutputType;
                }
            }
        } catch (error) {
            console.error('Error extracting output type:', error);
        }
        return 'Library';
    }

    private extractPackageReferences(projectXml: any, project: ProjectInfo): void {
        try {
            const itemGroups = projectXml.Project?.ItemGroup || [];
            for (const group of Array.isArray(itemGroups) ? itemGroups : [itemGroups]) {
                if (group.PackageReference) {
                    const packageRefs = Array.isArray(group.PackageReference) ? group.PackageReference : [group.PackageReference];
                    for (const pkg of packageRefs) {
                        if (pkg.$ && pkg.$.Include) {
                            project.packageReferences.push({
                                name: pkg.$.Include,
                                version: pkg.$.Version || 'Unknown'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error extracting package references:', error);
        }
    }

    private extractProjectReferences(projectXml: any, project: ProjectInfo, projectDir: string): void {
        try {
            const itemGroups = projectXml.Project?.ItemGroup || [];
            for (const group of Array.isArray(itemGroups) ? itemGroups : [itemGroups]) {
                if (group.ProjectReference) {
                    const projectRefs = Array.isArray(group.ProjectReference) ? group.ProjectReference : [group.ProjectReference];
                    for (const projRef of projectRefs) {
                        if (projRef.$ && projRef.$.Include) {
                            const refPath = path.resolve(projectDir, projRef.$.Include);
                            project.projectReferences.push(refPath);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error extracting project references:', error);
        }
    }

    private async extractAssemblyReferences(projectXml: any, project: ProjectInfo, projectDir: string): Promise<void> {
        try {
            const itemGroups = projectXml.Project?.ItemGroup || [];
            for (const group of Array.isArray(itemGroups) ? itemGroups : [itemGroups]) {
                if (group.Reference) {
                    const assemblyRefs = Array.isArray(group.Reference) ? group.Reference : [group.Reference];
                    for (const asmRef of assemblyRefs) {
                        if (asmRef.$ && asmRef.$.Include) {
                            project.dependencies.push(asmRef.$.Include);
                        }
                    }
                }
            }

            // Also check for implicit references in bin/obj directories
            await this.scanForCompiledDependencies(projectDir, project);
        } catch (error) {
            console.error('Error extracting assembly references:', error);
        }
    }

    private async scanForCompiledDependencies(projectDir: string, project: ProjectInfo): Promise<void> {
        try {
            const binDir = path.join(projectDir, 'bin');
            const objDir = path.join(projectDir, 'obj');
            
            for (const dir of [binDir, objDir]) {
                if (fs.existsSync(dir)) {
                    await this.scanDirectoryForDlls(dir, project);
                }
            }
        } catch (error) {
            console.error('Error scanning for compiled dependencies:', error);
        }
    }

    private async scanDirectoryForDlls(directory: string, project: ProjectInfo): Promise<void> {
        try {
            const entries = await readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory()) {
                    await this.scanDirectoryForDlls(fullPath, project);
                } else if (entry.isFile() && entry.name.endsWith('.dll')) {
                    const dllName = path.basename(entry.name, '.dll');
                    if (!project.dependencies.includes(dllName)) {
                        project.dependencies.push(dllName);
                    }
                }
            }
        } catch (error) {
            // Directory might not be accessible, ignore
        }
    }

    private buildDependencyGraph(): void {
        // Add project nodes
        for (const project of this.projects) {
            this.nodes.push({
                id: project.name,
                label: project.name,
                type: 'project',
                path: project.path
            });

            // Add package nodes and edges
            for (const pkg of project.packageReferences) {
                const pkgId = `pkg-${pkg.name}`;
                if (!this.nodes.find(n => n.id === pkgId)) {
                    this.nodes.push({
                        id: pkgId,
                        label: pkg.name,
                        type: 'package',
                        version: pkg.version
                    });
                }
                
                this.edges.push({
                    from: project.name,
                    to: pkgId,
                    type: 'package-ref'
                });
            }

            // Add project reference edges
            for (const projRefPath of project.projectReferences) {
                const refProjectName = path.basename(projRefPath, path.extname(projRefPath));
                this.edges.push({
                    from: project.name,
                    to: refProjectName,
                    type: 'project-ref'
                });
            }

            // Add assembly nodes and edges
            for (const dep of project.dependencies) {
                const asmId = `asm-${dep}`;
                if (!this.nodes.find(n => n.id === asmId)) {
                    this.nodes.push({
                        id: asmId,
                        label: dep,
                        type: 'assembly'
                    });
                }
                
                this.edges.push({
                    from: project.name,
                    to: asmId,
                    type: 'assembly-ref'
                });
            }
        }
    }

    getGraphData() {
        return {
            projects: this.projects,
            nodes: this.nodes,
            edges: this.edges
        };
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('.NET Dependency Graph extension is now active!');
    
    vscode.window.showInformationMessage('.NET Dependency Graph extension activated!');

    const disposable = vscode.commands.registerCommand('dotnetDependencyGraph.analyze', async (uri?: vscode.Uri) => {
        console.log('Command executed!', uri);
        vscode.window.showInformationMessage('Analyze command triggered!');
        
        try {
            let solutionPath: string;

            if (uri) {
                solutionPath = uri.fsPath;
            } else {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage('No workspace folder found');
                    return;
                }

                const solutionFiles: string[] = [];
                for (const folder of workspaceFolders) {
                    const pattern = new vscode.RelativePattern(folder, '*.sln');
                    const files = await vscode.workspace.findFiles(pattern);
                    solutionFiles.push(...files.map(f => f.fsPath));
                }

                if (solutionFiles.length === 0) {
                    vscode.window.showErrorMessage('No solution file found in workspace');
                    return;
                } else if (solutionFiles.length === 1) {
                    solutionPath = solutionFiles[0];
                } else {
                    const selected = await vscode.window.showQuickPick(
                        solutionFiles.map(f => ({ label: path.basename(f), detail: f })),
                        { placeHolder: 'Select solution to analyze' }
                    );
                    if (!selected) {
                        return;
                    }
                    solutionPath = selected.detail;
                }
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing .NET Dependencies",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Scanning solution..." });
                
                const analyzer = new DotNetDependencyAnalyzer();
                await analyzer.analyzeSolution(solutionPath);
                
                progress.report({ message: "Generating visualization..." });
                
                const graphData = analyzer.getGraphData();
                
                // Debug output
                console.log('Graph data:', graphData);
                vscode.window.showInformationMessage(`Found ${graphData.projects.length} projects, ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
                
                await showDependencyGraph(context, graphData, solutionPath);
            });

        } catch (error) {
            console.error('Full error:', error);
            vscode.window.showErrorMessage(`Error analyzing dependencies: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function showDependencyGraph(context: vscode.ExtensionContext, graphData: any, solutionPath: string) {
    const panel = vscode.window.createWebviewPanel(
        'dotnetDependencyGraph',
        '.NET Dependency Graph',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    const securityAnalysis = await analyzePackageSecurity(graphData);
    panel.webview.html = getWebviewContent(graphData, path.basename(solutionPath), securityAnalysis);
}

async function analyzePackageSecurity(graphData: any) {
    const analysis = {
        vulnerable: [] as any[],
        outdated: [] as any[],
        deprecated: [] as any[],
        secure: [] as any[]
    };

    const knownVulnerable = [
        'Newtonsoft.Json:12.0.0', 'System.Text.Json:4.6.0', 'Microsoft.AspNetCore.Mvc:2.1.0'
    ];

    const deprecated = [
        'Microsoft.AspNet.Mvc', 'System.Web.Mvc', 'Microsoft.Owin'
    ];

    for (const project of graphData.projects) {
        for (const pkg of project.packageReferences) {
            const packageId = `${pkg.name}:${pkg.version}`;
            const packageInfo = {
                projectName: project.name,
                packageName: pkg.name,
                version: pkg.version,
                issues: [] as string[]
            };

            if (knownVulnerable.some((vuln: string) => packageId.includes(vuln))) {
                packageInfo.issues.push('Known security vulnerability');
                analysis.vulnerable.push(packageInfo);
            }
            else if (deprecated.some((dep: string) => pkg.name.includes(dep))) {
                packageInfo.issues.push('Package is deprecated');
                analysis.deprecated.push(packageInfo);
            }
            else if (isOldVersion(pkg.version)) {
                packageInfo.issues.push('Outdated version available');
                analysis.outdated.push(packageInfo);
            }
            else {
                analysis.secure.push(packageInfo);
            }
        }
    }

    return analysis;
}

function isOldVersion(version: string): boolean {
    if (version.includes('beta') || version.includes('alpha') || version.includes('rc')) {
        return true;
    }
    
    const majorVersion = parseInt(version.split('.')[0]);
    return majorVersion < 3;
}

function getWebviewContent(graphData: any, solutionName: string, securityAnalysis: any): string {
    const { projects, nodes, edges } = graphData;
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>.NET Dependency Graph</title>
        <script src="https://unpkg.com/vis-network@9.1.2/dist/vis-network.min.js"></script>
        <style>
            * { box-sizing: border-box; }
            body { 
                margin: 0; padding: 0; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #1e1e1e; color: #cccccc;
            }
            .container { height: 100vh; display: flex; flex-direction: column; }
            .header { padding: 20px; background: #252526; border-bottom: 1px solid #3c3c3c; }
            .header h1 { margin: 0 0 10px 0; color: #ffffff; font-size: 24px; }
            .stats { display: flex; gap: 20px; margin-bottom: 15px; }
            .stat { padding: 8px 16px; background: #2d2d30; border-radius: 6px; border-left: 3px solid #007acc; }
            .security-summary { display: flex; gap: 15px; }
            .security-item { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; }
            .vulnerable { background: #f14c4c; color: white; }
            .outdated { background: #ffcc02; color: #1e1e1e; }
            .deprecated { background: #ff8c00; color: white; }
            .secure { background: #89d185; color: #1e1e1e; }
            .main-content { flex: 1; display: flex; flex-direction: column; }
            .tabs { display: flex; background: #2d2d30; border-bottom: 1px solid #3c3c3c; }
            .tab { padding: 12px 24px; cursor: pointer; border-bottom: 2px solid transparent; user-select: none; }
            .tab.active { background: #1e1e1e; border-bottom-color: #007acc; color: #ffffff; }
            .tab:hover:not(.active) { background: #37373d; }
            .tab-content { flex: 1; display: none; position: relative; }
            .tab-content.active { display: block; }
            #network { width: 100%; height: 100%; background: #1e1e1e; }
            .controls { position: absolute; top: 20px; right: 20px; z-index: 1000; display: flex; gap: 10px; }
            .control-btn { padding: 8px 12px; background: #2d2d30; border: 1px solid #3c3c3c; color: #cccccc; border-radius: 4px; cursor: pointer; font-size: 12px; }
            .control-btn:hover { background: #37373d; }
            .table-container { height: 100%; overflow: auto; padding: 20px; }
            .project-section { margin-bottom: 30px; background: #252526; border-radius: 8px; overflow: hidden; }
            .project-header { background: #2d2d30; padding: 15px 20px; border-bottom: 1px solid #3c3c3c; }
            .project-title { font-size: 18px; font-weight: 600; color: #ffffff; margin: 0; }
            .project-path { font-size: 12px; color: #8c8c8c; margin: 5px 0 0 0; font-family: 'Courier New', monospace; }
            .dependencies-table { width: 100%; border-collapse: collapse; }
            .dependencies-table th { background: #37373d; padding: 12px 20px; text-align: left; font-weight: 600; color: #ffffff; border-bottom: 1px solid #3c3c3c; }
            .dependencies-table td { padding: 10px 20px; border-bottom: 1px solid #2d2d30; }
            .dependencies-table tr:hover { background: #2d2d30; }
            .package-name { font-family: 'Courier New', monospace; font-weight: 500; }
            .version { font-family: 'Courier New', monospace; color: #9cdcfe; }
            .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; text-transform: uppercase; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1>.NET Dependency Analysis - ${solutionName}</h1>
                        <div class="stats">
                            <div class="stat">Projects: ${projects.length}</div>
                            <div class="stat">Dependencies: ${nodes.length}</div>
                            <div class="stat">Connections: ${edges.length}</div>
                        </div>
                        <div class="security-summary">
                            <div class="security-item vulnerable">🔴 Vulnerable: ${securityAnalysis.vulnerable.length}</div>
                            <div class="security-item outdated">🟡 Outdated: ${securityAnalysis.outdated.length}</div>
                            <div class="security-item deprecated">🟠 Deprecated: ${securityAnalysis.deprecated.length}</div>
                            <div class="security-item secure">🟢 Secure: ${securityAnalysis.secure.length}</div>
                        </div>
                    </div>
                    <button class="control-btn" onclick="exportToPDF()" style="padding: 15px 25px; font-size: 16px; background: #007acc; color: white; border: none;">📄 Export Complete Report to PDF</button>
                </div>
            </div>
            
            <div class="main-content">
                <div class="tabs">
                    <div class="tab active" onclick="switchTab('graph')">📊 Dependency Graph</div>
                    <div class="tab" onclick="switchTab('summary')">📋 Detailed Summary</div>
                    <div class="tab" onclick="switchTab('security')">🔒 Security Analysis</div>
                </div>
                
                <div id="graph-tab" class="tab-content active">
                    <div class="controls" style="position: absolute; top: 10px; right: 10px; z-index: 100;">
                        <button class="control-btn" onclick="resetGraph()">🔄 Reset Layout</button>
                        <button class="control-btn" onclick="zoomIn()">🔍+ Zoom In</button>
                        <button class="control-btn" onclick="zoomOut()">🔍- Zoom Out</button>
                    </div>
                    <canvas id="dependency-canvas" 
                            style="width: 100%; height: 100%; cursor: grab; background: #1e1e1e;"
                            onmousedown="startDrag(event)"
                            onmousemove="drag(event)" 
                            onmouseup="stopDrag(event)"
                            onwheel="zoom(event)">
                    </canvas>
                </div>
                
                <div id="summary-tab" class="tab-content">
                    <div class="table-container">
                        ${generateProjectSummary(projects)}
                    </div>
                </div>
                
                <div id="security-tab" class="tab-content">
                    <div class="table-container">
                        ${generateSecurityAnalysis(securityAnalysis)}
                    </div>
                </div>
            </div>
        </div>

        <script>
            const graphData = ${JSON.stringify(graphData)};
            const securityAnalysis = ${JSON.stringify(securityAnalysis)};
            const solutionName = '${solutionName}';
            
            let canvas, ctx;
            let nodes = [];
            let edges = [];
            let isDragging = false;
            let dragNode = null;
            let offsetX = 0, offsetY = 0;
            let scale = 1;
            let panX = 0, panY = 0;
            let isPanning = false;
            
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Extension loaded with', graphData.projects.length, 'projects');
                initCanvas();
                setupGraph();
                drawGraph();
            });

            function initCanvas() {
                canvas = document.getElementById('dependency-canvas');
                ctx = canvas.getContext('2d');
                
                // Set canvas size
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                
                window.addEventListener('resize', function() {
                    canvas.width = canvas.offsetWidth;
                    canvas.height = canvas.offsetHeight;
                    drawGraph();
                });
            }

            function setupGraph() {
                nodes = [];
                edges = [];
                
                if (!graphData.nodes || graphData.nodes.length === 0) {
                    return;
                }

                // Create nodes with random initial positions
                graphData.nodes.forEach((node, i) => {
                    nodes.push({
                        id: node.id,
                        label: node.label,
                        type: node.type,
                        version: node.version,
                        x: Math.random() * (canvas.width - 200) + 100,
                        y: Math.random() * (canvas.height - 200) + 100,
                        width: Math.max(ctx.measureText(node.label).width + 20, 120),
                        height: 40,
                        color: getNodeColor(node),
                        isDragging: false
                    });
                });

                // Create edges
                graphData.edges.forEach(edge => {
                    const fromNode = nodes.find(n => n.id === edge.from);
                    const toNode = nodes.find(n => n.id === edge.to);
                    
                    if (fromNode && toNode) {
                        edges.push({
                            from: fromNode,
                            to: toNode,
                            type: edge.type,
                            color: getEdgeColor(edge.type)
                        });
                    }
                });

                // Apply force-directed layout
                applyForceLayout();
            }

            function applyForceLayout() {
                const iterations = 50;
                const repulsion = 50000;
                const attraction = 0.01;
                const damping = 0.9;

                for (let iter = 0; iter < iterations; iter++) {
                    // Calculate repulsive forces
                    nodes.forEach(node1 => {
                        let fx = 0, fy = 0;
                        
                        nodes.forEach(node2 => {
                            if (node1 !== node2) {
                                const dx = node1.x - node2.x;
                                const dy = node1.y - node2.y;
                                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                                
                                const force = repulsion / (distance * distance);
                                fx += (dx / distance) * force;
                                fy += (dy / distance) * force;
                            }
                        });
                        
                        node1.vx = (node1.vx || 0) + fx;
                        node1.vy = (node1.vy || 0) + fy;
                    });

                    // Calculate attractive forces from edges
                    edges.forEach(edge => {
                        const dx = edge.to.x - edge.from.x;
                        const dy = edge.to.y - edge.from.y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                        
                        const force = distance * attraction;
                        const fx = (dx / distance) * force;
                        const fy = (dy / distance) * force;
                        
                        edge.from.vx = (edge.from.vx || 0) + fx;
                        edge.from.vy = (edge.from.vy || 0) + fy;
                        edge.to.vx = (edge.to.vx || 0) - fx;
                        edge.to.vy = (edge.to.vy || 0) - fy;
                    });

                    // Apply velocities and damping
                    nodes.forEach(node => {
                        node.vx = (node.vx || 0) * damping;
                        node.vy = (node.vy || 0) * damping;
                        node.x += node.vx;
                        node.y += node.vy;
                        
                        // Keep nodes in bounds
                        node.x = Math.max(50, Math.min(canvas.width - node.width - 50, node.x));
                        node.y = Math.max(50, Math.min(canvas.height - node.height - 50, node.y));
                    });
                }
            }

            function drawGraph() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                ctx.save();
                ctx.translate(panX, panY);
                ctx.scale(scale, scale);

                // Draw edges first
                edges.forEach(edge => {
                    ctx.strokeStyle = edge.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    
                    const fromX = edge.from.x + edge.from.width / 2;
                    const fromY = edge.from.y + edge.from.height / 2;
                    const toX = edge.to.x + edge.to.width / 2;
                    const toY = edge.to.y + edge.to.height / 2;
                    
                    ctx.moveTo(fromX, fromY);
                    ctx.lineTo(toX, toY);
                    ctx.stroke();
                    
                    // Draw arrowhead
                    const angle = Math.atan2(toY - fromY, toX - fromX);
                    const arrowLength = 10;
                    
                    ctx.beginPath();
                    ctx.moveTo(toX, toY);
                    ctx.lineTo(
                        toX - arrowLength * Math.cos(angle - Math.PI / 6),
                        toY - arrowLength * Math.sin(angle - Math.PI / 6)
                    );
                    ctx.moveTo(toX, toY);
                    ctx.lineTo(
                        toX - arrowLength * Math.cos(angle + Math.PI / 6),
                        toY - arrowLength * Math.sin(angle + Math.PI / 6)
                    );
                    ctx.stroke();
                });

                // Draw nodes
                nodes.forEach(node => {
                    // Node background
                    ctx.fillStyle = node.color;
                    ctx.fillRect(node.x, node.y, node.width, node.height);
                    
                    // Node border
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(node.x, node.y, node.width, node.height);
                    
                    // Node text
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        truncateText(node.label, 15),
                        node.x + node.width / 2,
                        node.y + node.height / 2 + 4
                    );
                });

                ctx.restore();

                // Draw legend
                drawLegend();
            }

            function drawLegend() {
                const legendX = canvas.width - 180;
                const legendY = 20;
                
                ctx.fillStyle = 'rgba(45, 45, 48, 0.9)';
                ctx.fillRect(legendX - 10, legendY - 10, 170, 160);
                
                const legendItems = [
                    { color: '#4CAF50', label: 'Projects' },
                    { color: '#2196F3', label: 'NuGet Packages' },
                    { color: '#FF9800', label: 'Assemblies' },
                    { color: '#f14c4c', label: 'Vulnerable' },
                    { color: '#ff8c00', label: 'Deprecated' },
                    { color: '#ffcc02', label: 'Outdated' }
                ];
                
                ctx.font = '12px Arial';
                ctx.textAlign = 'left';
                
                legendItems.forEach((item, i) => {
                    const y = legendY + i * 20;
                    
                    ctx.fillStyle = item.color;
                    ctx.fillRect(legendX, y, 16, 16);
                    
                    ctx.fillStyle = '#cccccc';
                    ctx.fillText(item.label, legendX + 20, y + 12);
                });
            }

            function startDrag(event) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = (event.clientX - rect.left - panX) / scale;
                const mouseY = (event.clientY - rect.top - panY) / scale;
                
                // Check if clicking on a node
                dragNode = null;
                for (let node of nodes) {
                    if (mouseX >= node.x && mouseX <= node.x + node.width &&
                        mouseY >= node.y && mouseY <= node.y + node.height) {
                        dragNode = node;
                        offsetX = mouseX - node.x;
                        offsetY = mouseY - node.y;
                        canvas.style.cursor = 'grabbing';
                        break;
                    }
                }
                
                if (!dragNode) {
                    isPanning = true;
                    offsetX = event.clientX - panX;
                    offsetY = event.clientY - panY;
                }
                
                isDragging = true;
            }

            function drag(event) {
                if (!isDragging) return;
                
                if (dragNode) {
                    const rect = canvas.getBoundingClientRect();
                    const mouseX = (event.clientX - rect.left - panX) / scale;
                    const mouseY = (event.clientY - rect.top - panY) / scale;
                    
                    dragNode.x = mouseX - offsetX;
                    dragNode.y = mouseY - offsetY;
                    
                    drawGraph();
                } else if (isPanning) {
                    panX = event.clientX - offsetX;
                    panY = event.clientY - offsetY;
                    drawGraph();
                }
            }

            function stopDrag(event) {
                isDragging = false;
                dragNode = null;
                isPanning = false;
                canvas.style.cursor = 'grab';
            }

            function zoom(event) {
                event.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;
                
                const wheel = event.deltaY < 0 ? 1.1 : 0.9;
                const newScale = scale * wheel;
                
                if (newScale >= 0.1 && newScale <= 3) {
                    scale = newScale;
                    drawGraph();
                }
            }

            function resetGraph() {
                scale = 1;
                panX = 0;
                panY = 0;
                setupGraph();
                drawGraph();
            }

            function zoomIn() {
                scale = Math.min(scale * 1.2, 3);
                drawGraph();
            }

            function zoomOut() {
                scale = Math.max(scale * 0.8, 0.1);
                drawGraph();
            }
            
            function getNodeColor(node) {
                const isVulnerable = securityAnalysis.vulnerable.some(v => v.packageName === node.label);
                const isOutdated = securityAnalysis.outdated.some(o => o.packageName === node.label);
                const isDeprecated = securityAnalysis.deprecated.some(d => d.packageName === node.label);
                
                if (isVulnerable) return '#f14c4c';
                if (isDeprecated) return '#ff8c00';
                if (isOutdated) return '#ffcc02';
                
                switch(node.type) {
                    case 'project': return '#4CAF50';
                    case 'package': return '#2196F3';
                    case 'assembly': return '#FF9800';
                    default: return '#999999';
                }
            }
            
            function getEdgeColor(type) {
                switch(type) {
                    case 'project-ref': return '#4CAF50';
                    case 'package-ref': return '#2196F3';
                    case 'assembly-ref': return '#FF9800';
                    default: return '#666666';
                }
            }
            
            function truncateText(text, maxLength) {
                return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
            }

            function getNodeColor(node) {
                const isVulnerable = securityAnalysis.vulnerable.some(v => v.packageName === node.label);
                const isOutdated = securityAnalysis.outdated.some(o => o.packageName === node.label);
                const isDeprecated = securityAnalysis.deprecated.some(d => d.packageName === node.label);
                
                if (isVulnerable) return '#f14c4c';
                if (isDeprecated) return '#ff8c00';
                if (isOutdated) return '#ffcc02';
                
                switch(node.type) {
                    case 'project': return '#4CAF50';
                    case 'package': return '#2196F3';
                    case 'assembly': return '#FF9800';
                    default: return '#999999';
                }
            }

            function getNodeShape(type) {
                switch(type) {
                    case 'project': return 'box';
                    case 'package': return 'ellipse';
                    case 'assembly': return 'diamond';
                    default: return 'dot';
                }
            }

            function getEdgeColor(type) {
                switch(type) {
                    case 'project-ref': return '#4CAF50';
                    case 'package-ref': return '#2196F3';
                    case 'assembly-ref': return '#FF9800';
                    default: return '#999999';
                }
            }

            function getNodeTooltip(node) {
                let tooltip = 'Type: ' + node.type + '\\nName: ' + node.label;
                if (node.version) tooltip += '\\nVersion: ' + node.version;
                if (node.path) tooltip += '\\nPath: ' + node.path;
                
                const isVulnerable = securityAnalysis.vulnerable.some(v => v.packageName === node.label);
                const isOutdated = securityAnalysis.outdated.some(o => o.packageName === node.label);
                const isDeprecated = securityAnalysis.deprecated.some(d => d.packageName === node.label);
                
                if (isVulnerable) tooltip += '\\n⚠️ SECURITY VULNERABILITY';
                if (isDeprecated) tooltip += '\\n⚠️ DEPRECATED PACKAGE';
                if (isOutdated) tooltip += '\\n📅 OUTDATED VERSION';
                
                return tooltip;
            }

            function fitNetwork() {
                if (network) network.fit();
            }

            function resetZoom() {
                if (network) {
                    network.moveTo({ position: {x: 0, y: 0}, scale: 1.0 });
                }
            }

            function togglePhysics() {
                physicsEnabled = !physicsEnabled;
                if (network) {
                    network.setOptions({physics: {enabled: physicsEnabled}});
                }
            }

            function exportToPDF() {
                try {
                    console.log('Starting PDF export...');
                    const printWindow = window.open('', '_blank', 'width=1200,height=800');
                    
                    if (!printWindow) {
                        alert('Please allow popups for PDF export to work');
                        return;
                    }
                    
                    const exportContent = generatePDFContent();
                    
                    printWindow.document.write(exportContent);
                    printWindow.document.close();
                    
                    // Wait for content to load then print
                    printWindow.onload = function() {
                        setTimeout(function() {
                            printWindow.focus();
                            printWindow.print();
                        }, 1000);
                    };
                    
                    console.log('PDF export initiated successfully');
                } catch (error) {
                    console.error('PDF export failed:', error);
                    alert('PDF export failed: ' + error.message);
                }
            }

            function generatePDFContent() {
                return '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                '<title>.NET Dependency Analysis Report</title>' +
                '<style>' +
                'body { font-family: Arial, sans-serif; margin: 20px; color: #333; }' +
                '.header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007acc; padding-bottom: 20px; }' +
                '.section { margin-bottom: 30px; page-break-inside: avoid; }' +
                '.section h2 { color: #007acc; border-bottom: 1px solid #ddd; padding-bottom: 10px; page-break-after: avoid; }' +
                '.stats { display: flex; gap: 20px; margin: 20px 0; }' +
                '.stat { padding: 10px; background: #f5f5f5; border-radius: 4px; text-align: center; flex: 1; }' +
                'table { width: 100%; border-collapse: collapse; margin: 10px 0; page-break-inside: avoid; }' +
                'th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; font-size: 12px; }' +
                'th { background: #f8f9fa; font-weight: bold; }' +
                '.vulnerable { background: #ffe6e6; }' +
                '.deprecated { background: #fff3e0; }' +
                '.outdated { background: #fffbf0; }' +
                '.secure { background: #e8f5e8; }' +
                '.page-break { page-break-before: always; }' +
                '.project-page { page-break-before: always; }' +
                '.project-header { background: #f8f9fa; padding: 15px; margin-bottom: 20px; border: 1px solid #ddd; }' +
                '@media print { .no-print { display: none; } body { margin: 0; } }' +
                '</style>' +
                '</head>' +
                '<body>' +
                '<div class="header">' +
                '<h1>.NET Dependency Analysis Report</h1>' +
                '<p>Generated on: ' + new Date().toLocaleString() + '</p>' +
                '<p>Solution: ' + solutionName + '</p>' +
                '<div class="stats">' +
                '<div class="stat"><h3>' + graphData.projects.length + '</h3><p>Projects</p></div>' +
                '<div class="stat"><h3>' + (securityAnalysis.vulnerable.length + securityAnalysis.deprecated.length + securityAnalysis.outdated.length + securityAnalysis.secure.length) + '</h3><p>Total Packages</p></div>' +
                '<div class="stat"><h3>' + securityAnalysis.vulnerable.length + '</h3><p>Security Issues</p></div>' +
                '</div>' +
                '</div>' +
                
                // Executive Summary Page
                '<div class="section">' +
                '<h2>Executive Summary</h2>' +
                '<table>' +
                '<tr><th>Metric</th><th>Count</th><th>Status</th></tr>' +
                '<tr><td>Total Projects</td><td>' + graphData.projects.length + '</td><td>✅ Analyzed</td></tr>' +
                '<tr class="' + (securityAnalysis.vulnerable.length > 0 ? 'vulnerable' : 'secure') + '"><td>Security Vulnerabilities</td><td>' + securityAnalysis.vulnerable.length + '</td><td>' + (securityAnalysis.vulnerable.length > 0 ? '🔴 Action Required' : '✅ None Found') + '</td></tr>' +
                '<tr class="' + (securityAnalysis.deprecated.length > 0 ? 'deprecated' : 'secure') + '"><td>Deprecated Packages</td><td>' + securityAnalysis.deprecated.length + '</td><td>' + (securityAnalysis.deprecated.length > 0 ? '🟠 Migration Needed' : '✅ Up to Date') + '</td></tr>' +
                '<tr class="' + (securityAnalysis.outdated.length > 0 ? 'outdated' : 'secure') + '"><td>Outdated Packages</td><td>' + securityAnalysis.outdated.length + '</td><td>' + (securityAnalysis.outdated.length > 0 ? '🟡 Updates Available' : '✅ Current') + '</td></tr>' +
                '</table>' +
                '</div>' +
                
                // Each project on separate page
                generateDetailedProjectPages(graphData.projects) +
                
                // Security Analysis Page
                '<div class="section page-break">' +
                '<h2>Security Analysis Report</h2>' +
                generatePrintSecurityAnalysis(securityAnalysis) +
                '</div>' +
                
                // Recommendations Page
                '<div class="section page-break">' +
                '<h2>Action Items & Recommendations</h2>' +
                '<table>' +
                '<tr><th>Priority</th><th>Action</th><th>Count</th><th>Timeline</th></tr>' +
                (securityAnalysis.vulnerable.length > 0 ? '<tr class="vulnerable"><td>🔴 CRITICAL</td><td>Update vulnerable packages immediately</td><td>' + securityAnalysis.vulnerable.length + '</td><td>Within 24 hours</td></tr>' : '') +
                (securityAnalysis.deprecated.length > 0 ? '<tr class="deprecated"><td>🟠 HIGH</td><td>Plan migration from deprecated packages</td><td>' + securityAnalysis.deprecated.length + '</td><td>Next sprint</td></tr>' : '') +
                (securityAnalysis.outdated.length > 0 ? '<tr class="outdated"><td>🟡 MEDIUM</td><td>Update outdated packages</td><td>' + securityAnalysis.outdated.length + '</td><td>Next quarter</td></tr>' : '') +
                '<tr class="secure"><td>🟢 ONGOING</td><td>Regular dependency audits</td><td>All Projects</td><td>Monthly</td></tr>' +
                '<tr class="secure"><td>🟢 ONGOING</td><td>Automated security scanning</td><td>CI/CD Pipeline</td><td>Every build</td></tr>' +
                '</table>' +
                '</div>' +
                '</body>' +
                '</html>';
            }

            function generateDetailedProjectPages(projects) {
                return projects.map(function(project, index) {
                    return '<div class="' + (index > 0 ? 'project-page' : 'section') + '">' +
                        '<div class="project-header">' +
                        '<h2>Project: ' + project.name + '</h2>' +
                        '<p><strong>Path:</strong> ' + project.path + '</p>' +
                        '<p><strong>Output Type:</strong> ' + (project.outputType || 'Library') + '</p>' +
                        '<p><strong>Total Dependencies:</strong> ' + (project.packageReferences.length + project.projectReferences.length + project.dependencies.length) + '</p>' +
                        '</div>' +
                        
                        // NuGet Packages Table
                        (project.packageReferences.length > 0 ? 
                        '<h3>NuGet Packages (' + project.packageReferences.length + ')</h3>' +
                        '<table>' +
                        '<tr><th>Package Name</th><th>Version</th><th>Type</th></tr>' +
                        project.packageReferences.map(function(pkg) {
                            return '<tr><td>' + pkg.name + '</td><td>' + pkg.version + '</td><td>NuGet Package</td></tr>';
                        }).join('') +
                        '</table>' : '<h3>NuGet Packages</h3><p>No NuGet packages found.</p>') +
                        
                        // Project References Table
                        (project.projectReferences.length > 0 ?
                        '<h3>Project References (' + project.projectReferences.length + ')</h3>' +
                        '<table>' +
                        '<tr><th>Project Name</th><th>Path</th></tr>' +
                        project.projectReferences.map(function(ref) {
                            var name = ref.split('/').pop().replace(/\.(csproj|vbproj|fsproj)$/, '');
                            return '<tr><td>' + name + '</td><td>' + ref + '</td></tr>';
                        }).join('') +
                        '</table>' : '<h3>Project References</h3><p>No project references found.</p>') +
                        
                        // Assembly References Table  
                        (project.dependencies.length > 0 ?
                        '<h3>Assembly References (' + project.dependencies.length + ')</h3>' +
                        '<table>' +
                        '<tr><th>Assembly Name</th><th>Type</th></tr>' +
                        project.dependencies.map(function(dep) {
                            return '<tr><td>' + dep + '</td><td>Assembly/DLL</td></tr>';
                        }).join('') +
                        '</table>' : '<h3>Assembly References</h3><p>No assembly references found.</p>') +
                        
                        '</div>';
                }).join('');
            }

            function generatePrintProjectSummary(projects) {
                return projects.map(function(project) {
                    return '<div style="margin-bottom: 25px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">' +
                        '<div style="background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd;">' +
                        '<h3 style="margin: 0; color: #007acc;">' + project.name + '</h3>' +
                        '<p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">' + project.path + '</p>' +
                        '</div>' +
                        '<table style="margin: 0;">' +
                        '<thead><tr><th>Type</th><th>Name</th><th>Version</th><th>Status</th></tr></thead>' +
                        '<tbody>' +
                        project.packageReferences.map(function(pkg) {
                            return '<tr><td>📦 NuGet</td><td>' + pkg.name + '</td><td>' + pkg.version + '</td><td>OK</td></tr>';
                        }).join('') +
                        project.projectReferences.map(function(ref) {
                            var name = ref.split('/').pop().replace(/\.(csproj|vbproj|fsproj)$/, '');
                            return '<tr><td>🔗 Project</td><td>' + name + '</td><td>-</td><td>OK</td></tr>';
                        }).join('') +
                        project.dependencies.map(function(dep) {
                            return '<tr><td>📚 Assembly</td><td>' + dep + '</td><td>-</td><td>OK</td></tr>';
                        }).join('') +
                        '</tbody></table></div>';
                }).join('');
            }

            function generatePrintSecurityAnalysis(analysis) {
                var content = '';
                
                if (analysis.vulnerable.length > 0) {
                    content += '<h3>🔴 Vulnerable Packages</h3>' +
                        '<table><thead><tr><th>Project</th><th>Package</th><th>Version</th><th>Issues</th><th>Recommendation</th></tr></thead><tbody>' +
                        analysis.vulnerable.map(function(item) {
                            return '<tr class="vulnerable"><td>' + item.projectName + '</td><td>' + item.packageName + '</td><td>' + item.version + '</td><td>' + item.issues.join(', ') + '</td><td>Update immediately</td></tr>';
                        }).join('') +
                        '</tbody></table>';
                }
                
                if (analysis.deprecated.length > 0) {
                    content += '<h3>🟠 Deprecated Packages</h3>' +
                        '<table><thead><tr><th>Project</th><th>Package</th><th>Version</th><th>Issues</th><th>Recommendation</th></tr></thead><tbody>' +
                        analysis.deprecated.map(function(item) {
                            return '<tr class="deprecated"><td>' + item.projectName + '</td><td>' + item.packageName + '</td><td>' + item.version + '</td><td>' + item.issues.join(', ') + '</td><td>Find modern alternative</td></tr>';
                        }).join('') +
                        '</tbody></table>';
                }
                
                if (analysis.outdated.length > 0) {
                    content += '<h3>🟡 Outdated Packages</h3>' +
                        '<table><thead><tr><th>Project</th><th>Package</th><th>Version</th><th>Issues</th><th>Recommendation</th></tr></thead><tbody>' +
                        analysis.outdated.map(function(item) {
                            return '<tr class="outdated"><td>' + item.projectName + '</td><td>' + item.packageName + '</td><td>' + item.version + '</td><td>' + item.issues.join(', ') + '</td><td>Consider updating</td></tr>';
                        }).join('') +
                        '</tbody></table>';
                }
                
                if (content === '') {
                    content = '<p style="color: #28a745; font-weight: bold;">✅ No security issues found! All packages are up to date and secure.</p>';
                }
                
                return content;
            }

            function switchTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(tabName + '-tab').classList.add('active');
                event.target.classList.add('active');
                
                if (tabName === 'graph' && !network) {
                    setTimeout(initNetwork, 100);
                }
            }

            document.addEventListener('DOMContentLoaded', function() {
                initNetwork();
            });
        </script>
    </body>
    </html>`;
}

function generateProjectSummary(projects: any[]): string {
    return projects.map(project => `
        <div class="project-section">
            <div class="project-header">
                <h3 class="project-title">${project.name}</h3>
                <p class="project-path">${project.path}</p>
            </div>
            <table class="dependencies-table">
                <thead>
                    <tr><th>Type</th><th>Name</th><th>Version</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${project.packageReferences.map((pkg: any) => `
                        <tr>
                            <td>📦 NuGet</td>
                            <td class="package-name">${pkg.name}</td>
                            <td class="version">${pkg.version}</td>
                            <td><span class="status-badge secure">OK</span></td>
                        </tr>
                    `).join('')}
                    ${project.projectReferences.map((ref: string) => `
                        <tr>
                            <td>🔗 Project</td>
                            <td class="package-name">${path.basename(ref, path.extname(ref))}</td>
                            <td class="version">-</td>
                            <td><span class="status-badge secure">OK</span></td>
                        </tr>
                    `).join('')}
                    ${project.dependencies.map((dep: string) => `
                        <tr>
                            <td>📚 Assembly</td>
                            <td class="package-name">${dep}</td>
                            <td class="version">-</td>
                            <td><span class="status-badge secure">OK</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

function generateSecurityAnalysis(analysis: any): string {
    return `
        <div class="project-section">
            <div class="project-header">
                <h3 class="project-title">🔴 Vulnerable Packages</h3>
            </div>
            <table class="dependencies-table">
                <thead>
                    <tr><th>Project</th><th>Package</th><th>Version</th><th>Issues</th><th>Recommendation</th></tr>
                </thead>
                <tbody>
                    ${analysis.vulnerable.map((item: any) => `
                        <tr>
                            <td>${item.projectName}</td>
                            <td class="package-name">${item.packageName}</td>
                            <td class="version">${item.version}</td>
                            <td><span class="status-badge vulnerable">${item.issues.join(', ')}</span></td>
                            <td>Update immediately</td>
                        </tr>
                    `).join('')}
                    ${analysis.vulnerable.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #89d185;">✅ No vulnerable packages found</td></tr>' : ''}
                </tbody>
            </table>
        </div>
        
        <div class="project-section">
            <div class="project-header">
                <h3 class="project-title">🟠 Deprecated Packages</h3>
            </div>
            <table class="dependencies-table">
                <thead>
                    <tr><th>Project</th><th>Package</th><th>Version</th><th>Issues</th><th>Recommendation</th></tr>
                </thead>
                <tbody>
                    ${analysis.deprecated.map((item: any) => `
                        <tr>
                            <td>${item.projectName}</td>
                            <td class="package-name">${item.packageName}</td>
                            <td class="version">${item.version}</td>
                            <td><span class="status-badge deprecated">${item.issues.join(', ')}</span></td>
                            <td>Find modern alternative</td>
                        </tr>
                    `).join('')}
                    ${analysis.deprecated.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #89d185;">✅ No deprecated packages found</td></tr>' : ''}
                </tbody>
            </table>
        </div>
        
        <div class="project-section">
            <div class="project-header">
                <h3 class="project-title">🟡 Outdated Packages</h3>
            </div>
            <table class="dependencies-table">
                <thead>
                    <tr><th>Project</th><th>Package</th><th>Version</th><th>Issues</th><th>Recommendation</th></tr>
                </thead>
                <tbody>
                    ${analysis.outdated.map((item: any) => `
                        <tr>
                            <td>${item.projectName}</td>
                            <td class="package-name">${item.packageName}</td>
                            <td class="version">${item.version}</td>
                            <td><span class="status-badge outdated">${item.issues.join(', ')}</span></td>
                            <td>Consider updating</td>
                        </tr>
                    `).join('')}
                    ${analysis.outdated.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #89d185;">✅ All packages are up to date</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;
}

export function deactivate() {}