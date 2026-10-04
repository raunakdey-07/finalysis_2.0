terraform {
  required_version = "~> 1.9"

  # Pinned exactly rather than with a caret. A provider major has changed
  # resource schemas before, and a local demonstration should not change shape
  # because a release went out between two runs.
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.37.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.17.0"
    }
  }
}

# No cloud provider is configured here, and none is needed. This manages the
# Kubernetes objects inside an already-running kind cluster, which is why there
# is no provider block for AWS, Azure, GCP or OCI anywhere in this directory.
#
# The cluster is expected to exist already. deploy/scripts/cluster-up.sh creates
# it, and this configuration refuses to guess at a context: see the variable
# description on `kube_context` below.

provider "kubernetes" {
  # Left unset so the ambient KUBECONFIG is used, which is what a kind cluster
  # installs itself with. Setting it here to an absolute path would be the kind
  # of thing that works on exactly one machine.
  config_path    = var.kubeconfig_path
  config_context = var.kube_context
}

provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig_path
    config_context = var.kube_context
  }
}

variable "kubeconfig_path" {
  description = "Path to the kubeconfig. Empty means the ambient KUBECONFIG, which is what `kind` writes and what the kubernetes provider finds on its own."
  type        = string
  default     = ""
}

variable "kube_context" {
  description = "The kubeconfig context to use. The kind cluster created by deploy/scripts/cluster-up.sh is named after CLUSTER_NAME and its context is kind-<that name>."
  type        = string
  default     = "kind-finalysis"
}

variable "namespace" {
  description = "Namespace to manage. Created here so `terraform destroy` removes it cleanly."
  type        = string
  default     = "finalysis"
}

variable "chart_path" {
  description = "Path to the local Helm chart, relative to this directory."
  type        = string
  default     = "../helm/finalysis"
}

variable "image_repository" {
  description = "Container image repository, already loaded into the kind node by `kind load`."
  type        = string
  default     = "finalysis"
}

variable "image_tag" {
  description = "Container image tag."
  type        = string
  default     = "local"
}

variable "replica_count" {
  description = "Number of application pods."
  type        = number
  default     = 2
}

variable "existing_secret" {
  description = <<-EOT
    Name of an existing Secret holding CRON_SECRET and KV_REDIS_URL. Empty
    means neither is supplied, which the application supports: the scheduled job
    then returns 503 rather than running open, and the end-of-day close snapshot
    is simply unavailable.

    No secret value is ever a Terraform variable. Values belong in a Secret
    object that someone created; putting one here would put it in terraform.tfstate
    and in this repository.
  EOT
  type        = string
  default     = ""
}