/**
 * AEM GraphQL persisted query helpers.
 *
 * All Content Fragment blocks that fetch data via GraphQL should import from
 * this single module so the publish host is configured in one place.
 *
 * Requires AEM_PUBLISH_HOST environment variable.
 */

const AEM_PUBLISH_HOST = process.env.AEM_PUBLISH_HOST;

/**
 * Return the AEM host to use for GraphQL requests.
 * - Author tier (Universal Editor): same origin.
 * - EDS delivery: the publish instance.
 */
export function getGraphQLHost() {
  if (window.location.hostname.includes('adobeaemcloud.com')) {
    return window.location.origin;
  }
  return AEM_PUBLISH_HOST;
}

/**
 * Execute a persisted GraphQL query and return the result.
 *
 * @param {string} queryPath  e.g. "b2b-ue/product-spec-by-path"
 * @param {Object} variables  e.g. { path: "/content/dam/b2b-ue/product-specs/cmm-systems" }
 * @returns {Object|Array|null}  The query result (item or items), or null on error.
 */
export async function executePersistedQuery(queryPath, variables = {}) {
  const host = getGraphQLHost();
  // AEM persisted-query semicolon params use raw path values — slashes must NOT
  // be percent-encoded or AEM returns "no resource available".
  const params = Object.entries(variables)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%2F/gi, '/')}`)
    .join(';');
  const url = `${host}/graphql/execute.json/${queryPath}${params ? `;${params}` : ''}`;

  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) return null;

  const json = await resp.json();
  // Extract the first query result regardless of query name
  const queryResult = Object.values(json.data || {})[0];
  return queryResult?.item || queryResult?.items || null;
}
