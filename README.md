# Con2 Kubernetes deployment of Rallly

[Rallly](https://github.com/lukevella/rallly) is a tool to, according to them,

> Schedule group meetings with friends, colleagues and teams. Create meeting polls to find the best date and time to organize an event based on your participants' availability. Save time and avoid back-and-forth emails.

This repository provides a Kubernetes deployment of Rallly that is setup to authenticate against [Kompassi](https://github.com/con2/kompassi) using OIDC.

User friendly redirects to `rallly.con2.fi` (such as `rally.con2.fi`) are managed under [redirects](https://github.com/con2/redirects). (Note that in every other instance of `rallly` there are three lower-case L letters.)

## Getting started

Requirements:

* A Kubernetes cluster
* [Skaffold](https://skaffold.dev)
* Node.js (tested: 20, 21)

For a macOS workstation using Homebrew, install local dependencies using

    brew install skaffold kubernetes-cli node
    npm install

Generate Kubernetes manifests using

    npm run k8s:generate

This runs the `kubernetes/manifest.ts` that  is intended to be a brutally simple Node.js program with no other dependencies than `fs`. It accepts one environment variable, `ENV`, with the values `dev` (the default) and `production`, and outputs Kubernetes manifests as JSON files in the directory it was run.

Test with Skaffold (with Docker Desktop or similar local Kubernetes cluster):

    npm run k8s:dev

Assuming you have an [ingress controller set up](https://outline.con2.fi/doc/ingress-controller-XfVUOHtp2t#h-installing-an-ingress-controller-for-local-development), you should now be able to view the UI at http://rallly.localhost.

For staging and production, deployment is done in two steps using Skaffold:

    cd kubernetes && ENV=staging npx ts-node manifest.ts && cd -
    skaffold run -n rallly

See `skaffold.yaml` in the repository root.

You should, for the most part, not deploy manually. GitHub Actions CI/CD is set up to deploy all commits to `main` into `rallly.con2.fi`.
