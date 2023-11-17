/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";

import { ClickHouseStore } from "../clickhouse.js";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { Document } from "../../document.js";

test("ClickHouseStore.fromText", async () => {
  const vectorStore = await ClickHouseStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new HuggingFaceInferenceEmbeddings(),
    {
      host: process.env.CLICKHOUSE_HOST || "localhost",
      port: process.env.CLICKHOUSE_PORT || "8443",
      username: process.env.CLICKHOUSE_USERNAME || "username",
      password: process.env.CLICKHOUSE_PASSWORD || "password",
    }
  );

  const results = await vectorStore.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
    whereStr: "metadata.name = '1'",
  });
  expect(filteredResults).toEqual([
    new Document({
      pageContent: "Bye bye",
      metadata: { id: 1, name: "1" },
    }),
  ]);
});

test("ClickHouseStore.fromExistingIndex", async () => {
  await ClickHouseStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new HuggingFaceInferenceEmbeddings(),
    {
      host: process.env.CLICKHOUSE_HOST || "localhost",
      port: process.env.CLICKHOUSE_PORT || "8443",
      username: process.env.CLICKHOUSE_USERNAME || "username",
      password: process.env.CLICKHOUSE_PASSWORD || "password",
      table: "test_table",
    }
  );

  const vectorStore = await ClickHouseStore.fromExistingIndex(
    new HuggingFaceInferenceEmbeddings(),
    {
      host: process.env.MYSCALE_HOST || "localhost",
      port: process.env.MYSCALE_PORT || "8443",
      username: process.env.MYSCALE_USERNAME || "username",
      password: process.env.MYSCALE_PASSWORD || "password",
      table: "test_table",
    }
  );

  const results = await vectorStore.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
    whereStr: "metadata.name = '1'",
  });
  expect(filteredResults).toEqual([
    new Document({
      pageContent: "Bye bye",
      metadata: { id: 1, name: "1" },
    }),
  ]);
});