import path from 'path';
import axios from 'axios';
import {
  promises as fsp,
}
  from 'fs';
import cheerio from 'cheerio';
import debug from 'debug';
import Listr from 'listr';

const downloadResource = ({
  href: fileUrl,
  path: filePath,
}, _outputPath) => axios.get(fileUrl, {
  responseType: 'arraybuffer',
}).then((response) => fsp.writeFile(path.resolve(_outputPath, filePath), response.data));
const contentFileName = (url) => url.replace(/^\w*?:\/\//mi, '').replace(/\/$/, '').replace(/\W/mig, '-').concat('.html');
const contentDirName = (url) => path.parse(contentFileName(url)).name.concat('_files');
const mainHtmlFileName = (prefix, filePathName) => prefix.concat(filePathName.replace(/\//mig, '-')).concat(((path.extname(filePathName) === '') ? '.html' : ''));
export default (inputUrl, outputPath = process.cwd()) => {
  const log = 'page-loader';
  const pageLoaderLog = debug(log);
  debug('loading %o', log);
  pageLoaderLog('incoming url', inputUrl);
  const specifiedUrl = contentFileName(inputUrl, '-');
  const htmlFileName = contentDirName(inputUrl);
  const htmlFilePath = path.resolve(outputPath, specifiedUrl);
  const contentDirPath = path.resolve(outputPath, htmlFileName);
  let pageData;
  const tagsAttributes = [{
    selector: 'link',
    attr: 'href',
  }, {
    selector: 'img',
    attr: 'src',
  }, {
    selector: 'script',
    attr: 'src',
  }];
  const extractResources = (data, dirName, localOrigin) => {
    const $ = cheerio.load(data);
    const resources = [];
    const {
      hostname: resourceUrl,
    } = new URL(localOrigin);
    const prefixFile = resourceUrl.replace(/\./ig, '-');
    const findAttributeObj = (item) => {
      const tagElement = $(item.selector);
      tagElement.each((i, element) => {
        const link = $(element).attr(item.attr);
        if (!link) return;
        const {
          href, hostname: hostName, pathname: resourcePathName,
        } = new URL(link, localOrigin);
        if (resourceUrl !== hostName) return;
        const resourcePathname = path.join(dirName, mainHtmlFileName(prefixFile, resourcePathName));
        resources.push({
          href, path: resourcePathname,
        });
        $(element).attr(item.attr, resourcePathname);
      });
    };
    tagsAttributes.forEach(findAttributeObj);
    return {
      html: $.html(),
      assets: resources,
    };
  };
  return axios.get(inputUrl).then((response) => {
    pageData = extractResources(response.data, htmlFileName, inputUrl);
  }).then(() => fsp.access(contentDirPath).catch(() => {
    pageLoaderLog('Make a dir:', specifiedUrl);
    return fsp.mkdir(contentDirPath);
  })).then(() => {
    pageLoaderLog('Save file:', htmlFilePath);
    return fsp.writeFile(htmlFilePath, pageData.html, 'utf-8');
  })
    .then(() => {
      const tasks = (resourceUrl) => ({
        title: resourceUrl.href,
        task: () => downloadResource(resourceUrl, outputPath),
      });
      const list = new Listr(pageData.assets.map(tasks), {
        concurrent: true,
      });
      return list.run();
    })
    .then(() => htmlFilePath);
};
