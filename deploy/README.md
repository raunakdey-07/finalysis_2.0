# Local infrastructure

Everything in this directory is local and free. There is no cloud account, no
trial, no paid API and no hosted monitoring anywhere in it. The most it needs is
a container runtime, a kind cluster and roughly 6 GB of memory.

## What this is for

Fin-alysis reads from three third-party providers that all fail sometimes. The
application already handles that — a cache, a circuit breaker, bounded retries,
stale-while-error fallbacks, and a page that says how old a number is. This
directory is the part that makes that visible and testable: a container, probes,
a cluster that restarts things, and metrics that show the fallbacks firing.

```mermaid
flowchart TD
  Reader -->|browser| Svc["Service (ClusterIP)"]
  Svc --> Pod1["Pod: Fin-alysis"]
  Svc --> Pod2["Pod: Fin-alysis"]
  Pod1 --> Cache[(in-process cache)]
  Pod2 --> Cache
  Pod1 --> Yahoo["Yahoo Finance"]
  Pod1 --> Screener["Screener.in"]
  Pod1 --> News["Google News RSS"]
  Prom["Prometheus"] -.->|scrapes /api/telemetry| Pod1
  Prom --> Graf["Grafana"]
  Cron["scheduled job"] -->|bearer token| Pod1
  Pod1 --> Redis[("Redis: close snapshot")]
```

The dashed line is the only one that matters for the dashboard: Prometheus does
not scrape the providers, it scrapes the application, and the application tells
it what happened when it called them.

## Prerequisites

| Tool | Why | Install |
| --- | --- | --- |
| Docker or Podman | builds and runs the image | already present |
| kind | the local cluster | `deploy/scripts/fetch-tools.sh` |
| kubectl | talks to the cluster | same |
| helm | installs the chart | same |
| terraform | optional, for the IaC path | same |

`fetch-tools.sh` downloads the four binaries into `.tools/`, which is gitignored.
Nothing is installed system-wide and nothing needs a package manager with root.

## The whole thing, in order

```bash
deploy/scripts/fetch-tools.sh        # one-off: kind, kubectl, helm, terraform
deploy/scripts/build.sh              # build the image
deploy/scripts/run-local.sh          # just run it, no cluster
deploy/scripts/cluster-up.sh         # create kind, load the image
deploy/scripts/apply.sh              # apply deploy/kubernetes
deploy/scripts/monitoring.sh         # Prometheus + Grafana
```

Then:

```bash
.tools/kubectl -n finalysis port-forward svc/finalysis 8080:80
# http://localhost:8080
```

To tear it all down:

```bash
deploy/scripts/teardown.sh
```

## Why the probes are not the same probe

This is the part most worth explaining, and it is the part a reviewer should
push back on if it looks wrong.

`/api/health` is liveness. It answers from the process alone. It never calls a
provider, never touches Redis and never depends on configuration.

`/api/health/ready` is readiness. It also checks nothing external. It reports
whether Redis and a cron secret are configured, but does not fail on either.

Both refusals are deliberate:

- If **liveness** consulted a provider, a Yahoo outage would fail the probe,
  Kubernetes would kill every pod, and a restart loop would be layered on top of
  the outage. The pod was healthy. It was being asked the wrong question.
- If **readiness** consulted a provider, the pod would be pulled from the
  Service during an outage. That removes the one pod that could still serve a
  cached price with a visible "as of" time, turning a partial outage into a
  total one.

So a degraded upstream is reported in three other places — the
`finalysis_price_freshness_total` metric, the page's own freshness wording, and
the dashboard — rather than by taking the pod out of rotation.

A `startupProbe` gives a cold Node process up to 60 seconds before liveness
starts counting failures, so a slow start is not mistaken for a hang.

## Failure tests

`deploy/scripts/failure-tests.sh` runs four of them against a live cluster and
prints what it observes. They are observational on purpose: a failure test whose
result you cannot see is not a test.

1. **Pod deleted** — Kubernetes recreates it.
2. **Process frozen with SIGSTOP** — the liveness probe's requests hang, and the
   probe restarts it. This is the case that distinguishes liveness from
   readiness.
