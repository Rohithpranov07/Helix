import "dotenv/config";
import { connectDb, disconnectDb } from "../src/connect.js";
import { AntibodyModel } from "../src/models/antibody.js";

// Confirmed from MongoDB Node.js driver docs:
// collection.createSearchIndex({ name, type: "vectorSearch", definition: { fields: [...] } })
// numDimensions must match the embedding model output dimension.
// Configurable via EMBEDDING_DIMENSIONS env var (default 1536).

async function main() {
  await connectDb();

  const dimensions = parseInt(process.env["EMBEDDING_DIMENSIONS"] ?? "1536", 10);

  const indexDef = {
    name: "antibody_vec",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: dimensions,
          similarity: "cosine",
        },
      ],
    },
  };

  try {
    const name = await AntibodyModel.collection.createSearchIndex(indexDef);
    console.log(`Vector index created: ${name}`);
    console.log(`  collection : antibody`);
    console.log(`  path       : embedding`);
    console.log(`  dimensions : ${dimensions}`);
    console.log(`  similarity : cosine`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("Duplicate")) {
      console.log("Vector index antibody_vec already exists — skipping.");
    } else {
      throw err;
    }
  }

  // Poll until index is ready
  console.log("Waiting for index to become READY...");
  for (let i = 0; i < 30; i++) {
    const indexes = await AntibodyModel.collection.listSearchIndexes().toArray() as unknown[];
    const idx = indexes.find((x) => (x as Record<string, unknown>)["name"] === "antibody_vec") as Record<string, unknown> | undefined;
    if (idx) {
      console.log(`Index status: ${String(idx["status"] ?? "unknown")}`);
      if (idx["status"] === "READY") break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
