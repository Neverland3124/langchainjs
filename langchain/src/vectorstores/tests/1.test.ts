/* eslint-disable no-process-env */
import { test } from "@jest/globals";

import { ClickHouseStore } from "../clickhouse.js";
import { HuggingFaceInferenceEmbeddings } from "../../embeddings/hf.js";

test("ClickHouseStore.fromText", async () => {
    await ClickHouseStore.fromTexts(  ["rubbish1", "rubbish2", "rubbish3"],
    [
      { id: 32, name: "32" },
      { id: 31, name: "31" },
      { id: 33, name: "33" },
    ],
    new HuggingFaceInferenceEmbeddings(),
    {
      host: "xancufdk53.us-east-1.aws.clickhouse.cloud",
      port: 8443,
      username: "default",
      password: "2FCFzqOk.zHSj",
    }
  );
});