3. **Readiness with no providers reachable** — still Ready, and says so.
4. **Scheduled job with no secret** — returns 503, not an open endpoint.

## What was verified, and what was not

This matters more than the diagrams, so it is stated plainly.

### Verified by running it

- **The image** builds and runs. No package manager, lockfile, source or tests
  inside it, as uid 1000. It was also run with `--read-only`, all capabilities
  dropped and `no-new-privileges`, matching the Deployment, with no permission
  errors logged.
- **The application in that container**: the page renders, both probe endpoints
  answer 200, `/api/nse/quote`, `/api/metrics` and `/api/news` return real data,
  and an unknown ticker still returns 404 with `UNKNOWN_SYMBOL` rather than a
  wrong company or a crash. No secret appeared in the logs.
- **Probes are not coupled to provider health.** With every upstream made
  unreachable (below), liveness and readiness both stayed 200, and the circuit
  breaker reached `open = 1` while both probes stayed 200.
- **Upstream failure degrades without inventing data.** With no network, the
  price endpoint returned `data: null` with `PRICE_UNAVAILABLE`, and telemetry
  recorded `finalysis_upstream_requests_total{result="error"}`.
- **Prometheus** scrapes the application (`up = 1`), the counters move after
  traffic, and killing the application flips the target to `up = 0`.
- **Metric labels** contain no ticker or user input. Checked against TCS, INFY,
  RELIANCE, SBIN and an unknown symbol; all absent. Only five Fin-alysis metric
  families are exported.
- **The Grafana dashboard** loads, resolves its Prometheus datasource, and its
  panels carry real data (upstream outcome series, price freshness, circuit
  breaker reading "Closed", cache hit rate reading a percentage).
- `promtool check config`, `helm lint`, `helm template`, `terraform fmt -check`
  and `terraform validate` all pass.

### Not verified

- **Redis failure** was not tested, because Redis is not part of this local
  deployment and adding it solely for a test would be inventing infrastructure.
  What was verified is its *absent* state, which is how this setup is
  configured: readiness reports `redis: absent` and still answers 200. The
  snapshot-fallback path needs a Redis holding data.
- **No multi-node cluster, no HA.** Two replicas with `maxUnavailable: 0` are
  configured, and the rolling-update test observed ready replicas never falling
  below two. That is one observation on one cluster at one moment, not a claim
  of high availability.

### Verified in GitHub Actions

`.github/workflows/infrastructure-kubernetes.yml`, manual dispatch only, on a
GitHub-hosted `ubuntu-latest` runner. The runner is used purely as a disposable
CI environment, because kind cannot run on the workstation above. Nothing is
deployed to any cloud, and this is not production Kubernetes operation.

The most recent run passed every step: kind v0.31.0, node image
`kindest/node:v1.34.0`, kubectl v1.35.0, in 4m41s.

- Cluster created, control plane ready, two Fin-alysis replicas Ready.
- Service served a real company page, a quote, a news request, both health
  endpoints and telemetry. An unknown ticker returned 404 with
  `UNKNOWN_SYMBOL`.
- **Pod recovery**: `finalysis-6c5c7ffcd8-49ph7` force-deleted, deployment
  rolled out, `ready replicas after: 2`, replacement `...-45tzv`, Service
  answering 200.
- **Rolling update**: ready replicas sampled throughout never dropped below 2;
  Service answered 200 afterwards.
- **Upstream failure**, forced with a DNS-only NetworkPolicy rather than by
  hoping the internet was down: liveness and readiness stayed 200, the page
  still served, the price came back `null` rather than invented, the circuit
  breaker reached `open = 1` after 7 recorded upstream errors, and both probes
  were still healthy with the breaker open. No ticker appeared in any label.
- **Prometheus**: config validated with promtool, and an in-cluster Prometheus
  scraped `finalysis.finalysis.svc.cluster.local:80` with the target up.
- **Terraform**: `fmt -check`, `validate` and `plan` against the live context,
  with `Plan: 3 to add`.

That run also found and fixed a real defect in this directory's own manifests:
the default-deny ingress policy had sealed the pods so completely that nothing
could scrape them. See the next section.

