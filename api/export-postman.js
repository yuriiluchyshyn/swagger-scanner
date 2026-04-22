import { json } from './_db.js';

function convertToPostman(name, scan) {
  const items = [];
  for (const ep of scan.endpoints) {
    const urlParts = ep.fullUrl.split('?')[0].split('/').filter(Boolean);
    const item = {
      name: `${ep.method.toUpperCase()} ${ep.path}`,
      request: {
        method: ep.method.toUpperCase(),
        header: [],
        url: {
          raw: ep.fullUrl,
          protocol: ep.fullUrl.startsWith('https') ? 'https' : 'http',
          host: [new URL(ep.fullUrl).host],
          path: urlParts.slice(1),
        },
      },
    };
    if (ep.parameters) {
      const queryParams = ep.parameters.filter(p => p.in === 'query');
      if (queryParams.length) {
        item.request.url.query = queryParams.map(p => ({ key: p.name, value: '', description: p.description || '' }));
      }
      const bodyParam = ep.parameters.find(p => p.in === 'body');
      if (bodyParam) {
        item.request.body = { mode: 'raw', raw: JSON.stringify(bodyParam.schema || {}, null, 2), options: { raw: { language: 'json' } } };
      }
    }
    if (ep.requestBody) {
      const jsonContent = ep.requestBody.content?.['application/json'];
      if (jsonContent) {
        item.request.body = { mode: 'raw', raw: JSON.stringify(jsonContent.schema || {}, null, 2), options: { raw: { language: 'json' } } };
        item.request.header.push({ key: 'Content-Type', value: 'application/json' });
      }
    }
    items.push(item);
  }
  return {
    info: { name: name || 'Open API Scanner Export', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: items,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
  const { name, scan } = req.body;
  return json(res, convertToPostman(name, scan));
}
