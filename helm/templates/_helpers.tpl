{{- define "portfolio-tracker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "portfolio-tracker.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "portfolio-tracker.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "portfolio-tracker.labels" -}}
helm.sh/chart: {{ include "portfolio-tracker.chart" . }}
{{ include "portfolio-tracker.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "portfolio-tracker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "portfolio-tracker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Build the DATABASE_URL from in-cluster or external postgres values */}}
{{- define "portfolio-tracker.databaseUrl" -}}
{{- if .Values.postgres.enabled -}}
postgresql://{{ .Values.postgres.auth.username }}:{{ .Values.postgres.auth.password }}@{{ include "portfolio-tracker.fullname" . }}-postgres:5432/{{ .Values.postgres.auth.database }}
{{- else -}}
postgresql://{{ .Values.externalDatabase.username }}:{{ .Values.externalDatabase.password }}@{{ .Values.externalDatabase.host }}:{{ .Values.externalDatabase.port }}/{{ .Values.externalDatabase.database }}
{{- end -}}
{{- end }}

{{/* Resolve the allowed hosts value — falls back to ingress.host */}}
{{- define "portfolio-tracker.allowedHosts" -}}
{{- if .Values.app.allowedHosts -}}
{{ .Values.app.allowedHosts }}
{{- else -}}
{{ .Values.ingress.host }}
{{- end -}}
{{- end }}
