#!/usr/bin/env node
// Validates that required environment variables are present and that the
// environment config files under config/environments/ share the same key set.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envDir = resolve(root, 'config/environments');
const environments = ['development', 'preview', 'production'];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`✖ ${message}`);
}

function loadEnvConfig(name) {
  const file = resolve(envDir, `${name}.json`);
  if (!existsSync(file)) {
    fail(`Missing environment config: config/environments/${name}.json`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in config/environments/${name}.json: ${error.message}`);
    return null;
  }
}

// 1. Load all environment configs.
const configs = {};
for (const name of environments) {
  const config = loadEnvConfig(name);
  if (config) configs[name] = config;
}

// 2. Compare key sets across the environment files.
const keySets = {};
for (const [name, config] of Object.entries(configs)) {
  keySets[name] = new Set(Object.keys(config));
}

const allKeys = new Set();
for (const keys of Object.values(keySets)) {
  for (const key of keys) allKeys.add(key);
}

for (const key of [...allKeys].sort()) {
  const missingIn = environments.filter(
    (name) => keySets[name] && !keySets[name].has(key),
  );
  if (missingIn.length > 0) {
    fail(
      `Key "${key}" is missing from: ${missingIn
        .map((name) => `config/environments/${name}.json`)
        .join(', ')}`,
    );
  }
}

// 3. Validate that required runtime env vars are set (existing behavior).
const requiredVars = allKeys.size > 0 ? [...allKeys] : [];
for (const name of requiredVars) {
  if (!process.env[name]) {
    console.warn(`⚠ Environment variable ${name} is not set`);
  }
}

if (failed) {
  console.error('\nEnvironment config check failed.');
  process.exit(1);
}

console.log('✔ Environment config key sets are consistent.');
