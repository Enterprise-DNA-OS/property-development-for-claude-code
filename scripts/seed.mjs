#!/usr/bin/env node
// Loads supabase/seed.sql: Harbour & Hill Developments, a fictional developer with four projects
// in Sydney, Melbourne and Auckland. Dates are relative to today and every insert skips what is
// already there, so re-running it is harmless.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
  const [c] = await db.query(`
    select (select count(*) from projects) as projects, (select count(*) from feasibilities) as feasibilities,
           (select count(*) from lots) as lots, (select count(*) from contracts) as contracts,
           (select count(*) from claims) as claims, (select count(*) from approvals) as approvals,
           (select count(*) from conditions) as conditions, (select count(*) from staff) as staff`);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const db = await getDb();
  try {
    const n = await seed(db);
    console.log(`seed: ${n.projects} projects, ${n.feasibilities} feasibility versions, ${n.lots} lots, ${n.contracts} contracts, ${n.claims} claims, ${n.approvals} approvals, ${n.conditions} conditions, ${n.staff} staff`);
  } finally {
    await db.close();
  }
}
