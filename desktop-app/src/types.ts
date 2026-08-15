export interface Product {
  id: string;
  kode_internal: string;
  kode_material?: string | null;
  kategori: string;
  sub_kategori?: string | null;
  nama_tes: string;
  nama_singkat?: string | null;
  harga_normal: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface SqlResult {
  success: boolean;
  isSelect?: boolean;
  rows?: any[];
  rowCount?: number;
  affectedStatements?: number;
  executionTimeMs?: number;
  error?: string;
}

declare global {
  interface Window {
    api?: {
      getProducts: () => Promise<Product[]>;
      createProduct: (data: Partial<Product>) => Promise<Product>;
      updateProduct: (id: string, data: Partial<Product>) => Promise<Product>;
      deleteProduct: (id: string) => Promise<Product>;
      seedDatabase: () => Promise<{ success: boolean; count: number }>;
      execSql: (sql: string) => Promise<SqlResult>;
      getTables: () => Promise<string[]>;
      getTableData: (tableName: string) => Promise<any[]>;
      getTableColumns: (tableName: string) => Promise<TableColumn[]>;
      getAppVersion: () => Promise<string>;
    };
  }
}
