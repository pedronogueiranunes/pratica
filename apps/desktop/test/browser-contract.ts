import { storeContract } from "./store-contract";
import { IndexedDbBackend } from "../src/lib/storage/indexeddb";
const name = `pratica-contract-${crypto.randomUUID()}`;
storeContract(async () => new IndexedDbBackend(name)).then((checks) => {
  document.body.textContent = JSON.stringify({ passed: checks });
  document.body.dataset.result = "passed";
}).catch((error) => {
  document.body.textContent = String(error?.stack ?? error);
  document.body.dataset.result = "failed";
}).finally(() => indexedDB.deleteDatabase(name));
