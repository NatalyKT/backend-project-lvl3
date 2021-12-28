import path from 'path';
import nock from 'nock';
import { fileURLToPath } from 'url';
import { promises as fsp } from 'fs';
import os from 'os';
import loadPage from '../src/loadPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resourceDirName = 'ru-hexlet-io-courses_files';
const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const readFile = (filePath) => fsp.readFile(filePath, 'utf-8');

const inputURL = 'https://ru.hexlet.io/courses';
const pageURL = new URL(inputURL);
let tmpDir;
nock.disableNetConnect();
const scope = nock(pageURL.origin).persist();

// Вариант именования: expectedAbsolutePath (подумать)
const expectedPath = getFixturePath('ru-hexlet-io-courses.html');

const resourcePaths = [
  ['/assets/professions/nodejs.png', path.join(resourceDirName, 'ru-hexlet-io-assets-professions-nodejs.png')],
  ['/courses', path.join(resourceDirName, 'ru-hexlet-io-courses.html')],
  ['/assets/application.css', path.join(resourceDirName, 'ru-hexlet-io-assets-application.css')],
  ['/packs/js/runtime.js', path.join(resourceDirName, 'ru-hexlet-io-packs-js-runtime.js')],
];

beforeAll(() => {
  resourcePaths.forEach(([pathName, fileName]) => scope
    .get(pathName).replyWithFile(200, getFixturePath(fileName)));
});

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('Expected behavior: page-loader tests without errors', () => {
  test('Request: working, response: positive', async () => {
    await loadPage(inputURL, tmpDir);
    expect(scope.isDone()).toBe(true);
  });

  test('File downloaded and modified succesfully', async () => {
    const modifiedContent = await readFile(expectedPath);
    const savedPath = path.join(tmpDir, 'ru-hexlet-io-courses.html');

    await loadPage(inputURL, tmpDir);

    expect(await readFile(savedPath)).toBe(modifiedContent);
  });

  test.each(resourcePaths)('File downloaded and saved succesfully', async (sourceUrl, sourcePath) => {
    await loadPage(inputURL, tmpDir);

    const savedPath = path.join(tmpDir, sourcePath);
    const fixturePath = getFixturePath(sourcePath);
    const existingContent = await readFile(fixturePath);
    const savedContent = await readFile(savedPath);

    expect(savedContent).toBe(existingContent);
  });
});

describe.each([
  [expectedPath, 'not a dir'],
  [(path.join('/var', 'lib')), 'permission denied'],
  [(path.join('path', 'NotExists')), 'file[dir] not exist'],
])('Output errors', (outputPath, errorText) => {
  test(`Founded errors: "${errorText}"`, async () => {
    await expect(loadPage(inputURL, outputPath))
      .rejects
      .toThrow(errorText);
  });
});

describe.each([
  // 4xx
  404,
  410,
  // 5xx
  500,
  502,
  504,
])('Expected server&network errors', (error) => {
  test(`Get ${error} code error`, async () => {
    const errorUrl = `${pageURL.origin}/${error}`;
    await expect(loadPage(errorUrl, tmpDir))
      .rejects
      .toThrow(`${pageURL.origin}`);
  });
});
