import express from 'express';
import bodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// MCP Server for AVAQUEEN Platform
// Implementasi Protocol: Model-Context-Protocol
// Menyediakan tools untuk semantic code retrieval & editing
// ============================================================

interface McpTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: any) => Promise<any>;
}

interface McpServer {
  name: string;
  version: string;
  tools: McpTool[];
}

// ============================================================
// Codebase Index & Semantic Parser
// ============================================================

interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'component' | 'module';
  file: string;
  line: number;
  column: number;
  description?: string;
}

interface CodeIndex {
  symbols: CodeSymbol[];
  references: Map<string, string[]>; // symbol -> list of files referencing it
  domainMap: Map<string, string>; // hostname -> workspace key
  workspaceMap: Map<string, string>; // workspace key -> workspace name
}

// Load domain configuration
const domainConfig = JSON.parse(
  fs.readFileSync('/d/AVAQUEEN-platform-main/config/domain.json', 'utf-8')
);

// Load menu configuration
const menuConfig = JSON.parse(
  fs.readFileSync('/d/AVAQUEEN-platform-main/config/menu.json', 'utf-8')
);

// Build index from codebase
const codeIndex: CodeIndex = {
  symbols: new Map<string, CodeSymbol[]>(),
  references: new Map<string, string[]>(),
  domainMap: new Map<string, string>(),
  workspaceMap: new Map<string, string>(),

  // Initialize domain map from domain.json
  initDomainMap() {
    for (const situs of domainConfig.situs) {
      for (const host of situs.host) {
        this.domainMap.set(host.toLowerCase(), situs.kunci);
      }
    }
    // Also map the primary domain
    this.domainMap.set(domainConfig.domain_utama.toLowerCase(), 'web');
  },

  // Initialize workspace map from menu.json
  initWorkspaceMap() {
    for (const [workspaceKey, workspaceConfig] of Object.entries(menuConfig.ruang)) {
      this.workspaceMap.set(workspaceKey, workspaceConfig.nama);
    }
  },

  // Parse a file using tree-sitter to extract symbols
  async parseFile(filePath: string): Promise<CodeSymbol[]> {
    const ext = path.extname(filePath).toLowerCase();
    let content = '';

    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return [];
    }

    const symbols: CodeSymbol[] = [];

    // JavaScript/TypeScript parsing
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      symbols.push(...this.parseJsContent(content, filePath));
    }
    // HTML parsing
    else if (ext === '.html' || path.basename(filePath).startsWith('portal') || path.basename(filePath).startsWith('index')) {
      symbols.push(...this.parseHtmlContent(content, filePath));
    }
    // JSON config files
    else if (ext === '.json') {
      symbols.push(...this.parseJsonContent(content, filePath));
    }

    return symbols;
  },

  // Parse JavaScript content for function/class declarations
  parseJsContent(content: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Function declarations: function nama()
      const funcDeclMatch = line.match(/^function\s+(\w+)\s*\(/);
      if (funcDeclMatch) {
        symbols.push({
          name: funcDeclMatch[1],
          type: 'function',
          file: filePath,
          line: lineNum,
          column: 0,
          description: 'Function declaration'
        });
      }

      // Arrow functions: const nama = () => {}
      const arrowFnMatch = line.match(/const\s+(\w+)\s*=\s*\(/);
      if (arrowFnMatch) {
        symbols.push({
          name: arrowFnMatch[1],
          type: 'function',
          file: filePath,
          line: lineNum,
          column: 0,
          description: 'Arrow function'
        });
      }

      // Class declarations: class Nama {}
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          file: filePath,
          line: lineNum,
          column: 0,
          description: 'Class declaration'
        });
      }

      // Variable declarations (let/const/var)
      const varMatch = line.match(/^(?:let|const|var)\s+(\w+)/);
      if (varMatch && !symbols.some(s => s.name === varMatch[1] && s.file === filePath && s.line === lineNum)) {
        symbols.push({
          name: varMatch[1],
          type: 'variable',
          file: filePath,
          line: lineNum,
          column: 0,
          description: 'Variable declaration'
        });
      }
    }

    return symbols;
  },

  // Parse HTML content for IDs, classes, and links
  parseHtmlContent(content: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const idMatches = content.match(/id=["'][^"']+["']/g);
    const classMatches = content.match(/class=["'][^"']+["']/g);
    const linkMatches = content.match(/href=["'][^"']+["']/g);

    if (idMatches) {
      for (const match of idMatches) {
        const name = match.replace(/id=["']/, '').replace(/["']$/, '');
        symbols.push({
          name,
          type: 'component',
          file: filePath,
          line: 1,
          column: 0,
          description: 'HTML element ID'
        });
      }
    }

    if (classMatches) {
      for (const match of classMatches) {
        const name = match.replace(/class=["']/, '').replace(/["']$/, '');
        if (name && name.startsWith('.')) {
          symbols.push({
            name: name.replace('.', ''),
            type: 'component',
            file: filePath,
            line: 1,
            column: 0,
            description: 'HTML element class'
          });
        }
      }
    }

    if (linkMatches) {
      for (const match of linkMatches) {
        const url = match.replace(/href=["']/, '').replace(/["']$/, '');
        symbols.push({
          name: url,
          type: 'variable',
          file: filePath,
          line: 1,
          column: 0,
          description: 'HTML link reference'
        });
      }
    }

    return symbols;
  },

  // Parse JSON config files
  parseJsonContent(content: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    try {
      const parsed = JSON.parse(content);
      if (parsed.situs) {
        for (const situs of parsed.situs) {
          if (situs.host) {
            for (const host of situs.host) {
              this.domainMap.set(host.toLowerCase(), situs.kunci);
            }
          }
          if (situs.kunci) {
            this.workspaceMap.set(situs.kunci, situs.nama || situs.kunci);
          }
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
    return symbols;
  },

  // Find symbol by name across codebase
  findSymbol(query: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [symbolName, symbols] of this.symbols) {
      if (symbolName.toLowerCase().includes(lowerQuery)) {
        results.push(...symbols);
      }
    }

    // Also search by filename/context
    for (const symbol of this.symbols.values().flat()) {
      if (symbol.name.toLowerCase().includes(lowerQuery) ||
          symbol.file.toLowerCase().includes(lowerQuery)) {
        results.push(symbol);
      }
    }

    return results;
  },

  // Find all files referencing a symbol
  findReferences(symbolName: string): string[] {
    return this.references.get(symbolName) || [];
  },

  // Add a symbol to the index
  addSymbol(symbol: CodeSymbol) {
    if (!this.symbols.has(symbol.name)) {
      this.symbols.set(symbol.name, []);
    }
    this.symbols.get(symbol.name)!.push(symbol);

    // Update references index
    if (!this.references.has(symbol.name)) {
      this.references.set(symbol.name, []);
    }
    if (!this.references.get(symbol.name)!.includes(symbol.file)) {
      this.references.get(symbol.name)!.push(symbol.file);
    }
  },

  // Get domain key for a hostname
  getDomainKey(hostname: string): string | undefined {
    return this.domainMap.get(hostname.toLowerCase());
  },

  // Get workspace name for a workspace key
  getWorkspaceName(key: string): string | undefined {
    return this.workspaceMap.get(key);
  }
};

// Initialize the index
codeIndex.initDomainMap();
codeIndex.initWorkspaceMap();

// ============================================================
// MCP Tools Implementation
// ============================================================

const mcpTools: McpTool[] = [
  {
    name: 'find_symbol',
    description: 'Cari simbol (fungsi, kelas, variable, component) di codebase AVAQUEEN',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Nama simbol yang dicari atau pattern pencarian'
        }
      },
      required: ['query']
    },
    execute: async ({ query }: { query: string }) => {
      const results = codeIndex.findSymbol(query);
      // Also parse relevant files to expand results
      const queryLower = query.toLowerCase();

      // Try to find files matching the query
      const filesToSearch = [
        '/d/AVAQUEEN-platform-main/ava-platform/index.html',
        '/d/AVAQUEEN-platform-main/ava-platform/portal.html',
        '/d/AVAQUEEN-platform-main/ava-platform/apps/index.html'
      ];

      for (const file of filesToSearch) {
        try {
          const symbols = await codeIndex.parseFile(file);
          for (const symbol of symbols) {
            if (symbol.name.toLowerCase().includes(queryLower) ||
                symbol.description?.toLowerCase().includes(queryLower)) {
              codeIndex.addSymbol(symbol);
              if (!results.some(r => r.name === symbol.name && r.file === symbol.file)) {
                results.push(symbol);
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        success: true,
        query,
        totalResults: results.length,
        results: results.slice(0, 50) // Limit to 50 results
      };
    }
  },

  {
    name: 'find_referencing_symbols',
    description: 'Temukan semua file yang merujuk pada simbol tertentu',
    parameters: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Nama simbol yang dicari referensinya'
        }
      },
      required: ['symbolName']
    },
    execute: async ({ symbolName }: { symbolName: string }) => {
      const files = codeIndex.findReferences(symbolName);
      const detailedRefs: Array<{ file: string; context: string }> = [];

      for (const file of files.slice(0, 30)) { // Limit to 30 files
        try {
          const content = fs.readFileSync(file, 'utf-8').substring(0, 200);
          detailedRefs.push({
            file: path.basename(file),
            context: content.substring(0, 100).replace(/\n/g, ' ') + '...'
          });
        } catch {
          detailedRefs.push({
            file: path.basename(file),
            context: 'Tidak dapat dibaca'
          });
        }
      }

      return {
        success: true,
        symbolName,
        totalFiles: files.length,
        files: detailedRefs
      };
    }
  },

  {
    name: 'replace_symbol_body',
    description: 'Replace isi sebuah fungsi atau blok code berdasarkan nama simbol',
    parameters: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Nama simbol yang akan diganti badannya'
        },
        newBody: {
          type: 'string',
          description: 'Body baru untuk menggantikan body lama'
        }
      },
      required: ['symbolName', 'newBody']
    },
    execute: async ({ symbolName, newBody }: { symbolName: string; newBody: string }) => {
      const symbols = codeIndex.findSymbol(symbolName);

      if (symbols.length === 0) {
        return {
          success: false,
          error: `Simbol "${symbolName}" tidak ditemukan di codebase`
        };
      }

      // Process each matching file
      const results = [];
      for (const symbol of symbols.slice(0, 5)) { // Limit to 5 files
        try {
          let filePath = symbol.file;
          let content = fs.readFileSync(filePath, 'utf-8');

          // Find the symbol location and replace
          // For functions, replace from function declaration to next function/class
          const lines = content.split('\n');
          let newContent = content;
          let replaced = false;

          // Simple replacement: find line with function name and replace until next function/class
          for (let i = symbol.line - 1; i < lines.length; i++) {
            if (lines[i].includes('function ') || lines[i].includes('class ') || lines[i].includes('const ')) {
              if (i > symbol.line - 1 && i !== symbol.line - 1) {
                break; // Stop at next declaration
              }
            }
          }

          // For now, just replace the line containing the symbol name
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(symbolName)) {
              // Replace the function body - simple approach: replace from this line until next semicolon/new function
              let bodyStart = i;
              let bodyEnd = lines.length;

              // Find end of function body
              for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].match(/^\s*(function|const|let|var|class|return)\s/) ||
                    (lines[j].trim() === '}' && j > i)) {
                  bodyEnd = j;
                  break;
                }
              }

              // Replace the body section
              const before = lines.slice(0, bodyStart).join('\n');
              const after = lines.slice(bodyEnd).join('\n');
              newContent = before + '\n' + newBody + '\n' + after;
              replaced = true;
              break;
            }
          }

          if (replaced) {
            fs.writeFileSync(filePath, newContent, 'utf-8');
            results.push({
              file: path.basename(filePath),
              status: 'success',
              symbol: symbolName
            });
          } else {
            results.push({
              file: path.basename(filePath),
              status: 'no_match',
              symbol: symbolName
            });
          }
        } catch (err) {
          results.push({
            file: 'unknown',
            status: 'error',
            error: (err as Error).message
          });
        }
      }

      return {
        success: results.length > 0,
        totalProcessed: results.length,
        results
      };
    }
  },

  {
    name: 'insert_after_symbol',
    description: 'Insert code setelah simbol tertentu',
    parameters: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Nama simbol di setelah code akan dimasukkan'
        },
        newCode: {
          type: 'string',
          description: 'Code baru yang akan dimasukkan'
        }
      },
      required: ['symbolName', 'newCode']
    },
    execute: async ({ symbolName, newCode }: { symbolName: string; newCode: string }) => {
      const symbols = codeIndex.findSymbol(symbolName);

      if (symbols.length === 0) {
        return {
          success: false,
          error: `Simbol "${symbolName}" tidak ditemukan`
        };
      }

      const results = [];
      for (const symbol of symbols.slice(0, 3)) {
        try {
          let filePath = symbol.file;
          let content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          // Find the symbol line and insert after it
          let inserted = false;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(symbolName) && !inserted) {
              // Insert after this line
              lines.splice(i + 1, 0, newCode);
              inserted = true;
              break;
            }
          }

          if (inserted) {
            fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
            results.push({
              file: path.basename(filePath),
              status: 'success',
              symbol: symbolName
            });
          } else {
            results.push({
              file: path.basename(filePath),
              status: 'not_found',
              symbol: symbolName
            });
          }
        } catch (err) {
          results.push({
            file: 'unknown',
            status: 'error',
            error: (err as Error).message
          });
        }
      }

      return {
        success: results.length > 0,
        totalProcessed: results.length,
        results
      };
    }
  },

  {
    name: 'get_domain_info',
    description: 'Dapatkan info domain dan workspace untuk subdomain tertentu',
    parameters: {
      type: 'object',
      properties: {
        hostname: {
          type: 'string',
          description: 'Hostname untuk dicari info domain-nya'
        }
      },
      required: ['hostname']
    },
    execute: async ({ hostname }: { hostname: string }) => {
      const domainKey = codeIndex.getDomainKey(hostname);
      const workspaceName = domainKey ? codeIndex.getWorkspaceName(domainKey) : undefined;

      return {
        success: true,
        hostname,
        domainKey: domainKey || 'tidak_ditemukan',
        workspaceName: workspaceName || 'tidak_ditemukan',
        domainConfig: domainConfig.domain_utama,
        fullDomainList: domainConfig.situs.map((s: any) => ({
          kunci: s.kunci,
          nama: s.nama,
          hosts: s.host
        }))
      };
    }
  },

  {
    name: 'list_workspaces',
    description: 'Daftarkan semua workspace/domain yang tersedia di codebase',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async () => {
      const workspaces = Array.from(codeIndex.workspaceMap.entries()).map(([key, name]) => ({
        key,
        nama: name
      }));

      const domains = domainConfig.situs.map((s: any) => ({
        kunci: s.kunci,
        nama: s.nama,
        host: s.host
      }));

      return {
        success: true,
        workspaces,
        domains,
        totalWorkspaces: workspaces.length,
        totalDomains: domains.length
      };
    }
  }
];

