import { MyScaleStore } from "langchain/vectorstores/myscale";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";

console.log("start");

const vectorStore = await MyScaleStore.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [
    { id: 2, name: "2" },
    { id: 1, name: "1" },
    { id: 3, name: "3" },
  ],
  new HuggingFaceInferenceEmbeddings(),
  {
    host: "msc-e3625172.us-east-1.aws.myscale.com",
    port: 443,
    username: "myscale_default",
    password: "passwd_l8RSVb3mHJvPHA",
  }
);

console.log("after fromtexts");
const results = await vectorStore.similaritySearch("hello world", 1);
console.log(results);

console.log("after results");

const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
  whereStr: "metadata.name = '1'",
});
console.log(filteredResults);

console.log("after filter");