## The NetworkPolicy that quietly broke metrics

`finalysis-default-deny-ingress` denies every ingress to a Fin-alysis pod, which
is the right default: nothing in the cluster should be able to reach the page.

It was also wrong as written, because Prometheus scrapes `/api/telemetry` on
port 3000 from inside the cluster. The first in-cluster run resolved the target
by DNS and got `up = 0`, forever, and nothing complained:

- the application was genuinely fine, so every functional assertion passed;
- `kubectl port-forward` still worked, because a port-forward tunnels through
  the API server and is **not** subject to NetworkPolicy at all.

So the failure was invisible to every local test and to every check that
touched the application. Only an in-cluster scrape reaches the real network
path.

Ingress on port 3000 is now opened again, narrowly, to pods labelled
`app.kubernetes.io/component: prometheus` or living in the `monitoring`
namespace. The page itself stays unreachable from another pod, which is what
the default-deny was for.

The general lesson is worth more than the fix: a default-deny is only correct
once something has been given permission, and the thing that needs permission
is usually the thing nobody notices is missing.

## Monitoring

`deploy/monitoring/prometheus.yml` scrapes `/api/telemetry`. Deliberately not
`/api/metrics`, which is the company-data API the web page calls.

The dashboard answers the questions the resilience layer exists for: is an
upstream answering, is a reader being served an old price, is the circuit
breaker open, is the cache doing its job, and are requests being rate limited.

Label discipline is enforced in code rather than documented. `lib/observability`
declares every metric's label names and allowed values up front and throws on an
undeclared combination, so a ticker symbol cannot become a time series. That is
what stops a scrape from growing without bound as readers search for more
symbols.

## Helm

The chart exposes only what an operator has a reason to change: replica count,
image, resources, service, probes, environment, an optional existing Secret, and
an optional ingress. Everything else is a constant in the template.

```bash
deploy/scripts/helm.sh --set replicaCount=3
.tools/helm uninstall finalysis -n finalysis
```

Both the chart and the raw manifests describe the same application. The raw
manifests are the readable reference; the chart is the installable form.

## Terraform

Terraform manages the namespace, a ServiceAccount, and the Helm release. It does
not re-express the Deployment, Service or NetworkPolicy as HCL: that would create
two definitions of one workload and guarantee they drift.

```bash
cd deploy/terraform
../../.tools/terraform init
../../.tools/terraform plan -var kube_context=kind-finalysis
../../.tools/terraform apply -var kube_context=kind-finalysis
../../.tools/terraform destroy -var kube_context=kind-finalysis
```

`plan` and `apply` need a running cluster. `init` and `validate` do not.

No cloud provider is configured, and none is needed. `CRON_SECRET` and
`KV_REDIS_URL` are not Terraform variables at all — a value in a variable would
land in `terraform.tfstate`, and the configuration references a Secret by name
only.

## Future cloud mapping

**Not deployed, and not operated.** This is a note about how the same objects
would map if someone later wanted a real cluster, written so the mapping is
easy to reason about, not because any of it has been done.

| Local | Cloud equivalent | Notes |
| --- | --- | --- |
| `kind` cluster | OCI Container Engine for Kubernetes (OKE) or a managed control plane | The manifests do not change. A registry has to exist and `image.pullPolicy` becomes `Always`. |
| `kind load docker-image` | OCI Container Registry + `imagePullPolicy: Always` | The only structural difference in the Deployment. |
| `kind delete cluster` | OKE node pool autoscale, or Terraform-managed node pools | `terraform destroy` does not apply; node pools are managed by the cloud. |
| Prometheus and Grafana containers | the same images on a node, or OCI Container Registry + a self-hosted pair | The images are unmodified upstream OSS. A hosted or managed offering would be a paid service, which this project does not use. |
| `emptyDir` for `/app/.next/cache` | a volume claim, or leave as `emptyDir` | It is a cache; losing it on restart is correct. |
| Redis for the close snapshot | a managed Redis, or the same `KV_REDIS_URL` | Optional either way. The application runs without it. |

Nothing above requires a change to the application, which is the point of keeping
the deployment a plain Deployment and a Service.