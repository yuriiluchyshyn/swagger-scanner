// Generate random data based on schema type
export function generateValue(schema, definitions) {
  if (!schema) return null;
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    const refSchema = definitions?.[refName];
    return refSchema ? generateValue(refSchema, definitions) : {};
  }
  switch (schema.type) {
    case 'string':
      if (schema.enum) return schema.enum[0];
      if (schema.format === 'date') return '2025-01-15';
      if (schema.format === 'date-time') return '2025-01-15T10:30:00Z';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
      if (schema.format === 'uuid') return crypto.randomUUID();
      return `sample_${Math.random().toString(36).slice(2, 8)}`;
    case 'integer':
    case 'number':
      if (schema.minimum != null && schema.maximum != null)
        return Math.floor(Math.random() * (schema.maximum - schema.minimum + 1)) + schema.minimum;
      return schema.type === 'integer' ? Math.floor(Math.random() * 100) : +(Math.random() * 100).toFixed(2);
    case 'boolean':
      return Math.random() > 0.5;
    case 'array':
      return [generateValue(schema.items || { type: 'string' }, definitions)];
    case 'object': {
      const obj = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateValue(prop, definitions);
        }
      }
      return obj;
    }
    default:
      if (schema.properties) {
        const obj = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateValue(prop, definitions);
        }
        return obj;
      }
      return 'sample';
  }
}

// Parse swagger spec (supports OpenAPI 2.x and 3.x)
export function parseSwaggerSpec(spec, sourceUrl) {
  const endpoints = [];
  const basePath = spec.basePath || '';
  let baseUrl = '';

  // Derive the origin from sourceUrl for resolving relative server URLs
  let sourceOrigin = '';
  try {
    const u = new URL(sourceUrl);
    sourceOrigin = `${u.protocol}//${u.host}`;
  } catch {}

  if (spec.openapi && spec.servers?.length) {
    const serverUrl = spec.servers[0].url;
    if (serverUrl.startsWith('http')) {
      // If spec points to localhost/127.0.0.1, it's a dev placeholder — use the real source host instead
      try {
        const su = new URL(serverUrl);
        const isLocal = su.hostname === 'localhost' || su.hostname === '127.0.0.1' || su.hostname === '0.0.0.0';
        baseUrl = isLocal
          ? sourceOrigin + su.pathname.replace(/\/$/, '')
          : serverUrl;
      } catch {
        baseUrl = serverUrl;
      }
    } else {
      // Relative server URL — resolve against the source host
      baseUrl = sourceOrigin + (serverUrl.startsWith('/') ? serverUrl : `/${serverUrl}`);
    }
  } else if (spec.host) {
    const scheme = spec.schemes?.[0] || 'https';
    baseUrl = `${scheme}://${spec.host}${basePath}`;
  } else {
    baseUrl = sourceOrigin + basePath;
  }
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  const definitions = spec.definitions || spec.components?.schemas || {};

  for (const [pathStr, methods] of Object.entries(spec.paths || {})) {
    for (const [method, detail] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].indexOf(method) === -1) continue;
      const params = (detail.parameters || []).map(p => ({
        name: p.name,
        in: p.in,
        required: !!p.required,
        type: p.type || p.schema?.type || 'string',
        description: p.description || '',
        schema: p.schema || null,
      }));

      endpoints.push({
        path: pathStr,
        method,
        fullUrl: `${baseUrl}${pathStr}`,
        summary: detail.summary || '',
        description: detail.description || '',
        tags: detail.tags || [],
        parameters: params,
        requestBody: detail.requestBody || null,
        responses: detail.responses || {},
        operationId: detail.operationId || '',
      });
    }
  }
  return { endpoints, definitions, info: spec.info || {}, baseUrl };
}
