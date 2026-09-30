# rallly Helm chart

Deploys the upstream `lukevella/rallly` image as a Deployment with a Service, plus a per-namespace
Gateway with HTTPRoutes whose TLS certificate cert-manager issues from the Gateway's
`cert-manager.io/cluster-issuer` annotation. `.github/workflows/cicd.yaml` runs
`helm upgrade --install rallly chart` into namespace `rallly` on every push to main.

```sh
helm lint chart -f chart/values-production.yaml
helm template rallly chart -f chart/values-production.yaml
```

## Prerequisites

```sh
kubectl create namespace rallly
kubectl -n rallly create secret generic rallly \
  --from-literal=DATABASE_URL='postgres://rallly:...@.../rallly' \
  --from-literal=SECRET_PASSWORD="$(openssl rand -hex 32)" \
  --from-literal=OIDC_CLIENT_ID=... \
  --from-literal=OIDC_CLIENT_SECRET=...
```

The Kompassi OIDC client must allow the redirect URI `https://<hostname>/api/auth/callback/oidc`.

## Upgrading Rallly

The image tag is pinned to a Rallly release in `image.tag` in `values.yaml`. To upgrade, read the
release notes at https://github.com/lukevella/rallly/releases, bump `image.tag` (and `appVersion`
in `Chart.yaml`) and push to main.

The image's start script applies Rallly's database migrations before the server starts, so a
downgrade after a release with migrations may not work.

## One-time cutover from skaffold

The Deployment and Service were created by `kubectl apply` through skaffold, and rallly.con2.fi was
routed by an Ingress. Do this by hand once, before merging the switch to `cicd.yaml`.

1. Mark the existing objects as belonging to the release:

   ```sh
   for object in deployment/rallly service/rallly; do
     kubectl -n rallly label "$object" app.kubernetes.io/managed-by=Helm
     kubectl -n rallly annotate "$object" meta.helm.sh/release-name=rallly \
       meta.helm.sh/release-namespace=rallly
   done
   ```

2. Read the diff against the live objects. Expect only the new Gateway and HTTPRoutes, labels,
   resources, security context hardening, the preStop sleep, the probes moving to `/api/status`
   and the image tag `latest` becoming `4.15.3` (the same image):

   ```sh
   helm template rallly chart -f chart/values-production.yaml \
     | kubectl -n rallly diff --server-side --force-conflicts -f -
   ```

3. Install:

   ```sh
   helm upgrade --install rallly chart --namespace rallly \
     -f chart/values-production.yaml --wait --timeout 300s --force-conflicts
   ```

   Helm installs with server-side apply, and every field the old manifests set is owned by
   `kubectl-client-side-apply`, so this first install needs `--force-conflicts`. Later deploys do
   not.

4. cert-manager issues a certificate for the Gateway into Secret `tls-rallly`. Until it is Ready the
   Ingress keeps serving rallly.con2.fi with its own certificate. Once
   `kubectl -n rallly get certificate tls-rallly` shows Ready, delete the old routing:

   ```sh
   kubectl -n rallly delete ingress rallly
   ```

   The Ingress owns Certificate `ingress-letsencrypt`, so it and its Secret should go with it.
   Check with `kubectl -n rallly get certificate,secret` and delete them by hand if they stay.

5. Merge the switch to `cicd.yaml`.

The hostname does not change, so neither DNS nor the OIDC redirect URI need updating.
