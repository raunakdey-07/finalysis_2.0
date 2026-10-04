# The application itself, installed from the local Helm chart.
#
# Terraform's job here is to be the single entry point: create the namespace,
# then install the same chart a human would run with helm. Expressing the
# Deployment as HCL as well would create two definitions of one workload and
# guarantee they drift.

resource "helm_release" "finalysis" {
  name      = "finalysis"
  namespace = kubernetes_namespace_v1.finalysis.metadata[0].name
  chart     = abspath(var.chart_path)

  # The chart reads from a local path, so there is no repository to add and no
  # OCI registry to authenticate against. That is the point: nothing here needs
  # an account.
  wait        = true
  timeout     = 300
  atomic      = true
  max_history = 5

  set {
    name  = "replicaCount"
    value = tostring(var.replica_count)
  }

  set {
    name  = "image.repository"
    value = var.image_repository
  }

  set {
    name  = "image.tag"
    value = var.image_tag
  }

  set {
    name  = "secrets.existingSecret"
    value = var.existing_secret
  }

  depends_on = [kubernetes_service_account_v1.finalysis]
}