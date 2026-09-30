# Con2 Kubernetes deployment of Rallly

[Rallly](https://github.com/lukevella/rallly) is a tool to, according to them,

> Schedule group meetings with friends, colleagues and teams. Create meeting polls to find the best date and time to organize an event based on your participants' availability. Save time and avoid back-and-forth emails.

This repository provides a Kubernetes deployment of Rallly that is setup to authenticate against [Kompassi](https://github.com/con2/kompassi) using OIDC.

User friendly redirects to `rallly.con2.fi` (such as `rally.con2.fi`) are managed under [redirects](https://github.com/con2/redirects). (Note that in every other instance of `rallly` there are three lower-case L letters.)

## Deployment

The Helm chart in `chart/` deploys the upstream `lukevella/rallly` image; see `chart/README.md` for the prerequisites and how to upgrade Rallly.

GitHub Actions deploys every commit to `main` into `rallly.con2.fi`, so you should, for the most part, not deploy manually. To check the rendered manifests locally:

    helm lint chart -f chart/values-production.yaml
    helm template rallly chart -f chart/values-production.yaml
