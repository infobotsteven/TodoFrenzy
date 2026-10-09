import { config } from '../config.js';
import { runMigrations, sqlite } from './client.js';

runMigrations();
console.log(`Migracje zastosowane: ${config.databasePath}`);
sqlite.close();
