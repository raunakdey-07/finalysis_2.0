{{/* Chart name, overridable but not required to be. */}}
{{- define "finalysis.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- /* The name used in resource names. */}}
{{- define "finalysis.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- /* Chart label value. */}}
{{- define "finalysis.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- /* Common labels. */}}
{{- define "finalysis.labels" -}}
helm.sh/chart: {{ include "finalysis.chart" . }}
{{ include "finalysis.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/part-of: finalysis
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- /*
Selector labels. These must not change between upgrades, or a rolling update
would not be able to tell old pods from new ones.
*/}}
{{- define "finalysis.selectorLabels" -}}
app.kubernetes.io/name: {{ include "finalysis.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- /* The Secret to read optional credentials from, or empty when there is none. */}}
{{- define "finalysis.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- end -}}
{{- end -}}