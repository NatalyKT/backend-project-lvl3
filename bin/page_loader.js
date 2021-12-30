#!/usr/bin/env node

import program from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pageLoader from '../src/loadPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const installingPack = fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8');
const { version } = JSON.parse(installingPack);

program
  .version(version)
  .description('Download page and save it to file system')
  .arguments('<url>')
  .option('-o, --output [path]', 'output dir path', process.cwd())
  .action((url) => {
    pageLoader(url, program.output);
  })
  .action((url) => pageLoader(url, program.opts().output)
    .then((filePath) => console.log(`\nOpen ${filePath}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    }));

program.parse(process.argv);
