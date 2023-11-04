import * as uuid from "uuid";
import { ClickHouseClient, createClient } from "@clickhouse/client";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

/**
 * Arguments for the ClickHouse class, which include the host, port,
 * protocol, username, password, index type, index parameters, index_query_params, column map,
 * database, table, and metric.
 */
export interface ClickHouseLibArgs {
    host: string;
    port: string | number;
    protocol?: string;
    username: string;
    password: string;
    indexType?: string;
    indexParam?: Record<string, string>;
    index_query_params?: Record<string, string>;
    columnMap?: ColumnMap;
    database?: string;
    table?: string;
    metric?: metric;
  }
  
  /**
   * Mapping of columns in the ClickHouse database.
   */
  export interface ColumnMap {
    id: string;
    uuid: string,
    document: string,
    embedding: number[],
    metadata: string;
  }
  
  /**
   * Type of metric used in the ClickHouse database.
   */
  export type metric = 'angular' | 'euclidean' | 'manhattan' | 'hamming' | 'dot';
  
  /**
   * Type for filtering search results in the ClickHouse database.
   */
  export interface ClickHouseFilter {
    whereStr: string;
  }

  /**
 * Class for interacting with the ClickHouse database. It extends the
 * VectorStore class and provides methods for adding vectors and
 * documents, searching for similar vectors, and creating instances from
 * texts or documents.
 */
export class ClickHouseStore extends VectorStore {
declare FilterType: ClickHouseFilter;
  private client: ClickHouseClient;
  private database: string;
  private table: string;
  private indexType: string;
  private indexParam: Record<string, string>;
  private index_query_params: Record<string, string>;
  private columnMap: ColumnMap;
  private metric: metric;

  private isInitialized = false;

  _vectorstoreType(): string {
    return "clickhouse";
  }

  constructor(embeddings: Embeddings, args: ClickHouseLibArgs) {
    super(embeddings, args);

    this.indexType = args.indexType || "annoy";
    this.indexParam = args.indexParam || {};
    this.index_query_params = args.index_query_params || {};
    this.columnMap = args.columnMap || {
        id: "id",             
        uuid: "uuid",         
        document: "document", 
        embedding: "vector", 
        metadata: "metadata", 
      };
    this.database = args.database || "default";
    this.table = args.table || "vector_table";
    this.metric = args.metric || "angular";

    this.client = createClient({
      host: `${args.protocol ?? "https://"}${args.host}:${args.port}`,
      username: args.username,
      password: args.password,
      session_id: uuid.v4(),
    });
  }


   /**
   * Method to initialize the ClickHouse database.
   * @param dimension Optional dimension of the vectors.
   * @returns Promise that resolves when the database has been initialized.
   */
  private async initialize(dimension?: number): Promise<void> {
    const dim = dimension ?? (await this.embeddings.embedQuery("test")).length;

    let indexParamStr = "";
    for (const [key, value] of Object.entries(this.indexParam)) {
      indexParamStr += `, '${key}=${value}'`;
    }

    const query = `
      CREATE TABLE IF NOT EXISTS ${this.database}.${this.table}(
        ${this.columnMap.id} String,
        ${this.columnMap.document} Nullable(String),
        ${this.columnMap.embedding} Array(Float32),
        ${this.columnMap.metadata} JSON,
        ${this.columnMap.uuid} UUID DEFAULT generateUUIDv4(),
        CONSTRAINT cons_vec_len CHECK length(${this.columnMap.embedding}) = ${dim},
        VECTOR INDEX vidx ${this.columnMap.embedding} TYPE ${this.indexType}('metric_type=${this.metric}'${indexParamStr})
      ) ENGINE = MergeTree ORDER BY ${this.columnMap.uuid}
    `;

    await this.client.exec({ query: "SET allow_experimental_object_type=1" });
    await this.client.exec({
      query: "SET output_format_json_named_tuples_as_objects = 1",
    });
    await this.client.exec({ query });
    this.isInitialized = true;
  }


//origin python code
//   def escape_str(self, value: str) -> str:
//         return "".join(f"{self.BS}{c}" if c in self.must_escape else c for c in value)
  private escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }


