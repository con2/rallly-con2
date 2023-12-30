// this script can be used to generate a secret.json file for staging or production

import { labels, b64, stack, writeManifest } from "./manifest";

const secret = {
  apiVersion: "v1",
  kind: "Secret",
  type: "Opaque",
  metadata: {
    name: stack,
    labels: labels(),
  },
  data: {
    // fill these in, DO NOT COMMIT THE RESULT
    DATABASE_URL: b64(""),
    OIDC_CLIENT_SECRET: b64(""),
    OIDC_CLIENT_ID: b64(""),
    // generate using openssl rand -hex 32
    SECRET_PASSWORD: b64(""),
  },
};

function main() {
  writeManifest("secret.json", secret);
}

if (require.main === module) {
  main();
}