// ============================================================
// MCP Protocol Server
// ============================================================

const app = express();
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'avaqueen-mcp',
    version: '1.0.0',
    toolsAvailable: mcpTools.length
  });
});

// MCP endpoint - handle tool calls from LLM
app.post('/mcp', (req, res) => {
  const { method, params } = req.body;

  if (!method || !mcpTools.some(t => t.name === method)) {
    return res.status(404).json({
      error: 'Method not found',
      availableMethods: mcpTools.map(t => t.name)
    });
  }

  const tool = mcpTools.find(t => t.name === method);

  // Execute the tool
  tool.execute(params)
    .then(result => {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id || 1,
        result
      });
    })
    .catch(err => {
      console.error(`MCP Error [${method}]:`, err);
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body.id || 1,
        error: {
          code: -32603,
          message: (err as Error).message
        }
      });
    });
});

// List available tools
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  });
});

// Start server
const PORT = process.env.MCP_PORT || 3000;

app.listen(PORT, () => {
  console.log(`
============================================================
  AVAQUEEN MCP Server  🏥
============================================================
  Port: ${PORT}
  Tools: ${mcpTools.length}
  Codebase: AVAQUEEN Platform
  Domain Config: loaded (${domainConfig.situs.length} situs)

  Available Tools:
  ${mcpTools.map((t, i) => `  ${i + 1}. ${t.name}: ${t.description}`).join('\n  ')}

  Endpoints:
    GET  /health          - Health check
    GET  /mcp/tools       - List available tools
    POST /mcp             - Execute MCP tool
============================================================
`.trim());
});

// Export for testing
export { mcpTools, codeIndex, app };