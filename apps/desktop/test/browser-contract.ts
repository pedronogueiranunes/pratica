import { storeContract } from "./store-contract";
import { IndexedDbBackend } from "../src/lib/storage/indexeddb";
import { indexedDbMigration } from "./indexeddb-migration";
const name = `pratica-contract-${crypto.randomUUID()}`;
storeContract(async () => new IndexedDbBackend(name)).then(async (checks) => {
  checks.push(await indexedDbMigration());
  document.body.textContent = JSON.stringify({ passed: checks });
  document.body.dataset.result = "passed";
}).catch((error) => {
  document.body.textContent = String(error?.stack ?? error);
  document.body.dataset.result = "failed";
}).finally(() => indexedDB.deleteDatabase(name));
