import { createTestDatabase } from './test-database.mjs';
const db = await createTestDatabase();
console.log('All migrations and the non-personal game seed applied successfully.');
await db.close();
