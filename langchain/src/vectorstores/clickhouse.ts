import * as uuid from "uuid";
import { ClickHouseClient, createClient } from "@clickhouse/client";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";


/**
 * Arguments for the ClickHouseStore class, which include the host, port,
 * protocol, username, password, index type, index parameters, index query params, column map,
 * database, table, and metric.
 */
export interface ClickHouseLibArgs {
  host: string;
  port: string | number;
  protocol?: string;
  username: string;
  password: string;
  indexType?: string;
  indexParam?: Record<string, number>;
  indexQueryParams?: Record<string, string>;
  columnMap?: ColumnMap;
  database?: string;
  table?: string;
  // metric?: metric;
}

/**
 * Mapping of columns in the ClickHouse database.
 */
export interface ColumnMap {
  id: string;
  uuid: string;
  document: string;
  embedding: string;
  metadata: string;
}

/**
 * Type of metric used in the ClickHouse database.
 */
export type metric = "angular" | "euclidean" | "manhattan" | "hamming" | "dot";

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

  private indexType: string;

  private indexParam: Record<string, number>;
  
  private indexQueryParams: Record<string, string>;
  
  private columnMap: ColumnMap;
  
  private database: string;
  
  private table: string;
  
  // TODO: Verify we don't need metric and delete all metric
  // private metric: metric;

  private isInitialized = false;

  _vectorstoreType(): string {
    return "clickhouse";
  }

  constructor(embeddings: Embeddings, args: ClickHouseLibArgs) {
    super(embeddings, args);

    this.indexType = args.indexType || "annoy";
    this.indexParam = args.indexParam || { "L2Distance": 100 };
    this.indexQueryParams = args.indexQueryParams || {};
    this.columnMap = args.columnMap || {
      id: "id",
      document: "document",
      embedding: "embedding",
      metadata: "metadata",
      uuid: "uuid",
    };
    this.database = args.database || "default";
    this.table = args.table || "vector_table";
    // this.metric = args.metric || "angular";

    console.log(
      "everything",
      args,
      this.columnMap,
      this.indexQueryParams,
      this.database,
      this.table,
      this.indexType
    );

    this.client = createClient({
      host: `${args.protocol ?? "https://"}${args.host}:${args.port}`,
      username: args.username,
      password: args.password,
      session_id: uuid.v4(),
    });
    console.log("done");
  }

  /**
   * Method to add vectors to the ClickHouse database.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    console.log("addVectors", documents);
    if (vectors.length === 0) {
      return;
    }

    console.log("this.isInitialized", this.isInitialized);
    if (!this.isInitialized) {
      await this.initialize(vectors[0].length);
    }
    console.log("after this.isInitialized", this.isInitialized);

    const queryStr = this.buildInsertQuery(vectors, documents);
    // console.log("queryStr", queryStr)
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
   * Method to search for vectors that are similar to a given query vector.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional filter for the search results.
   * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    if (!this.isInitialized) {
      await this.initialize(query.length);
    }
    const queryStr = this.buildSearchQuery(query, k, filter);

    const queryResultSet = await this.client.query({ query: queryStr });

    const queryResult: {
      data: { document: string; metadata: object; dist: number }[];
    } = await queryResultSet.json();

    console.log("queryResult", queryResult);
    const result: [Document, number][] = queryResult.data.map((item) => [
      new Document({ pageContent: item.document, metadata: item.metadata }),
      item.dist,
    ]);

    console.log("result", result);
    return result;
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
    console.log("docs", docs);
    return ClickHouseStore.fromDocuments(docs, embeddings, args);
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
    console.log("instance", instance);
    await instance.addDocuments(docs);
    console.log("after add docs");
    return instance;
  }

  /**
   * Static method to create an instance of ClickHouseStore from an existing
   * index.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the ClickHouseStore.
   * @returns Promise that resolves with a new instance of ClickHouseStore.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    args: ClickHouseLibArgs
  ): Promise<ClickHouseStore> {
    const instance = new this(embeddings, args);

    await instance.initialize();
    return instance;
  }

  /**
   * Method to initialize the ClickHouse database.
   * @param dimension Optional dimension of the vectors.
   * @returns Promise that resolves when the database has been initialized.
   */
  private async initialize(dimension?: number): Promise<void> {
    const dim = dimension ?? (await this.embeddings.embedQuery("test")).length;
    // await this.client.exec({ query: "DROP TABLE IF EXISTS vector_table;" });

    console.log("this.indexParam", this.indexParam)
    const indexParamStr = this.indexParam
      ? Object.entries(this.indexParam)
          .map(([key, value]) => `'${key}', ${value}`)
          .join(", ")
      : "";
    console.log("indexParamStr", indexParamStr)

    const query = `
    CREATE TABLE IF NOT EXISTS ${this.database}.${this.table}(
      ${this.columnMap.id} Nullable(String),
      ${this.columnMap.document} Nullable(String),
      ${this.columnMap.embedding} Array(Float32),
      ${this.columnMap.metadata} JSON,
      ${this.columnMap.uuid} UUID DEFAULT generateUUIDv4(),
      CONSTRAINT cons_vec_len CHECK length(${this.columnMap.embedding}) = ${dim},
      INDEX vec_idx ${this.columnMap.embedding} TYPE ${this.indexType}(${indexParamStr}) GRANULARITY 1000
    ) ENGINE =  MergeTree ORDER BY ${this.columnMap.uuid} SETTINGS index_granularity = 8192;`;

    console.log("after query", query);

    await this.client.exec({
      query: query,
      clickhouse_settings: {
        allow_experimental_object_type: 1,
        allow_experimental_annoy_index: 1,
      },
    });
    this.isInitialized = true;
    console.log("end initialize");
  }

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
        // TODO: id having issue, id, document, embedding, metadata, uuid
        `'${uuid.v4()}'`,
        `'${this.escapeString(document.pageContent)}'`,
        `[${vector}]`,
        `'${JSON.stringify(document.metadata)}'`,
        `'${uuid.v4()}'`,
      ].join(", ");
      data.push(`(${item})`);
    }
    const dataStr = data.join(", ");

    console.log("end buildInsertQuery");
    return `
      INSERT INTO TABLE
        ${this.database}.${this.table}(${columnsStr})
      VALUES
        ${dataStr}
    `;
  }

  private escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

    const settingStrings: string[] = [];
    if (this.indexQueryParams) {
      for (const [key, value] of Object.entries(this.indexQueryParams)) {
        settingStrings.push(`SETTING ${key}=${value}`);
      }
    }

    return `
      SELECT ${this.columnMap.document} AS document, ${
      this.columnMap.metadata
    } AS metadata, dist
      FROM ${this.database}.${this.table}
      ${whereStr}
      ORDER BY L2Distance(${
        this.columnMap.embedding
      }, [${query}]) AS dist ${order}
      LIMIT ${k} ${settingStrings.join(" ")}
    `;
  }
}
