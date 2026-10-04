const { existsSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Everything lives in app.json; this only adds what depends on local files.
 *
 * google-services.json (Firebase → Project settings → Your apps → Android) registers the app with
 * Firebase Cloud Messaging, which Android push notifications need. It's linked only when present,
 * so the app still builds before Firebase is set up (push registration then just fails quietly).
 *
 * @param {import('expo/config').ConfigContext} ctx
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
  const hasFirebase = existsSync(join(__dirname, 'google-services.json'));
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