//   def _build_insert_sql(self, transac: Iterable, column_names: Iterable[str]) -> str:
//   ks = ",".join(column_names)
//   _data = []
//   for n in transac:
//       n = ",".join([f"'{self.escape_str(str(_n))}'" for _n in n])
//       _data.append(f"({n})")
//   i_str = f"""
//           INSERT INTO TABLE 
//               {self.config.database}.{self.config.table}({ks})
//           VALUES
//           {','.join(_data)}
//           """
//   return i_str

   /**
   * Method to build an SQL query for inserting vectors and documents into
   * the ClickHouse database.
   * @param vectors The vectors to insert.
   * @param documents The documents to insert.
   * @returns The SQL query string.
   */
   private buildInsertQuery(vectors: number[][], documents: Document[]): string {
    const columnsStr = Object.values(this.columnMap).join(", ");

    const data: string[] = [];
    for (let i = 0; i < vectors.length; i += 1) {
      const vector = vectors[i];
      const document = documents[i];
      const item = [
        `'${uuid.v4()}'`,
        `'${this.escapeString(document.pageContent)}'`,
        `[${vector}]`,
        `'${JSON.stringify(document.metadata)}'`,
      ].join(", ");
      data.push(`(${item})`);
    }
    const dataStr = data.join(", ");

    return `
      INSERT INTO TABLE
        ${this.database}.${this.table}(${columnsStr})
      VALUES
        ${dataStr}
    `;
  }




   /**
   * Method to add vectors to the ClickHouse database.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @returns Promise that resolves when the vectors have been added.
   */
   async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    if (!this.isInitialized) {
      await this.initialize(vectors[0].length);
    }

    const queryStr = this.buildInsertQuery(vectors, documents);
    await this.client.exec({ query: queryStr });
  }

  /**
   * Method to add documents to the ClickHouse database.
   * @param documents The documents to add.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents
    );
  }

  /**
   * Method to build an SQL query for searching for similar vectors in the
   * ClickHouse database.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional filter for the search results.
   * @returns The SQL query string.
   */
  private buildSearchQuery(
    query: number[],
    k: number,
    filter?: ClickHouseFilter
  ): string {
    const order = "ASC";

    const whereStr = filter ? `PREWHERE ${filter.whereStr}` : "";
    return `
      SELECT ${this.columnMap.document} AS text, ${this.columnMap.metadata} AS metadata, dist
      FROM ${this.database}.${this.table}
      ${whereStr}
      ORDER BY L2Distance(${this.columnMap.embedding}, [${query}]) AS dist ${order}
      LIMIT ${k}
    `;
  }

  /**
   * Method to search for vectors that are similar to a given query vector.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional filter for the search results.
   * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: ClickHouseFilter
  ): Promise<[Document, number][]> {
    if (!this.isInitialized) {
      await this.initialize(query.length);
    }
    
    const queryStr = this.buildSearchQuery(query, k, filter);

    const queryResultSet = await this.client.query({ query: queryStr });
    const queryResult: {
      data: { document: string; metadata: object; dist: number }[];
    } = await queryResultSet.json();

    const result: [Document, number][] = queryResult.data.map((item) => [
      new Document({ pageContent: item.document, metadata: item.metadata }),
      item.dist,
    ]);

    return result;
  }

    /**
   * Static method to create an instance of ClickHouseStore from documents.
   * @param docs The documents to use.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the ClickHouseStore.
   * @returns Promise that resolves with a new instance of ClickHouseStore.
   */
    static async fromDocuments(
        docs: Document[],
        embeddings: Embeddings,
        args: ClickHouseLibArgs
      ): Promise<ClickHouseStore> {
        const instance = new this(embeddings, args);
        await instance.addDocuments(docs);
        return instance;
      }

  /**
   * Static method to create an instance of ClickHouseStore from texts.
   * @param texts The texts to use.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the ClickHouseStore.
   * @returns Promise that resolves with a new instance of ClickHouseStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: ClickHouseLibArgs
  ): Promise<ClickHouseStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return ClickHouseStore.fromDocuments(docs, embeddings, args);
  }

  /**
   * Static method to create an instance of MyScaleStore from an existing
   * index.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the MyScaleStore.
   * @returns Promise that resolves with a new instance of MyScaleStore.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    args: ClickHouseLibArgs
  ): Promise<ClickHouseStore> {
    const instance = new this(embeddings, args);

    await instance.initialize();
    return instance;
  }


}

