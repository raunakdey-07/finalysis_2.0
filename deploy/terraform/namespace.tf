# The namespace, and the optional ServiceAccount the pods run as.
#
# Deliberately not managed here: the Deployment, the Service, the
# PodDisruptionBudget and the NetworkPolicy. Those exist to be readable and
# reviewable as plain Kubernetes objects, and expressing them as HCL would make
# them harder to read without making them more correct. `helm_release` installs
# the chart, which is where that duplication would otherwise have to be resolved.

resource "kubernetes_namespace_v1" "finalysis" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name"       = "finalysis"
      "app.kubernetes.io/part-of"    = "finalysis"
      "helm.sh/chart"                = "finalysis-0.1.0"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }

  # Orderly teardown comes from the dependency graph rather than a
  # delete_command: helm_release depends on the ServiceAccount, which depends on
  # this namespace, so `terraform destroy` removes the workload before the
  # namespace that holds it. An earlier version used a delete_command here and
  # terraform validate rejected it, which is the check earning its keep.
}

resource "kubernetes_service_account_v1" "finalysis" {
  metadata {
    name      = "finalysis"
    namespace = kubernetes_namespace_v1.finalysis.metadata[0].name
    labels = {
      "app.kubernetes.io/name"    = "finalysis"
      "app.kubernetes.io/part-of" = "finalysis"
    }
  }
}