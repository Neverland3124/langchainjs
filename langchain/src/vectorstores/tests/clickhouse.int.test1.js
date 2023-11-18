import { ClickHouseStore } from "langchain/vectorstores/clickhouse";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
console.log("start");
// const vectorStore = await ClickHouseStore.fromExistingIndex(
//   new HuggingFaceInferenceEmbeddings(),
//   {
//     host: "xancufdk53.us-east-1.aws.clickhouse.cloud",
//     port: 8443,
//     username: "default",
//     password: "2FCFzqOk.zHSj",
//   }
// );
const vectorStore = await ClickHouseStore.fromTexts(
  ["rubbish1", "rubbish2", "rubbish3"],
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


// const vectorStore = await ClickHouseStore.fromTexts(
//     ["Hello world", "Bye bye", "hello nice world"],
//     [
//       { id: 2, name: "2" },
//       { id: 1, name: "1" },
//       { id: 3, name: "3" },
//     ],
//     new HuggingFaceInferenceEmbeddings(),
//     {
//       host: "xancufdk53.us-east-1.aws.clickhouse.cloud",
//       port: 8443,
//       username: "default",
//       password: "2FCFzqOk.zHSj",
//     }
//   );
console.log("after fromtexts");
const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);
console.log("after results");
const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);
console.log("after filter");