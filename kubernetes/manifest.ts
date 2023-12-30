import { writeFileSync, unlinkSync, existsSync } from "fs";

interface Environment {
  hostname: string;
  secretManaged: boolean;
  postgresManaged: boolean;
  kompassiBaseUrl: string;
  tlsEnabled: boolean;
}

type EnvironmentName = "dev" | "production";
const environmentNames: EnvironmentName[] = ["dev", "production"];

const environmentConfigurations: Record<EnvironmentName, Environment> = {
  dev: {
    hostname: "rallly.localhost",
    secretManaged: true,
    postgresManaged: true,
    kompassiBaseUrl: "https://dev.kompassi.eu",
    tlsEnabled: false,
  },
  production: {
    hostname: "rallly.con2.fi",
    secretManaged: false,
    postgresManaged: false,
    kompassiBaseUrl: "https://kompassi.eu",
    tlsEnabled: true,
  },
};

function getEnvironmentName(): EnvironmentName {
  const environmentName = process.env.ENV;
  if (!environmentNames.includes(environmentName as EnvironmentName)) {
    return "dev";
  }
  return environmentName as EnvironmentName;
}

const environmentConfiguration =
  environmentConfigurations[getEnvironmentName()];

export const stack = "rallly";
const image = "lukevella/rallly:latest";
const nodeServiceName = "rallly";
const clusterIssuer = "letsencrypt-prod";
const tlsSecretName = "ingress-letsencrypt";
const port = 3000;

// only used if postgresManaged is true (dev)
const insecurePostgresPassword = "postgres";

const {
  hostname,
  secretManaged,
  postgresManaged,
  kompassiBaseUrl,
  tlsEnabled,
} = environmentConfiguration;

const ingressProtocol = tlsEnabled ? "https" : "http";
const publicUrl = `${ingressProtocol}://${hostname}`;

// Startup and liveness probe
const probe = {
  httpGet: {
    // TODO
    path: "/",
    port,
    httpHeaders: [
      {
        name: "host",
        value: hostname,
      },
    ],
  },
};

export function labels(component?: string) {
  return {
    stack,
    component,
  };
}

function secretKeyRef(key: string) {
  return {
    secretKeyRef: {
      name: stack,
      key,
    },
  };
}

const env = Object.entries({
  PORT: port,
  DATABASE_URL: secretKeyRef("DATABASE_URL"),
  SECRET_PASSWORD: secretKeyRef("SECRET_PASSWORD"),
  NEXT_PUBLIC_BASE_URL: publicUrl,
  SUPPORT_EMAIL: "tekniikka@tracon.fi",
  SMTP_HOST: "mailer.b2.fi",
  SMTP_TLS_ENABLED: true,
  OIDC_NAME: "Kompassi",
  OIDC_DISCOVERY_URL: `${kompassiBaseUrl}/oidc/.well-known/openid-configuration/`,
  OIDC_CLIENT_ID: secretKeyRef("OIDC_CLIENT_ID"),
  OIDC_CLIENT_SECRET: secretKeyRef("OIDC_CLIENT_SECRET"),
}).map(([key, value]) => {
  if (value instanceof Object) {
    return {
      name: key,
      valueFrom: value,
    };
  } else {
    return {
      name: key,
      value: `${value}`,
    };
  }
});

// Node (Next.js) service
const deployment = {
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: {
    name: nodeServiceName,
    labels: labels(nodeServiceName),
  },
  spec: {
    selector: {
      matchLabels: labels(nodeServiceName),
    },
    template: {
      metadata: {
        labels: labels(nodeServiceName),
      },
      spec: {
        enableServiceLinks: false,
        securityContext: {
          runAsUser: 1000,
          runAsGroup: 1000,
          fsGroup: 1000,
        },
        initContainers: [],
        containers: [
          {
            name: nodeServiceName,
            image,
            env,
            ports: [{ containerPort: port }],
            securityContext: {
              readOnlyRootFilesystem: false,
              allowPrivilegeEscalation: false,
            },
            startupProbe: probe,
            livenessProbe: probe,
          },
        ],
      },
    },
  },
};

const service = {
  apiVersion: "v1",
  kind: "Service",
  metadata: {
    name: nodeServiceName,
    labels: labels(nodeServiceName),
  },
  spec: {
    ports: [
      {
        port,
        targetPort: port,
      },
    ],
    selector: labels(nodeServiceName),
  },
};

// PostgreSQL (only deployed if postgresManaged is true)
const postgresDeployment = {
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: {
    name: "postgres",
    labels: labels("postgres"),
  },
  spec: {
    replicas: 1,
    selector: {
      matchLabels: labels("postgres"),
    },
    template: {
      metadata: {
        labels: labels("postgres"),
      },
      spec: {
        containers: [
          {
            name: "postgres",
            image: "postgres:15",
            ports: [
              {
                containerPort: 5432,
              },
            ],
            env: [
              {
                name: "POSTGRES_PASSWORD",
                value: insecurePostgresPassword,
              },
            ],
          },
        ],
      },
    },
  },
};

const postgresService = {
  apiVersion: "v1",
  kind: "Service",
  metadata: {
    name: "postgres",
    labels: labels("postgres"),
  },
  spec: {
    ports: [
      {
        port: 5432,
        targetPort: 5432,
      },
    ],
    selector: labels("postgres"),
  },
};

// Ingress
const tls = tlsEnabled
  ? [{ hosts: [hostname], secretName: tlsSecretName }]
  : [];

const ingressAnnotations = tlsEnabled
  ? {
      "cert-manager.io/cluster-issuer": clusterIssuer,
      "nginx.ingress.kubernetes.io/ssl-redirect": "true",
    }
  : {};

const ingress = {
  apiVersion: "networking.k8s.io/v1",
  kind: "Ingress",
  metadata: {
    name: stack,
    labels: labels(),
    annotations: ingressAnnotations,
  },
  spec: {
    tls,
    rules: [
      {
        host: hostname,
        http: {
          paths: [
            {
              pathType: "Prefix",
              path: "/",
              backend: {
                service: {
                  name: nodeServiceName,
                  port: {
                    number: port,
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
};

export function b64(str: string) {
  return Buffer.from(str).toString("base64");
}

// only written if secretManaged is true
const secret = {
  apiVersion: "v1",
  kind: "Secret",
  type: "Opaque",
  metadata: {
    name: stack,
    labels: labels(),
  },
  data: {
    DATABASE_URL: b64(
      `postgres://postgres:${insecurePostgresPassword}@postgres:5432/postgres`
    ),
    OIDC_CLIENT_SECRET: b64("kompassi_insecure_test_client_secret"),
    OIDC_CLIENT_ID: b64("kompassi_insecure_test_client_id"),
    SECRET_PASSWORD: b64("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"),
  },
};

export function writeManifest(filename: string, manifest: unknown) {
  writeFileSync(filename, JSON.stringify(manifest, null, 2), {
    encoding: "utf-8",
  });
}

function main() {
  writeManifest("deployment.json", deployment);
  writeManifest("service.json", service);
  writeManifest("ingress.json", ingress);

  if (postgresManaged) {
    writeManifest("postgres-deployment.json", postgresDeployment);
    writeManifest("postgres-service.json", postgresService);
  } else {
    if (existsSync("postgres-deployment.json")) {
      unlinkSync("postgres-deployment.json");
    }
    if (existsSync("postgres-service.json")) {
      unlinkSync("postgres-service.json");
    }
  }

  if (secretManaged) {
    writeManifest("secret.json", secret);
  } else if (existsSync("secret.json")) {
    unlinkSync("secret.json");
  }
}

if (require.main === module) {
  main();
}
