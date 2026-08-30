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

// Satu entri subdomain di config/domain.json. Bentuknya sengaja mengikuti
// berkas itu apa adanya (bahasa Indonesia) supaya tidak perlu lapisan
// penerjemah yang bisa ikut menyimpang.
export interface SitusPeta {
  kunci: string;
  nama?: string;
  host?: string[];
  lokal: string;
  masuk?: string;
  basis?: string;
  keterangan?: string;
  berkas?: string[];
  bersama?: string[];
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
      getSitus: () => Promise<{ port: number; situs: SitusPeta[] }>;
    };
  }
}
