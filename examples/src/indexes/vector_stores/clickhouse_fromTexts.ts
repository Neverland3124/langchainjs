import { ClickHouseStore } from "langchain/vectorstores/clickhouse";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

// Initialize ClickHouse store from texts
const vectorStore = await ClickHouseStore.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [
    { id: 2, name: "2" },
    { id: 1, name: "1" },
    { id: 3, name: "3" },
  ],
  new OpenAIEmbeddings(),
  {
    host: process.env.CLICKHOUSE_HOST || "localhost",
    port: process.env.CLICKHOUSE_PORT || 8443,
    user: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "password",
    database: process.env.CLICKHOUSE_DATABASE || "default",
    table: process.env.CLICKHOUSE_TABLE || "vector_table",
  }
);

// Perform similarity search without filtering
const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

// Perform similarity search with filtering
const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
