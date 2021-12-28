import path from 'path';
import axios from 'axios';
import { promises as fsp } from 'fs';
import cheerio from 'cheerio';
import debug from 'debug';
import Listr from 'listr';

const axiosInstance = axios.create();
const downloadResource = (fileUrl, filePath) => axiosInstance.get(fileUrl, { responseType: 'arraybuffer' })
  .then((response) => fsp.writeFile(filePath, response.data));

const specifyUrl = (url) => {
  const { hostname, pathname } = url;
  const words = `${hostname}${pathname}`.match(/\w+/g);
  return words.join('-');
};

const specifyUrlOfResource = (url) => {
  const { pathname } = url;
  const { dir, name, ext } = path.parse(pathname);
  const resourcePathname = path.join(dir, name);
  const resourceUrl = new URL(resourcePathname, url.origin);
  const slugifiedUrl = specifyUrl(resourceUrl);

  return `${slugifiedUrl}${ext || '.html'}`;
};

const pageLoaderLog = debug('page-loader');

export default (inputUrl, outputPath = process.cwd()) => {
  const inputUrlObj = new URL(inputUrl);
  pageLoaderLog('incoming url', inputUrl);
  const specifiedUrl = specifyUrl(inputUrlObj);
  const mainHtmlFileName = `${specifiedUrl}.html`;
  const contentDirName = `${specifiedUrl}_files`;
  const htmlFilePath = path.resolve(outputPath, mainHtmlFileName);
  const contentDirPath = path.resolve(outputPath, contentDirName);
  pageLoaderLog([specifiedUrl, htmlFilePath, contentDirPath]);

  const tagsAttributes = {
    link: 'href',
    img: 'src',
    script: 'src',
  };

  const extractResources = (data, dirName, localOrigin) => {
    const $ = cheerio.load(data);
    const resources = [];

    Object.entries(tagsAttributes).forEach(([tag, attribute]) => {
      $(tag).each((i, element) => {
        const tagElement = $(element);
        const attributeUrl = tagElement.attr(attribute);
        const attributeObjUrl = new URL(attributeUrl, localOrigin);

        if (attributeObjUrl.origin !== localOrigin) {
          return;
        }

        const resourceUrl = attributeObjUrl.toString();
        const resourceFileName = specifyUrlOfResource(attributeObjUrl);
        const relativeFilePath = path.join(dirName, resourceFileName);
        resources.push({ resourceUrl, resourceFileName });
        tagElement.attr(attribute, `${relativeFilePath}`);
      });
    });

    return [
      $.html(),
      resources,
    ];
  };

  return axiosInstance.get(inputUrl)
    .then((response) => fsp.access(contentDirPath)
      .catch(() => fsp.mkdir(contentDirPath))
      .then(() => response))
    .then((response) => {
      pageLoaderLog('Response', response.status);
      const [
        modifiedHtml,
        resources,
      ] = extractResources(response.data, contentDirName, inputUrlObj.origin);

      pageLoaderLog(resources);
      return fsp.writeFile(htmlFilePath, modifiedHtml)
        .then(() => resources);
    })
    .then((resources) => {
      const tasks = resources.map(({ resourceUrl, resourceFileName }) => ({
        title: resourceUrl,
        task: () => {
          const filePath = path.join(contentDirPath, resourceFileName);
          return downloadResource(resourceUrl, filePath);
        },
      }));
      pageLoaderLog('tasks', tasks);
      const list = new Listr(tasks, { concurrent: true });
      return list.run();
    })
    .then(() => htmlFilePath);
};
