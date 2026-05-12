/**
 * Repository instances — import from here in routes and other modules.
 *
 * All repositories share a single DatabaseHandle so connections are pooled
 * by the underlying HTTP client. To swap the storage backend, replace the
 * concrete implementations here while keeping the interfaces unchanged.
 */
import db from '../core/db.js';
import { MesahubAppRepository } from './mesahub/app.repository.js';
import { MesahubSchemaRepository } from './mesahub/schema.repository.js';
import { MesahubSubmissionRepository } from './mesahub/submission.repository.js';
import { MesahubTableManager } from './mesahub/table-manager.js';

export const appRepository = new MesahubAppRepository(db);
export const schemaRepository = new MesahubSchemaRepository(db);
export const submissionRepository = new MesahubSubmissionRepository(db);
export const tableManager = new MesahubTableManager(db);
