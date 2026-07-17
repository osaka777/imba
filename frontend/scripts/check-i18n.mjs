#!/usr/bin/env node
/**
 * Verifies that every locale has the same message keys as the source locale (ru).
 * Run: npm run i18n:check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "../src/shared/i18n/locales");
const BASE_LOCALE = "ru";

function listLocales() {
  return fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function getNamespaceFiles(locale) {
  const dir = path.join(LOCALES_DIR, locale);
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function getKeys(locale) {
  const keys = new Set();
  const namespaces = getNamespaceFiles(locale);

  for (const file of namespaces) {
    const namespace = file.replace(/\.json$/, "");
    const content = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, locale, file), "utf8"),
    );

    for (const key of Object.keys(content).sort()) {
      keys.add(`${namespace}.${key}`);
    }
  }

  return { keys, namespaces };
}

function main() {
  const locales = listLocales();
  if (!locales.includes(BASE_LOCALE)) {
    console.error(`Base locale "${BASE_LOCALE}" not found in ${LOCALES_DIR}`);
    process.exit(1);
  }

  const base = getKeys(BASE_LOCALE);
  let hasErrors = false;

  for (const locale of locales) {
    if (locale === BASE_LOCALE) continue;

    const current = getKeys(locale);
    const missing = [...base.keys].filter((key) => !current.keys.has(key));
    const extra = [...current.keys].filter((key) => !base.keys.has(key));
    const missingNamespaces = base.namespaces.filter(
      (ns) => !current.namespaces.includes(ns),
    );
    const extraNamespaces = current.namespaces.filter(
      (ns) => !base.namespaces.includes(ns),
    );

    if (
      missing.length ||
      extra.length ||
      missingNamespaces.length ||
      extraNamespaces.length
    ) {
      hasErrors = true;
      console.error(`\n[${locale}] locale mismatch vs ${BASE_LOCALE}:`);

      if (missingNamespaces.length) {
        console.error(`  missing namespaces: ${missingNamespaces.join(", ")}`);
      }
      if (extraNamespaces.length) {
        console.error(`  extra namespaces: ${extraNamespaces.join(", ")}`);
      }
      if (missing.length) {
        console.error(`  missing keys (${missing.length}):`);
        for (const key of missing) console.error(`    - ${key}`);
      }
      if (extra.length) {
        console.error(`  extra keys (${extra.length}):`);
        for (const key of extra) console.error(`    + ${key}`);
      }
    } else {
      console.log(`[${locale}] OK — ${current.keys.size} keys`);
    }
  }

  console.log(`\n[${BASE_LOCALE}] source — ${base.keys.size} keys`);

  if (hasErrors) {
    process.exit(1);
  }

  console.log("All locales are in sync.");
}

main();
