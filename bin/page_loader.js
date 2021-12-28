#!/usr/bin/env node

import program from 'commander';
import pageLoader from '../src/loadPage.js';

/* тред из StackOverflow на тему:
https://stackoverflow.com/questions/9153571/is-there-a-way-to-get-version-from-package-json-in-nodejs-code
Возможно использование в кач-ве получ-я номера версии из package.json:

const installingPack = fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8');
const { version } = JSON.parse(installingPack);
*/

program
  .version('1.0.0')
  // или: .version(version) - если вар-т выше, с installingPack
  .description('Download page and save it to file system')
  .arguments('<url>')
  .option('-o, --output [path]', 'output dir path', process.cwd())
  .action((url) => {
    pageLoader(url, program.output);
  })
  .action((url) => pageLoader(url, program.opts().output)
    .then((path) => console.log(`\nOpen ${path}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    }))
// .parse(process.argv);
// eslint-disable-next-line semi-style
;

program.parse(process.argv);
